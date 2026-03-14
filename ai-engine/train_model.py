"""
MuleHunter AI  ·  GNN Trainer  
========================================
Architecture: GraphSAGE + GAT Hybrid

  Layer 1 → SAGEConv  (broad neighbourhood aggregation)
  Layer 2 → GATConv   (attention-weighted neighbour selection)
  Layer 3 → SAGEConv  (final aggregation before classification)
  Head    → 2-layer MLP with BatchNorm + Dropout
  Skip    → Residual connection from input → layer-3 output

Regularisation  : FocalLoss (α=0.75, γ=2.0) + Dropout + weight decay
Scheduler       : CosineAnnealingLR with warm restarts
Early stopping  : F1-score based, patience=40 epochs

"""

from __future__ import annotations

import json
import logging
import os
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from torch_geometric.data import Data
from torch_geometric.nn import BatchNorm, GATConv, SAGEConv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("MuleHunter-Trainer")

# ──────────────────────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

MODEL_PATH  = SHARED_DATA / "mule_model.pth"
GRAPH_PATH  = SHARED_DATA / "processed_graph.pt"
EVAL_REPORT = SHARED_DATA / "eval_report.json"
MODEL_META  = SHARED_DATA / "model_meta.json"

HIDDEN_CHANNELS = 64
OUT_CHANNELS    = 2
MAX_EPOCHS      = 500


# ──────────────────────────────────────────────────────────────────────────────
# FOCAL LOSS
# ──────────────────────────────────────────────────────────────────────────────

class FocalLoss(torch.nn.Module):
    """
    Focal Loss: down-weights easy negatives, focuses on hard positives.
    Critical for fraud detection with 3–5 % fraud prevalence.

    [FIX 2] alpha/gamma scalars are registered as buffers so they are
    automatically moved to the correct device with .to(device).
    """

    def __init__(self, alpha: float = 0.75, gamma: float = 2.0) -> None:
        super().__init__()
        self.register_buffer("alpha_val", torch.tensor(alpha))
        self.register_buffer("gamma_val", torch.tensor(gamma))

    def forward(
        self,
        log_probs: torch.Tensor,
        targets: torch.Tensor,
    ) -> torch.Tensor:
        ce      = F.nll_loss(log_probs, targets, reduction="none")
        pt      = torch.exp(-ce)
        alpha_t = torch.where(
            targets == 1,
            self.alpha_val.expand_as(targets.float()),
            (1.0 - self.alpha_val).expand_as(targets.float()),
        )
        focal = alpha_t * (1.0 - pt) ** self.gamma_val * ce
        return focal.mean()


# ──────────────────────────────────────────────────────────────────────────────
# GNN ARCHITECTURE
# ──────────────────────────────────────────────────────────────────────────────

class MuleHunterGNN(torch.nn.Module):
    """
    3-layer hybrid GNN (SAGE → GAT → SAGE) with residual connection.

    Parameters
    ----------
    in_channels : int   — inferred from data.x.shape[1]  [FIX 6]
    hidden      : int   — hidden dimension (default 64)
    out         : int   — number of classes (2: safe / fraud)
    """

    def __init__(
        self,
        in_channels: int,
        hidden: int = HIDDEN_CHANNELS,
        out:    int = OUT_CHANNELS,
    ) -> None:
        super().__init__()

        self.conv1 = SAGEConv(in_channels, hidden)
        self.bn1   = BatchNorm(hidden)

        self.conv2 = GATConv(
            hidden, hidden, heads=4, concat=False,
            dropout=0.3, add_self_loops=False,
        )
        self.bn2 = BatchNorm(hidden)

        self.conv3 = SAGEConv(hidden, hidden // 2)
        self.bn3   = BatchNorm(hidden // 2)

        # Skip connection: project input → layer-3 output space
        self.skip = torch.nn.Linear(in_channels, hidden // 2)

        # Classification head
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(hidden // 2, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.4),
            torch.nn.Linear(32, out),
        )

        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.modules():
            if isinstance(m, torch.nn.Linear):
                torch.nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    torch.nn.init.zeros_(m.bias)

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        return_embedding: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        identity = self.skip(x)

        x = F.relu(self.bn1(self.conv1(x, edge_index)))
        x = F.dropout(x, p=0.3, training=self.training)

        x = F.relu(self.bn2(self.conv2(x, edge_index)))
        x = F.dropout(x, p=0.3, training=self.training)

        x = F.relu(self.bn3(self.conv3(x, edge_index)))
        embedding = x + identity  # residual

        logits = F.log_softmax(self.classifier(embedding), dim=1)
        if return_embedding:
            return logits, embedding
        return logits


# ──────────────────────────────────────────────────────────────────────────────
# EVALUATION HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def evaluate(
    model:     MuleHunterGNN,
    data:      Data,
    mask:      torch.Tensor,
    threshold: float = 0.5,
) -> dict:
    model.eval()
    with torch.no_grad():
        out  = model(data.x, data.edge_index)
        prob = out[mask].exp()[:, 1].cpu().numpy()
        pred = (prob >= threshold).astype(int)
        true = data.y[mask].cpu().numpy()

    has_both_classes = len(np.unique(true)) > 1
    return {
        "f1":             float(f1_score(true, pred, zero_division=0)),
        "precision":      float(precision_score(true, pred, zero_division=0)),
        "recall":         float(recall_score(true, pred, zero_division=0)),
        "auc_roc":        float(roc_auc_score(true, prob)) if has_both_classes else 0.0,
        "confusion_matrix": confusion_matrix(true, pred).tolist(),
        "threshold_used": float(threshold),
    }


def find_best_threshold(
    model: MuleHunterGNN,
    data:  Data,
    mask:  torch.Tensor,
) -> tuple[float, float]:
    """
    Find the decision threshold maximising F1 on the given split.

    [FIX 5] Edge-case guard: if no threshold yields F1 > 0, return 0.5.
    """
    model.eval()
    with torch.no_grad():
        out  = model(data.x, data.edge_index)
        prob = out[mask].exp()[:, 1].cpu().numpy()
        true = data.y[mask].cpu().numpy()

    if len(np.unique(true)) < 2:
        return 0.5, 0.0

    prec, rec, thresholds = precision_recall_curve(true, prob)
    denom = prec[:-1] + rec[:-1]
    f1_scores = np.where(
        denom > 0,
        2.0 * prec[:-1] * rec[:-1] / denom,
        0.0,
    )

    if f1_scores.max() == 0.0:
        logger.warning("  No threshold yields F1 > 0 — defaulting to 0.5")
        return 0.5, 0.0

    best_idx    = int(f1_scores.argmax())
    best_thresh = float(thresholds[best_idx])
    best_f1     = float(f1_scores[best_idx])
    logger.info(
        "  Optimal threshold: %.4f  (F1=%.4f vs default=0.5)",
        best_thresh, best_f1,
    )
    return best_thresh, best_f1


# ──────────────────────────────────────────────────────────────────────────────
# TRAINING LOOP
# ──────────────────────────────────────────────────────────────────────────────

def train() -> None:
    torch.manual_seed(42)
    np.random.seed(42)
    random.seed(42)
    torch.backends.cudnn.deterministic = True

    logger.info("=" * 60)
    logger.info("MuleHunter GNN Trainer v3.0")
    logger.info("=" * 60)

    if not GRAPH_PATH.exists():
        raise FileNotFoundError(
            f"Graph not found at {GRAPH_PATH}. Run feature_engineering.py first."
        )

    data = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)
    logger.info("  Nodes: %s | Edges: %s", f"{data.num_nodes:,}", f"{data.edge_index.shape[1]:,}")
    logger.info(
        "  Features: %d | Fraud nodes: %s",
        data.x.shape[1], f"{int(data.y.sum()):,}",
    )

    in_channels = data.x.shape[1]

    device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("  Device: %s", device)

    data      = data.to(device)
    model     = MuleHunterGNN(in_channels=in_channels).to(device)
    criterion = FocalLoss(alpha=0.75, gamma=2.0).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=5e-3, weight_decay=1e-4)

    # Restarts at epoch 100, 300, 700 — covers 500 training epochs well.
    scheduler = CosineAnnealingWarmRestarts(optimizer, T_0=100, T_mult=2, eta_min=1e-5)

    # ── Training ──────────────────────────────────────────────────────────────
    best_val_f1      = 0.0
    patience_epochs  = 40   # stop if no improvement for 40 epochs
    patience_strikes = 0
    history          = []

    header = f"{'Epoch':>6} | {'Loss':>8} | {'Val F1':>8} | {'Val AUC':>8} | {'Prec':>7} | {'Rec':>7}"
    logger.info("\n%s\n%s", header, "-" * len(header))

    check_interval = 10

    for epoch in range(1, MAX_EPOCHS + 1):
        model.train()
        optimizer.zero_grad()
        out  = model(data.x, data.edge_index)
        loss = criterion(out[data.train_mask], data.y[data.train_mask])
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        scheduler.step(epoch)

        if epoch % check_interval == 0:
            val_metrics = evaluate(model, data, data.val_mask)
            history.append({"epoch": epoch, "loss": float(loss), **val_metrics})

            logger.info(
                "%6d | %8.4f | %8.4f | %8.4f | %7.4f | %7.4f",
                epoch, loss.item(),
                val_metrics["f1"], val_metrics["auc_roc"],
                val_metrics["precision"], val_metrics["recall"],
            )

            if val_metrics["f1"] > best_val_f1:
                best_val_f1      = val_metrics["f1"]
                patience_strikes = 0
                torch.save(model.state_dict(), MODEL_PATH)
                logger.info("  ✓ New best val F1=%.4f — checkpoint saved", best_val_f1)
            else:
                patience_strikes += 1
                if patience_strikes * check_interval >= patience_epochs:
                    logger.info("  Early stopping at epoch %d", epoch)
                    break

    # ── Final evaluation ──────────────────────────────────────────────────────
    logger.info("\nLoading best checkpoint for final test evaluation...")
    model.load_state_dict(
        torch.load(MODEL_PATH, map_location=device)
    )

    best_thresh, _ = find_best_threshold(model, data, data.val_mask)

    test_metrics    = evaluate(model, data, data.test_mask, threshold=best_thresh)
    val_metrics_fin = evaluate(model, data, data.val_mask,  threshold=best_thresh)
    test_default    = evaluate(model, data, data.test_mask, threshold=0.5)

    logger.info("\n%s", "=" * 60)
    logger.info("FINAL EVALUATION REPORT")
    logger.info("=" * 60)
    for k, v in test_metrics.items():
        if k not in ("confusion_matrix", "threshold_used"):
            logger.info("  Test %-20s: %.4f", k.upper(), v)

    logger.info(
        "  Threshold (tuned / default): %.4f / 0.5000",
        best_thresh,
    )
    logger.info(
        "  Default-threshold F1:        %.4f",
        test_default["f1"],
    )

    cm = np.array(test_metrics["confusion_matrix"])
    logger.info(
        "\n  Confusion Matrix:\n"
        "    TN=%6d  FP=%6d\n"
        "    FN=%6d  TP=%6d",
        cm[0, 0], cm[0, 1], cm[1, 0], cm[1, 1],
    )
    logger.info("  Best Val F1: %.4f", best_val_f1)

    # ── Persist artifacts ─────────────────────────────────────────────────────
    report = {
        "test":                   test_metrics,
        "val":                    val_metrics_fin,
        "test_default_threshold": test_default,
        "best_val_f1":            best_val_f1,
        "optimal_threshold":      best_thresh,
        "training_history":       history,
        "model_config": {
            "in_channels":     in_channels,
            "hidden_channels": HIDDEN_CHANNELS,
            "architecture":    "SAGE→GAT(4heads)→SAGE + Residual",
            "loss":            "FocalLoss(alpha=0.75, gamma=2.0)",
            "optimizer":       "AdamW + CosineAnnealingWarmRestarts(T0=100)",
        },
    }
    with open(EVAL_REPORT, "w") as f:
        json.dump(report, f, indent=2)

    meta = {
        "version":           "MuleHunter-V3",
        "in_channels":       in_channels,
        "hidden_channels":   HIDDEN_CHANNELS,
        "test_f1":           test_metrics["f1"],
        "test_auc":          test_metrics["auc_roc"],
        "test_precision":    test_metrics["precision"],
        "test_recall":       test_metrics["recall"],
        "optimal_threshold": best_thresh,
    }
    with open(MODEL_META, "w") as f:
        json.dump(meta, f, indent=2)

    logger.info("\nModel saved     → %s", MODEL_PATH)
    logger.info("Eval report     → %s", EVAL_REPORT)
    logger.info("TRAINING COMPLETE")


if __name__ == "__main__":
    train()