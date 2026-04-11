"""
MuleHunter AI  ·  Inference Service  ·  v3.2
==============================================
FastAPI real-time GNN scoring service.

Endpoints
─────────
  POST /v1/gnn/score          Spring Boot contract (full schema)
  POST /analyze-transaction   Single transaction risk scoring + explainability
  POST /analyze-batch         Bulk transaction analysis (≤ 100 tx)
  GET  /detect-rings          Money-laundering ring report
  GET  /cluster-report        Fraud cluster summary
  GET  /network-snapshot      Graph snapshot for dashboard
  GET  /health                System health + model metadata
  GET  /metrics               Full evaluation report

Changes in v3.2 (bug fixes):
  [A] GnnScoreRequest now accepts BOTH "sourceAccountId" AND the legacy "accountId"
      field. Spring Boot was sending "accountId" while the schema required
      "sourceAccountId" — this caused FastAPI to return 422 Unprocessable Entity
      on every scoring call, which was swallowed silently and resulted in gnnScore=0
      everywhere. Both fields now resolve the sender account ID.

  [B] /v1/gnn/score response: gnnScore, confidence, and embeddingNorm are now
      always present as top-level flat mirrors (they were already defined in the
      GnnScoreResponse model but the values were sometimes not set when the model
      returned early). Added explicit guards.

  [C] test_my_work.py compatibility: the test suite sends {"accountId": ...} so the
      backward-compat alias ensures those tests pass without modification.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional

import networkx as nx
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator
from torch_geometric.data import Data
from torch_geometric.nn import BatchNorm, GATConv, SAGEConv

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("MuleHunter-Inference")

# ──────────────────────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

MODEL_PATH = SHARED_DATA / "mule_model.pth"
GRAPH_PATH = SHARED_DATA / "processed_graph.pt"
NODES_PATH = SHARED_DATA / "nodes.csv"
NORM_PATH  = SHARED_DATA / "norm_params.json"
META_PATH  = SHARED_DATA / "model_meta.json"
EVAL_PATH  = SHARED_DATA / "eval_report.json"

RING_TIMEOUT_SEC       = 20
MAX_RINGS_CACHED       = 200
UNKNOWN_NODE_CACHE_MAX = 10_000

LOW_AMOUNT_HARD_CAP  = 500      # below ₹500
LOW_AMOUNT_SCORE_CAP = 0.60     # allow up to 0.60 even for small amounts

NEW_ACCOUNT_SCORE_CAP = 0.75
# Add these constants near the top with your other constants
HIGH_AMOUNT_FLOOR_THRESHOLD = 100_000    # ₹1 lakh+
HIGH_AMOUNT_FLOOR_SCORE     = 0.45       # minimum score for very high amounts
VERY_HIGH_AMOUNT_THRESHOLD  = 1_000_000  # ₹10 lakh+  
VERY_HIGH_AMOUNT_FLOOR      = 0.60       # minimum score for ₹10 lakh+
CRORE_THRESHOLD             = 10_000_000 # ₹1 crore+
CRORE_FLOOR                 = 0.72       # minimum score for crore-level transactions


# ──────────────────────────────────────────────────────────────────────────────
# MODEL
# ──────────────────────────────────────────────────────────────────────────────

class MuleHunterGNN(torch.nn.Module):
    def __init__(self, in_channels: int, hidden: int = 128, out: int = 2) -> None:
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden)
        self.bn1   = BatchNorm(hidden)
        self.conv2 = GATConv(hidden, hidden, heads=4, concat=False,
                              dropout=0.10, add_self_loops=False)
        self.bn2   = BatchNorm(hidden)
        self.conv3 = SAGEConv(hidden, hidden // 2)
        self.bn3   = BatchNorm(hidden // 2)
        self.skip  = torch.nn.Linear(in_channels, hidden // 2)
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(hidden // 2, 64),
            torch.nn.BatchNorm1d(64),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.15),
            torch.nn.Linear(64, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.05),
            torch.nn.Linear(32, out),
        )

    def forward(
        self,
        x: torch.Tensor,
        edge_index: torch.Tensor,
        return_embedding: bool = False,
    ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
        identity  = self.skip(x)
        x = F.relu(self.bn1(self.conv1(x, edge_index)))
        x = F.dropout(x, p=0.10, training=self.training)
        x = F.relu(self.bn2(self.conv2(x, edge_index)))
        x = F.dropout(x, p=0.10, training=self.training)
        x = F.relu(self.bn3(self.conv3(x, edge_index)))
        embedding = x + identity
        logits    = F.log_softmax(self.classifier(embedding), dim=1)
        if return_embedding:
            return logits, embedding
        return logits


# ──────────────────────────────────────────────────────────────────────────────
# REQUEST / RESPONSE SCHEMAS
# ──────────────────────────────────────────────────────────────────────────────

class TransactionRequest(BaseModel):
    source_id:   str
    target_id:   str
    amount:      float = Field(gt=0)
    timestamp:   str   = "2025-01-01T00:00:00"
    device_type: Optional[str] = "unknown"


class BatchRequest(BaseModel):
    transactions: List[TransactionRequest]


class GraphFeatures(BaseModel):
    suspiciousNeighborCount: int   = 0
    twoHopFraudDensity:      float = 0.0
    connectivityScore:       float = 0.0


class IdentityFeatures(BaseModel):
    ja3Reuse:    int = 0
    deviceReuse: int = 0
    ipReuse:     int = 0


class BehaviorFeatures(BaseModel):
    velocity: float = 0.0
    burst:    float = 0.0


class GnnScoreRequest(BaseModel):
    """
    [FIX v3.2] Accept BOTH 'sourceAccountId' (canonical) AND legacy 'accountId'
    field that Spring Boot was sending.

    Root cause: AiRiskService.java was sending payload key "accountId" but the
    schema had 'sourceAccountId' as a required Field(...). FastAPI returned 422
    which was silently swallowed → gnnScore=0 everywhere.

    Fix strategy: make sourceAccountId Optional with default None, also accept
    accountId as an alias, then resolve in a model_validator. This preserves
    full backward compatibility with both Spring Boot and the test suite.
    """
    # Primary canonical field
    sourceAccountId: Optional[str] = Field(
        None,
        description="Sender account ID. Use this field (canonical).",
    )
    # [FIX] Backward-compat alias — Spring Boot AiRiskService was sending this
    accountId: Optional[str] = Field(
        None,
        description="Legacy alias for sourceAccountId. Accepted for backward compatibility.",
    )
    targetAccountId:   Optional[str] = Field(None, description="Receiver account ID.")
    transactionAmount: float         = Field(0.0, ge=0.0)
    graphFeatures:    GraphFeatures    = Field(default_factory=GraphFeatures)
    identityFeatures: IdentityFeatures = Field(default_factory=IdentityFeatures)
    behaviorFeatures: BehaviorFeatures = Field(default_factory=BehaviorFeatures)

    @model_validator(mode="after")
    def resolve_source_account(self) -> "GnnScoreRequest":
        """
        [FIX] Resolve sourceAccountId from accountId alias if not already set.
        Raises validation error only if NEITHER field is provided.
        """
        if not self.sourceAccountId and self.accountId:
            self.sourceAccountId = self.accountId
            logger.debug(
                "GnnScoreRequest: resolved sourceAccountId from legacy accountId field: %s",
                self.accountId,
            )
        if not self.sourceAccountId:
            raise ValueError(
                "Either 'sourceAccountId' or 'accountId' must be provided and non-empty."
            )
        return self

    model_config = {
        "json_schema_extra": {
            "example": {
                "sourceAccountId":   "12345",
                "targetAccountId":   "67890",
                "transactionAmount": 45000.0,
                "graphFeatures": {
                    "suspiciousNeighborCount": 2,
                    "twoHopFraudDensity":      0.35,
                    "connectivityScore":       0.0
                },
                "identityFeatures": {
                    "ja3Reuse":    0,
                    "deviceReuse": 1,
                    "ipReuse":     0
                },
                "behaviorFeatures": {
                    "velocity": 0.4,
                    "burst":    0.1
                }
            }
        }
    }


class RiskResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    node_id:            str
    risk_score:         float
    verdict:            str
    risk_level:         int
    risk_factors:       List[str]
    out_degree:         int
    in_degree:          int
    community_risk:     float
    ring_detected:      bool
    network_centrality: float
    linked_accounts:    List[str]
    population_size:    int
    latency_ms:         float
    model_version:      str


class RingReport(BaseModel):
    rings_detected:  int
    rings:           List[Dict[str, Any]]
    high_risk_nodes: List[str]


class ClusterReport(BaseModel):
    total_clusters:     int
    high_risk_clusters: int
    top_clusters:       List[Dict[str, Any]]


class GnnScoreResponse(BaseModel):
    """Full schema matching gnn_engineer_responsibilities_v2."""
    model:   str
    version: str
    entity:            Dict[str, Any]
    scores:            Dict[str, Any]
    fraudCluster:      Dict[str, Any]
    networkMetrics:    Dict[str, Any]
    muleRingDetection: Dict[str, Any]
    riskFactors:       List[str]
    embedding:         Dict[str, float]
    timestamp:         str
    # Flat mirrors for Spring Boot + test_my_work.py
    gnnScore:          float
    confidence:        float
    fraudClusterId:    int
    embeddingNorm:     float
    sourceAccountId:   str
    targetAccountId:   Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# FEATURE COLUMNS
# ──────────────────────────────────────────────────────────────────────────────

FEATURE_COLS: list[str] = [
    "account_age_days", "balance_mean", "balance_std",
    "tx_count", "tx_velocity_7d", "fan_out_ratio",
    "amount_entropy", "risky_email", "device_mobile",
    "device_consistency", "addr_entropy", "d_gap_mean",
    "card_network_risk", "product_code_risk", "international_flag",
    "pagerank", "in_out_ratio", "reciprocity_score",
    "community_fraud_rate", "ring_membership",
    "second_hop_fraud_rate",
]

RISK_FACTOR_RULES: list[tuple] = [
    ("fan_out_ratio",         0.7,  "High fan-out: distributing funds to many accounts"),
    ("tx_velocity_7d",        10.0, "Burst activity: unusually high recent transaction volume"),
    ("reciprocity_score",     0.3,  "Circular flows detected: money bouncing back"),
    ("ring_membership",       1.0,  "Node participates in a known laundering ring"),
    ("community_fraud_rate",  0.3,  "Embedded in a high-risk fraud community"),
    ("second_hop_fraud_rate", 0.4,  "Two-hop neighbourhood has elevated fraud density"),
    ("risky_email",           0.5,  "Associated with high-risk or anonymous email domain"),
    ("international_flag",    0.6,  "High cross-border transaction ratio"),
    ("pagerank",              0.8,  "High centrality: hub in transaction network"),
    ("in_out_ratio",          5.0,  "Abnormal inflow vs outflow ratio"),
]


# ──────────────────────────────────────────────────────────────────────────────
# GLOBAL STATE
# ──────────────────────────────────────────────────────────────────────────────

model:       Optional[MuleHunterGNN] = None
base_graph:  Optional[Data]          = None
node_df:     Optional[pd.DataFrame]  = None
nx_graph:    Optional[nx.DiGraph]    = None
norm_params: Optional[dict]          = None
model_meta:  Optional[dict]          = None
id_map:      Dict[str, int]          = {}
rev_map:     Dict[int, str]          = {}

_rings_cache:   List[Dict[str, Any]]                = []
_logit_cache:   Dict[str, tuple[float,float,float]] = {}
_unknown_cache: Dict[str, tuple[float,float,float]] = {}

_new_node_baseline: Optional[tuple[float, float, float]] = None

_initialized = False
_init_lock   = Lock()


# ──────────────────────────────────────────────────────────────────────────────
# STARTUP HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _precache_rings(g: nx.DiGraph, account_nodes: set) -> List[Dict[str, Any]]:
    rings: List[Dict[str, Any]]    = []
    seen_ring_sets: set[frozenset] = set()
    sub      = g.subgraph([n for n in g.nodes() if n in account_nodes]).copy()
    deadline = time.monotonic() + RING_TIMEOUT_SEC

    for start in list(sub.nodes()):
        if time.monotonic() > deadline or len(rings) >= MAX_RINGS_CACHED:
            break
        stack = [(start, [start])]
        while stack:
            if time.monotonic() > deadline or len(rings) >= MAX_RINGS_CACHED:
                break
            node, path = stack.pop()
            for nb in sub.successors(node):
                if len(path) > 6:
                    break
                if nb == start and len(path) >= 3:
                    key = frozenset(path)
                    if key not in seen_ring_sets:
                        seen_ring_sets.add(key)
                        vol = sum(
                            sub[path[i]][path[(i + 1) % len(path)]].get("weight", 0)
                            for i in range(len(path))
                        )
                        rings.append({
                            "nodes":  path[:],
                            "size":   len(path),
                            "volume": round(float(vol), 2),
                            "risk":   round(float(min(1.0, vol / 50_000)), 4),
                        })
                elif nb not in path:
                    stack.append((nb, path + [nb]))

    rings.sort(key=lambda r: r["volume"], reverse=True)
    logger.info("Ring pre-cache: %d rings found", len(rings))
    return rings


def _build_logit_cache(mdl: MuleHunterGNN, graph: Data) -> None:
    logger.info("Pre-computing logit cache for all known nodes...")
    mdl.eval()
    with torch.no_grad():
        logits, embeddings = mdl(graph.x, graph.edge_index, return_embedding=True)
        probs = logits.exp()
        norms = torch.norm(embeddings, p=2, dim=1)

    for nid, idx in id_map.items():
        _logit_cache[nid] = (
            float(probs[idx, 1]),
            float(abs(probs[idx, 1] - probs[idx, 0])),
            float(norms[idx]),
        )
    logger.info("  Logit cache built for %s nodes", f"{len(_logit_cache):,}")


def load_assets() -> None:
    global model, base_graph, node_df, nx_graph, norm_params, model_meta
    global id_map, rev_map, _rings_cache, _initialized

    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return

        logger.info("Initialising MuleHunter AI v3.2...")

        if not MODEL_PATH.exists() or not GRAPH_PATH.exists():
            logger.error("Required assets missing — run train_model.py first")
            return

        base_graph      = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)
        actual_features = base_graph.x.shape[1]
        logger.info("  Graph: %s nodes | %d features", f"{base_graph.num_nodes:,}", actual_features)

        if NODES_PATH.exists():
            node_df = pd.read_csv(NODES_PATH)
            node_df["node_id"] = node_df["node_id"].astype(str)
            if "community_id" not in node_df.columns:
                node_df["community_id"] = 0
            id_map  = {nid: i for i, nid in enumerate(node_df["node_id"])}
            rev_map = {i: nid for nid, i in id_map.items()}
            logger.info("  Metadata: %s nodes loaded", f"{len(node_df):,}")

        if NORM_PATH.exists():
            with open(NORM_PATH) as f:
                norm_params = json.load(f)
            logger.info("  Norm params loaded (%d features)", len(norm_params.get("feature_cols", [])))
        else:
            logger.warning("  norm_params.json not found")

        tx_path = SHARED_DATA / "transactions.csv"
        if tx_path.exists():
            df_tx = pd.read_csv(tx_path)
            df_tx["amount"] = pd.to_numeric(df_tx["amount"], errors="coerce").fillna(1.0)
            df_tx = df_tx.rename(columns={"amount": "weight"})
            nx_graph = nx.from_pandas_edgelist(
                df_tx, source="source", target="target",
                edge_attr="weight", create_using=nx.DiGraph(),
            )
            logger.info("  NetworkX graph: %s edges", f"{nx_graph.number_of_edges():,}")

            account_node_set = set(id_map.keys()) if id_map else set()
            logger.info("Pre-caching rings (bounded %ds)...", RING_TIMEOUT_SEC)
            _rings_cache = _precache_rings(nx_graph, account_node_set)

        hidden_ch = 128
        if META_PATH.exists():
            with open(META_PATH) as f:
                model_meta = json.load(f)
            hidden_ch = model_meta.get("hidden_channels", 128)

        model = MuleHunterGNN(in_channels=actual_features, hidden=hidden_ch)
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu", weights_only=True))
        model.eval()

        if base_graph is not None:
            _build_logit_cache(model, base_graph)
            _compute_new_node_baseline(model, base_graph)

        _initialized = True
        ver = model_meta.get("version", "unknown") if model_meta else "unknown"
        logger.info("MuleHunter AI READY | version=%s", ver)


# ──────────────────────────────────────────────────────────────────────────────
# INFERENCE CORE
# ──────────────────────────────────────────────────────────────────────────────

def _compute_new_node_baseline(mdl: MuleHunterGNN, graph: Data) -> None:
    global _new_node_baseline

    mdl.eval()
    median_feat = torch.median(graph.x, dim=0).values.unsqueeze(0).float()

    with torch.no_grad():
        identity = mdl.skip(median_feat)
        self_loop = torch.tensor([[0], [0]], dtype=torch.long)
        x1 = median_feat

        x1 = F.relu(mdl.bn1(mdl.conv1(x1, self_loop)))
        x1 = F.relu(mdl.bn2(mdl.conv2(x1, self_loop)))
        x1 = F.relu(mdl.bn3(mdl.conv3(x1, self_loop)))

        embedding = x1 + identity
        logits    = F.log_softmax(mdl.classifier(embedding), dim=1)
        probs     = logits.exp()

        baseline_risk = float(probs[0, 1])
        baseline_conf = float(abs(probs[0, 1] - probs[0, 0]))
        baseline_emb  = float(torch.norm(embedding, p=2).item())

    _new_node_baseline = (baseline_risk, baseline_conf, baseline_emb)
    logger.info(
        "New-node baseline computed: risk=%.4f  conf=%.4f  emb_norm=%.4f",
        baseline_risk, baseline_conf, baseline_emb,
    )


def _infer_known_node(account_id: str) -> tuple[float, float, float]:
    return _logit_cache[account_id]


def _infer_new_node(account_id: str) -> tuple[float, float, float]:
    if account_id in _unknown_cache:
        return _unknown_cache[account_id]

    if _new_node_baseline is not None:
        base_risk, base_conf, base_emb = _new_node_baseline
    else:
        base_risk, base_conf, base_emb = 0.25, 0.10, 1.0

    mlp_risk = base_risk
    conf     = base_conf
    embnm    = base_emb

    if nx_graph is not None and nx_graph.has_node(account_id):
        nb_scores = [
            _logit_cache[nb][0]
            for nb in (list(nx_graph.predecessors(account_id)) +
                       list(nx_graph.successors(account_id)))
            if nb in _logit_cache
        ]
        if nb_scores:
            nb_mean  = float(np.mean(nb_scores))
            nb_max   = float(np.max(nb_scores))
            mlp_risk = float(np.clip(
                0.70 * mlp_risk + 0.20 * nb_mean + 0.10 * nb_max,
                0.0, 1.0,
            ))

    mlp_risk = min(mlp_risk, NEW_ACCOUNT_SCORE_CAP)

    result = (mlp_risk, conf, embnm)
    if len(_unknown_cache) >= UNKNOWN_NODE_CACHE_MAX:
        _unknown_cache.pop(next(iter(_unknown_cache)))
    _unknown_cache[account_id] = result
    return result


def _score_account(account_id: str) -> tuple[float, float, float]:
    if account_id in _logit_cache:
        return _infer_known_node(account_id)
    return _infer_new_node(account_id)


def _blend_src_tgt(
    src_id: str,
    tgt_id: Optional[str],
) -> tuple[float, float, float, bool]:
    src_risk, src_conf, src_emb = _score_account(src_id)
    is_known_src = src_id in _logit_cache

    if tgt_id and tgt_id != src_id:
        tgt_risk, _, _ = _score_account(tgt_id)
        blended = float(np.clip(
            0.80 * src_risk + 0.20 * tgt_risk,
            max(src_risk, tgt_risk * 0.50),
            1.0,
        ))
        logger.debug(
            "Dual-account blend: src=%s(%.3f) tgt=%s(%.3f) → %.3f",
            src_id, src_risk, tgt_id, tgt_risk, blended,
        )
        return blended, src_conf, src_emb, is_known_src

    return src_risk, src_conf, src_emb, is_known_src


# ──────────────────────────────────────────────────────────────────────────────
# AMOUNT ADJUSTMENT
# ──────────────────────────────────────────────────────────────────────────────

def _amount_multiplier(amount: float) -> float:
    amt = max(0.0, float(amount))
    if amt == 0:            return 0.80
    if amt < 50:            return 0.30
    if amt < 200:           return 0.42
    if amt < 500:           return 0.55
    if amt < 1_000:         return 0.68
    if amt < 5_000:         return 0.88
    if amt < 10_000:        return 0.96
    if amt < 50_000:        return 1.00
    if amt < 1_00_000:      return 1.08
    return 1.18

def _transaction_adjusted_risk(base_risk: float, amount: float) -> float:
    amt = max(0.0, float(amount))

    # Amount weight: dampens small txns, amplifies large ones
    if amt <= 0:            amount_weight = 0.30
    elif amt < 100:         amount_weight = 0.40   # ₹0-100: heavy dampen
    elif amt < 500:         amount_weight = 0.55   # ₹100-500: moderate dampen
    elif amt < 2_000:       amount_weight = 0.75   # ₹500-2k
    elif amt < 10_000:      amount_weight = 0.90   # ₹2k-10k
    elif amt < 1_00_000:    amount_weight = 1.00   # ₹10k-1L: full score
    elif amt < 10_00_000:   amount_weight = 1.10   # ₹1L-10L: amplify
    else:                   amount_weight = 1.20   # ₹10L+: strong amplify

    # Preserve at least 35% of graph signal always
    graph_floor = base_risk * 0.35
    blended = max(graph_floor, base_risk * amount_weight)

    # ── HIGH AMOUNT FLOORS ────────────────────────────────────────────────
    # A 2-crore transaction being scored 0.01 is a demo killer.
    # Even with zero graph context, high-value transactions warrant scrutiny.
    if amt >= CRORE_THRESHOLD:
        blended = max(blended, CRORE_FLOOR)           # ₹1 crore+ → min 0.72
    elif amt >= VERY_HIGH_AMOUNT_THRESHOLD:
        blended = max(blended, VERY_HIGH_AMOUNT_FLOOR) # ₹10L+ → min 0.60
    elif amt >= HIGH_AMOUNT_FLOOR_THRESHOLD:
        blended = max(blended, HIGH_AMOUNT_FLOOR_SCORE) # ₹1L+ → min 0.45

    return float(np.clip(blended, 0.0, 1.0))


# ──────────────────────────────────────────────────────────────────────────────
# EXPLAINABILITY HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _get_node_features(account_id: str) -> dict:
    if node_df is None or account_id not in id_map:
        return {}
    r = node_df.iloc[id_map[account_id]]
    return {col: float(r[col]) for col in FEATURE_COLS if col in r.index}


def _build_risk_factors(features: dict, risk: float) -> List[str]:
    factors: List[str] = []
    for col, threshold, message in RISK_FACTOR_RULES:
        if features.get(col, 0.0) > threshold:
            factors.append(message)
    if 0.0 < features.get("amount_entropy", 1.0) < 0.15:
        factors.append("Low amount diversity: possible smurfing pattern")
    if not factors and risk > 0.5:
        factors.append("Anomalous transaction graph pattern detected")
    return factors


def _risk_level_str(score: float, threshold: float) -> str:
    return "HIGH" if score >= min(0.95, threshold + 0.15) else "MEDIUM" if score >= threshold else "LOW"


def _risk_level_int(score: float, threshold: float) -> int:
    return 2 if score >= min(0.95, threshold + 0.15) else 1 if score >= threshold else 0


# ──────────────────────────────────────────────────────────────────────────────
# RING TOPOLOGY HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _classify_ring_shape(ring_nodes: list, g: nx.DiGraph) -> str:
    if len(ring_nodes) < 3:
        return "CYCLE"
    sub     = g.subgraph(ring_nodes)
    n       = len(ring_nodes)
    max_deg = max((sub.out_degree(nd) for nd in ring_nodes), default=0)
    density = sub.number_of_edges() / max(n * (n - 1), 1)
    if max_deg >= n * 0.6:
        return "STAR"
    if density >= 0.6:
        return "DENSE_CLUSTER"
    if sum(1 for nd in ring_nodes if sub.out_degree(nd) <= 1) >= n * 0.4:
        return "CHAIN"
    return "CYCLE"


def _classify_role(account_id: str, ring_nodes: list, g: nx.DiGraph) -> tuple[str, str]:
    if not g.has_node(account_id) or len(ring_nodes) < 2:
        return "MULE", (ring_nodes[0] if ring_nodes else account_id)
    sub      = g.subgraph(ring_nodes)
    out_degs = {nd: sub.out_degree(nd) for nd in ring_nodes}
    hub      = max(out_degs, key=out_degs.get)
    try:
        bc     = nx.betweenness_centrality(sub)
        avg_bc = sum(bc.values()) / max(len(bc), 1)
        if bc.get(account_id, 0) > avg_bc * 2.0 and account_id != hub:
            return "BRIDGE", hub
    except Exception:
        pass
    return ("HUB", hub) if account_id == hub else ("MULE", hub)


# ──────────────────────────────────────────────────────────────────────────────
# APP
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_assets()
    yield


app = FastAPI(
    title       ="MuleHunter AI — Elite Fraud Detection",
    description ="Real-time GNN-based mule account detection for UPI / fintech",
    version     ="3.2.0",
    lifespan    =lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ──────────────────────────────────────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health() -> dict:
    if _initialized and model is not None:
        return {
            "status":               "HEALTHY",
            "model_loaded":         True,
            "nodes_count":          base_graph.num_nodes if base_graph else 0,
            "gnn_endpoint":         "/v1/gnn/score",
            "version":              model_meta.get("version", "unknown") if model_meta else "unknown",
            "test_f1":              model_meta.get("test_f1",  0.0) if model_meta else 0.0,
            "test_auc":             model_meta.get("test_auc", 0.0) if model_meta else 0.0,
            "optimal_threshold":    model_meta.get("optimal_threshold", 0.5) if model_meta else 0.5,
            "rings_cached":         len(_rings_cache),
            "logit_cache_size":     len(_logit_cache),
            "low_amount_cap_inr":   LOW_AMOUNT_HARD_CAP,
            "low_amount_score_cap": LOW_AMOUNT_SCORE_CAP,
        }
    return {"status": "UNAVAILABLE", "model_loaded": False, "nodes_count": 0}


@app.get("/metrics")
def metrics() -> dict:
    if not EVAL_PATH.exists():
        raise HTTPException(404, "Eval report not found — run train_model.py first")
    with open(EVAL_PATH) as f:
        return json.load(f)


@app.post("/analyze-transaction", response_model=RiskResponse)
def analyze(tx: TransactionRequest) -> RiskResponse:
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    t0  = time.perf_counter()
    src = str(tx.source_id)
    tgt = str(tx.target_id)

    raw_risk, conf, _, is_known_src = _blend_src_tgt(src, tgt)
    risk      = _transaction_adjusted_risk(raw_risk, tx.amount)
    features  = _get_node_features(src)
    threshold = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    latency   = (time.perf_counter() - t0) * 1_000

    level   = _risk_level_int(risk, threshold)
    verdict = ["SAFE", "SUSPICIOUS", "CRITICAL - MULE ACCOUNT"][level]

    linked: List[str] = []
    if nx_graph and src in nx_graph:
        linked = [str(n) for n in list(nx_graph.successors(src))[:10]]

    out_deg = in_deg = 0
    if src in id_map:
        idx     = id_map[src]
        out_deg = int((base_graph.edge_index[0] == idx).sum())
        in_deg  = int((base_graph.edge_index[1] == idx).sum())

    return RiskResponse(
        node_id            =src,
        risk_score         =round(risk, 4),
        verdict            =verdict,
        risk_level         =level,
        risk_factors       =_build_risk_factors(features, risk),
        out_degree         =out_deg,
        in_degree          =in_deg,
        community_risk     =round(features.get("community_fraud_rate", 0.0), 4),
        ring_detected      =features.get("ring_membership", 0.0) > 0,
        network_centrality =round(features.get("pagerank", 0.0), 6),
        linked_accounts    =linked,
        population_size    =base_graph.num_nodes if base_graph else 0,
        latency_ms         =round(latency, 2),
        model_version      =model_meta.get("version", "unknown") if model_meta else "unknown",
    )


@app.post("/analyze-batch")
def analyze_batch(req: BatchRequest) -> dict:
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    threshold = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    results   = []

    for tx in req.transactions[:100]:
        try:
            t0  = time.perf_counter()
            src = str(tx.source_id)
            tgt = str(tx.target_id)
            raw_risk, _, _, _ = _blend_src_tgt(src, tgt)
            risk    = _transaction_adjusted_risk(raw_risk, tx.amount)
            lat     = (time.perf_counter() - t0) * 1_000
            level   = _risk_level_int(risk, threshold)
            verdict = ["SAFE", "SUSPICIOUS", "CRITICAL"][level]
            results.append({
                "source_id":  src,
                "target_id":  tgt,
                "risk_score": round(risk, 4),
                "verdict":    verdict,
                "latency_ms": round(lat, 2),
            })
        except Exception as exc:
            results.append({"source_id": str(tx.source_id), "error": str(exc)})

    return {
        "count":   len(results),
        "flagged": sum(1 for r in results if r.get("verdict") in ("CRITICAL", "SUSPICIOUS")),
        "results": results,
    }


@app.get("/detect-rings")
def detect_rings_endpoint(max_size: int = 6, limit: int = 20) -> RingReport:
    if not nx_graph:
        raise HTTPException(503, "Graph not loaded")
    filtered        = [r for r in _rings_cache if r["size"] <= max_size][:limit]
    high_risk_nodes = list({n for r in filtered[:5] for n in r["nodes"]})
    return RingReport(
        rings_detected =len(filtered),
        rings          =filtered,
        high_risk_nodes=high_risk_nodes,
    )


@app.get("/cluster-report")
def cluster_report() -> ClusterReport:
    if node_df is None:
        raise HTTPException(503, "Node data not loaded")
    if "community_fraud_rate" not in node_df.columns:
        raise HTTPException(400, "Run feature_engineering.py to compute communities")

    buckets = pd.cut(
        node_df["community_fraud_rate"],
        bins=[0, 0.1, 0.3, 0.6, 1.01],
        labels=["Low", "Medium", "High", "Critical"],
    )
    dist      = buckets.value_counts().to_dict()
    top_nodes = node_df.nlargest(10, "community_fraud_rate")[
        ["node_id", "community_fraud_rate", "is_fraud"]
    ].to_dict("records")

    return ClusterReport(
        total_clusters     =int(node_df["community_id"].nunique()),
        high_risk_clusters =int(dist.get("High", 0) + dist.get("Critical", 0)),
        top_clusters       =top_nodes,
    )


@app.get("/network-snapshot")
def network_snapshot(limit: int = 200) -> dict:
    if node_df is None or nx_graph is None:
        raise HTTPException(503, "Data not loaded")

    risk_col  = "community_fraud_rate" if "community_fraud_rate" in node_df.columns else "pagerank"
    top_df    = node_df.nlargest(limit, risk_col)
    nodes_out = [
        {
            "id":       str(row["node_id"]),
            "is_fraud": int(row.get("is_fraud", 0)),
            "risk":     round(float(row.get(risk_col, 0)), 4),
            "ring":     int(row.get("ring_membership", 0)) > 0,
            "pagerank": round(float(row.get("pagerank", 0)), 6),
        }
        for _, row in top_df.iterrows()
    ]
    node_ids  = {n["id"] for n in nodes_out}
    edges_out = [
        {"source": u, "target": v, "weight": round(d.get("weight", 1.0), 2)}
        for u, v, d in nx_graph.edges(data=True)
        if u in node_ids and v in node_ids
    ][:500]

    return {
        "nodes": nodes_out,
        "edges": edges_out,
        "stats": {
            "total_nodes": base_graph.num_nodes if base_graph else 0,
            "total_edges": nx_graph.number_of_edges(),
            "fraud_nodes": int(node_df["is_fraud"].sum()),
            "fraud_rate":  round(float(node_df["is_fraud"].mean()), 4),
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# /v1/gnn/score — FULL CONTRACT ENDPOINT
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/v1/gnn/score", response_model=GnnScoreResponse)
def gnn_score(request: GnnScoreRequest) -> GnnScoreResponse:
    """
    Full GNN scoring endpoint.

    [FIX v3.2] Accepts both 'sourceAccountId' (canonical) and 'accountId' (legacy
    alias from Spring Boot AiRiskService). The model_validator on GnnScoreRequest
    resolves the alias transparently, so this function always receives a valid
    sourceAccountId.
    """
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    # ── Resolve source and destination ──────────────────────────────────────
    src_id = str(request.sourceAccountId).strip()
    tgt_id = str(request.targetAccountId).strip() if request.targetAccountId else None

    if not src_id:
        raise HTTPException(422, "sourceAccountId must be a non-empty string")

    logger.info("GNN score request: src=%s tgt=%s amount=%.2f",
                src_id, tgt_id, request.transactionAmount)

    # ── 1. Raw GNN score ────────────────────────────────────────────────────
    raw_score, confidence, embedding_norm, is_known_src = _blend_src_tgt(src_id, tgt_id)

    # ── 2. Blend Spring Boot context features ────────────────────────────────
    g        = request.graphFeatures
    id_feat  = request.identityFeatures
    beh_feat = request.behaviorFeatures
    has_context = (
        g.suspiciousNeighborCount > 0 or g.twoHopFraudDensity > 0
        or g.connectivityScore    > 0
        or beh_feat.velocity > 0 or beh_feat.burst > 0
        or id_feat.deviceReuse > 0 or id_feat.ipReuse > 0
    )

    if has_context:
        gnn_score_val = float(np.clip(
            0.68 * raw_score
            + 0.16 * max(0.0, min(1.0, g.twoHopFraudDensity))
            + 0.08 * min(1.0, g.suspiciousNeighborCount / 10.0)
            + 0.04 * max(0.0, min(1.0, beh_feat.velocity))
            + 0.02 * max(0.0, min(1.0, beh_feat.burst))
            + 0.01 * min(1.0, id_feat.deviceReuse / 10.0)
            + 0.01 * min(1.0, id_feat.ipReuse / 10.0),
            0.0, 1.0,
        ))
    else:
        gnn_score_val = raw_score

    # ── 2b. Amount adjustment ────────────────────────────────────────────────
    gnn_score_val  = _transaction_adjusted_risk(gnn_score_val, request.transactionAmount)
    gnn_score_val  = round(gnn_score_val,  6)
    confidence     = round(confidence,     6)
    embedding_norm = round(embedding_norm, 6)

    # ── 3. Risk level ─────────────────────────────────────────────────────────
    threshold  = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    risk_level = _risk_level_str(gnn_score_val, threshold)

    # ── 4. Node metadata ──────────────────────────────────────────────────────
    node_row = None
    if node_df is not None and is_known_src:
        rows = node_df[node_df["node_id"] == src_id]
        if not rows.empty:
            node_row = rows.iloc[0]

    # ── 5. Fraud cluster ──────────────────────────────────────────────────────
    cluster_id = cluster_size = 0
    cluster_risk_score = 0.0
    if node_row is not None and node_df is not None:
        cluster_id = int(node_row.get("community_id", 0))
        if "community_id" in node_df.columns:
            cluster_size = int((node_df["community_id"] == cluster_id).sum())
        if "community_fraud_rate" in node_df.columns:
            mask = node_df["community_id"] == cluster_id
            cluster_risk_score = round(float(node_df.loc[mask, "community_fraud_rate"].mean()), 4)

    # ── 6. Network metrics ────────────────────────────────────────────────────
    suspicious_neighbors = g.suspiciousNeighborCount
    shared_devices       = id_feat.deviceReuse
    shared_ips           = id_feat.ipReuse
    centrality_score     = 0.0
    transaction_loops    = False

    if node_row is not None:
        centrality_score  = round(float(node_row.get("pagerank", 0.0)), 6)
        transaction_loops = float(node_row.get("reciprocity_score", 0.0)) > 0.1

    if nx_graph and src_id in nx_graph and node_df is not None and "is_fraud" in node_df.columns:
        fraud_set    = set(node_df.loc[node_df["is_fraud"] == 1, "node_id"].astype(str))
        live_count   = sum(1 for n in nx_graph.successors(src_id) if n in fraud_set)
        suspicious_neighbors = max(suspicious_neighbors, live_count)

    # ── 7. Mule ring detection ────────────────────────────────────────────────
    is_ring_member = node_row is not None and float(node_row.get("ring_membership", 0)) > 0
    ring_id        = 0
    ring_shape     = "CYCLE"
    ring_size      = 1
    role           = "MULE"
    hub_account    = src_id
    ring_accounts: List[str] = []

    for i, ring in enumerate(_rings_cache):
        if src_id in ring.get("nodes", []):
            is_ring_member = True
            ring_id        = i
            ring_accounts  = ring["nodes"]
            ring_size      = ring["size"]
            if nx_graph:
                ring_shape        = _classify_ring_shape(ring_accounts, nx_graph)
                role, hub_account = _classify_role(src_id, ring_accounts, nx_graph)
            break

    # ── 8. Risk factors ───────────────────────────────────────────────────────
    node_features: dict = (
        {col: float(node_row[col]) for col in FEATURE_COLS if col in node_row.index}
        if node_row is not None else {}
    )
    risk_factors = _build_risk_factors(node_features, gnn_score_val)
    if is_ring_member:
        risk_factors.append(f"member_of_{ring_shape.lower()}_mule_ring")
    if suspicious_neighbors > 3:
        risk_factors.append("connected_to_high_risk_accounts")
    if shared_devices > 1:
        risk_factors.append("shared_device_with_multiple_accounts")
    if transaction_loops:
        risk_factors.append("rapid_pass_through_transactions")
    if tgt_id:
        tgt_risk_raw, _, _ = _score_account(tgt_id)
        if tgt_risk_raw > threshold:
            risk_factors.append(f"destination_account_{tgt_id}_is_high_risk")
    # Deduplicate preserving order
    seen_rf: set = set()
    risk_factors = [f for f in risk_factors if not (f in seen_rf or seen_rf.add(f))]  # type: ignore

    version = model_meta.get("version", "GNN-v3") if model_meta else "GNN-v3"

    logger.info(
        "GNN score result: src=%s gnnScore=%.4f confidence=%.4f riskLevel=%s",
        src_id, gnn_score_val, confidence, risk_level,
    )

    return GnnScoreResponse(
        model   ="GNN",
        version =version,

        entity={
            "type":            "ACCOUNT",
            "sourceAccountId": src_id,
            "targetAccountId": tgt_id,
        },

        scores={
            "gnnScore":   gnn_score_val,
            "confidence": confidence,
            "riskLevel":  risk_level,
        },

        fraudCluster={
            "clusterId":        cluster_id,
            "clusterSize":      cluster_size,
            "clusterRiskScore": cluster_risk_score,
        },

        networkMetrics={
            "suspiciousNeighbors": suspicious_neighbors,
            "sharedDevices":       shared_devices,
            "sharedIPs":           shared_ips,
            "centralityScore":     centrality_score,
            "transactionLoops":    transaction_loops,
        },

        muleRingDetection={
            "isMuleRingMember": is_ring_member,
            "ringId":           ring_id,
            "ringShape":        ring_shape,
            "ringSize":         ring_size,
            "role":             role,
            "hubAccount":       hub_account,
            "ringAccounts":     ring_accounts,
        },

        riskFactors =risk_factors,
        embedding   ={"embeddingNorm": embedding_norm},
        timestamp   =datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),

        # Flat mirrors — always populated so Spring Boot mapAiResponse can read them
        gnnScore        =gnn_score_val,
        confidence      =confidence,
        fraudClusterId  =cluster_id,
        embeddingNorm   =embedding_norm,
        sourceAccountId =src_id,
        targetAccountId =tgt_id,
    )