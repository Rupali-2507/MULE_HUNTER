# 🔍 MuleHunter AI — ai-engine

> Real-time Graph Neural Network fraud detection. Hunts money mule accounts, laundering rings, and collusive fraud clusters in UPI payment networks — before the money disappears.

---

## ✅ Verified Performance — Full IEEE-CIS Dataset (590k transactions)

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│    AUC-ROC       │    F1 Score      │    Precision     │    Recall        │
│    0.9906        │    0.8604        │    0.8669        │    0.8539        │
│  ✅ Target >0.90 │  ✅ Target >0.80 │  1.9% false alarm│  85.4% caught    │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Inference       │  Ring Detection  │  Graph Size      │  Training Time   │
│  < 50ms          │  300 rings       │  14,318 nodes    │  ~26 min CPU     │
│  O(1) cache      │  11,343 clusters │  75,488 edges    │  450 epochs      │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Confusion Matrix (test set — 2,149 nodes, 267 fraud):**
```
                  Predicted Safe    Predicted Fraud
Actual Safe            1,847               35       ← 1.9% false alarm rate
Actual Fraud              39              228       ← 85.4% of fraudsters caught
```
Threshold: `0.8644` (tuned on val set). Default-0.5 F1 was `0.7747` — threshold tuning alone added **+0.086 F1**.

> Improvement over 100k-row run: F1 `0.7344 → 0.8604` (+0.126) · Recall `0.6620 → 0.8539` (+0.192) · AUC `0.9821 → 0.9906` (+0.0085)

---

## What Problem Does This Solve?

Traditional fraud detection asks: *"Does this transaction look suspicious?"*

MuleHunter asks: *"Does this **entire network of accounts and relationships** look suspicious?"*

An account sending ₹500 to five people looks clean. But connect it to the graph and you see it's the hub of a 12-node star ring bouncing stolen UPI funds between burner accounts. That pattern is invisible to tabular ML — it only exists in the graph.

India's UPI system processes **500 crore+ transactions per month**. Even 0.1% fraud = 50 lakh fraudulent transactions. MuleHunter is built to catch them at network level.

---

## Pipeline Overview

```
IEEE-CIS Dataset (590,540 transactions · 434 columns)
         │
         ▼
  ┌─────────────────┐
  │ data_generator  │  ← 15 per-account fraud signals
  │      .py        │    smurfing · velocity · device · email · addr
  └────────┬────────┘    ~2 min · outputs: nodes.csv + transactions.csv
           │
           ▼
  ┌──────────────────────┐
  │ feature_engineering  │  ← Graph build + 6 graph-level features
  │       .py            │    PageRank · rings · communities · 2-hop
  └────────┬─────────────┘    ~1 min · outputs: processed_graph.pt + norm_params.json
           │
           ▼
  ┌──────────────────┐
  │  train_model.py  │  ← SAGE → GAT → SAGE + Weighted NLLLoss
  └────────┬─────────┘    1000-epoch ceiling · AUC-based early stopping
           │              ~26 min CPU · outputs: mule_model.pth + eval_report.json
           ▼
  ┌──────────────────────┐
  │ inference_service.py │  ← FastAPI · O(1) logit cache · < 50ms p99
  └──────────────────────┘    Spring Boot contract at /v1/gnn/score
```

---

## Installation

> ⚠️ **Do not `pip install -r requirements.txt` directly.**
> PyTorch Geometric sparse backends must be installed in order from a separate wheel server.

### Prerequisites

- Python **3.10 or 3.11** (3.12+ not yet fully supported by all PyG sparse backends)
- pip ≥ 23 — run `pip install --upgrade pip`

```bash
python3.11 -m venv .venv
source .venv/bin/activate        # Linux / macOS
.venv\Scripts\activate           # Windows PowerShell
```

### Step 1 — PyTorch

```bash
# CPU (works everywhere, no GPU required)
pip install torch==2.3.1

# GPU (NVIDIA — replace cu121 with your CUDA version)
pip install torch==2.3.1 --index-url https://download.pytorch.org/whl/cu121
```

Verify: `python -c "import torch; print(torch.__version__)"` → `2.3.1`

### Step 2 — PyTorch Geometric + sparse backends

```bash
pip install torch-geometric==2.5.3

# CPU
pip install torch-scatter torch-sparse \
    -f https://data.pyg.org/whl/torch-2.3.1+cpu.html

# GPU (CUDA 12.1)
pip install torch-scatter torch-sparse \
    -f https://data.pyg.org/whl/torch-2.3.1+cu121.html
```

> The `+cpu` / `+cu121` in the URL must exactly match `torch.__version__`.

### Step 3 — Remaining dependencies

```bash
pip install \
    "fastapi==0.115.0" "uvicorn[standard]==0.30.6" "pydantic==2.8.2" \
    "pandas==2.2.2" "numpy==1.26.4" "scikit-learn==1.5.1" \
    "networkx==3.3" "httpx"
```

### Step 4 — Verify

```bash
python -c "
import torch, torch_geometric, fastapi, pandas, numpy
print(f'torch           {torch.__version__}')
print(f'torch-geometric {torch_geometric.__version__}')
print(f'fastapi         {fastapi.__version__}')
print('All OK ✅')
"
```

### Common Errors

| Error | Fix |
|-------|-----|
| `SAGEConv not in PyG registry` | torch-scatter/sparse not installed — re-run Step 2 |
| `No matching distribution for torch-scatter` | torch version in `-f` URL doesn't match installed version |
| `numpy.core.multiarray failed to import` | `pip install "numpy==1.26.4" --force-reinstall` |
| `No module named 'torch_sparse'` | Add `--no-cache-dir` to Step 2 install |
| Training slow despite GPU | `python -c "import torch; print(torch.cuda.is_available())"` → reinstall with correct CUDA URL |

---

## Dataset Setup

Download from Kaggle: https://www.kaggle.com/c/ieee-fraud-detection/data

```
shared-data/
├── train_transaction.csv   ← required  (~590 MB)
└── train_identity.csv      ← strongly recommended (~27 MB, adds device features)
```

Docker: `docker run -v $(pwd)/shared-data:/app/shared-data mulehunter:latest`

---

## Running the Pipeline

```bash
# Step 1 — Ingest + engineer 15 per-account features (~2 min)
python data_generator.py

# Step 2 — Build graph, rings, communities, PyG tensors (~1 min)
python feature_engineering.py

# Step 3 — Train GNN (~26 min CPU, 450 epochs, early stopping)
python train_model.py

# Step 4 — Start inference API
uvicorn inference_service:app --port 8001 --reload

# Step 5 — Full integration test suite (API must be running)
python test_my_work.py

# Non-default host or data path
python test_my_work.py --base-url http://staging:8001 --shared-data /data/mule
```

> Steps 1–3 are one-time setup. Only Step 4 runs in production.

---

## Project Structure

```
ai-engine/
├── data_generator.py       ← Step 1: IEEE-CIS → 15-feature node table
├── feature_engineering.py  ← Step 2: graph → 21-feature tensor + norm params
├── train_model.py          ← Step 3: SAGE→GAT→SAGE GNN training
├── inference_service.py    ← Step 4: FastAPI real-time scoring
├── test_my_work.py         ← Integration test suite (13 sections, pass/fail)
├── requirements.txt        ← Pinned versions
└── README.md

shared-data/
├── nodes.csv               ← 14,318 per-account feature rows
├── transactions.csv        ← 75,488 directed edges
├── processed_graph.pt      ← PyG Data object with train/val/test masks
├── norm_params.json        ← MinMax normalisation params for inference
├── mule_model.pth          ← Best val checkpoint
├── model_meta.json         ← Version, F1/AUC, optimal threshold
└── eval_report.json        ← Full precision/recall/F1/AUC + confusion matrix
```

---

## The 21 Features

### Group 1 — Account-Level (15 features from raw transactions)

| # | Feature | Signal |
|---|---------|--------|
| 0 | `account_age_days` | Newly opened mule accounts |
| 1 | `balance_mean` | Uniform amounts → smurfing |
| 2 | `balance_std` | Low volatility + high volume → structured deposits |
| 3 | `tx_count` | Velocity proxy |
| 4 | `tx_velocity_7d` | Burst activity before cash-out |
| 5 | `fan_out_ratio` | Scattering funds to many destinations |
| 6 | `amount_entropy` | Round/repeated amounts → laundering |
| 7 | `risky_email` | Disposable / anonymous email domains |
| 8 | `device_mobile` | Device type distribution |
| 9 | `device_consistency` | Mules switch devices frequently |
| 10 | `addr_entropy` | Transacting from many locations |
| 11 | `d_gap_mean` | Bot-like unnaturally regular timing |
| 12 | `card_network_risk` | Card type risk encoding |
| 13 | `product_code_risk` | Cash-equivalent product risk |
| 14 | `international_flag` | Cross-border fund movement ratio |

### Group 2 — Graph-Level (6 features from the transaction network)

| # | Feature | Signal |
|---|---------|--------|
| 15 | `pagerank` | Hub accounts = ring organisers |
| 16 | `in_out_ratio` | Mules receive far more than they send |
| 17 | `reciprocity_score` | Circular flows = layering |
| 18 | `community_fraud_rate` | Embedded in a high-fraud cluster |
| 19 | `ring_membership` | Direct laundering ring participation |
| 20 | `second_hop_fraud_rate` | Guilt-by-association propagation |

---

## GNN Architecture

```
Input (21 features)
     │
     ├──[Skip Linear 21→64]─────────────────────────────┐
     │                                                   │
  SAGEConv(21→128) → BN → ReLU → Dropout(0.10)         │
     │                                                   │
  GATConv(128→128, 4 heads, concat=False)               │
     → BN → ReLU → Dropout(0.10)                        │
     │                                                   │
  SAGEConv(128→64) → BN → ReLU                          │
     │                                                   │
     └──────────────── Add ─────────────────────────────┘
                          │
                  embedding (64-dim)
                          │
          Linear(64→64) → BN → ReLU → Dropout(0.15)
          Linear(64→32) → ReLU → Dropout(0.05)
          Linear(32→2)  → LogSoftmax
                          │
                   fraud probability
```

| Hyperparameter | Value |
|----------------|-------|
| Hidden channels | 128 |
| GAT heads | 4 (concat=False) |
| GNN dropout | 0.10 |
| Head dropout | 0.15 / 0.05 |
| Loss | Weighted NLLLoss — w_safe=0.571, w_fraud=4.031 |
| Optimiser | AdamW lr=1e-3, wd=1e-4 |
| LR schedule | Linear warmup 20ep + ReduceLROnPlateau (patience=40) |
| Early stopping | AUC-based, patience=30 checks, 150ep warmup guard |

---

## Ring Detection

Time-bounded DFS (25s budget) restricted to account nodes only — location nodes excluded to prevent spurious cycles through shared merchant addresses.

```
    STAR                CHAIN               CYCLE          DENSE CLUSTER
     A                A → B → C            A → B            A ←→ B
   / | \                                   ↑   |            ↑ ↘  ↑ ↘
  B  C  D                                  |   ↓            |   C   |
   \ | /                                   D ← C            D ←→ E
     E
One hub          Sequential          Perfect loop      Interconnected
distributes      laundering path                       criminal cluster
```

Each account gets a role: **HUB** (coordinator) · **BRIDGE** (high betweenness) · **MULE** (leaf forwarder)

---

## API Reference

### `POST /v1/gnn/score` — Spring Boot contract

```json
// Request
{ "accountId": "12345_visa_debit",
  "graphFeatures": { "suspiciousNeighborCount": 4, "twoHopFraudDensity": 0.47 } }

// Response (key fields)
{ "gnnScore": 0.891, "confidence": 0.782, "riskLevel": "HIGH",
  "muleRingDetection": { "isMuleRingMember": true, "ringShape": "STAR", "role": "MULE" },
  "riskFactors": ["Embedded in a high-risk fraud community", "member_of_star_mule_ring"] }
```

### All Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/gnn/score` | Full GNN score — Spring Boot contract |
| `POST` | `/analyze-transaction` | Single tx scoring + risk factors |
| `POST` | `/analyze-batch` | Bulk scoring (≤ 100 transactions) |
| `GET` | `/detect-rings` | Pre-cached ring report |
| `GET` | `/cluster-report` | Community fraud summary |
| `GET` | `/network-snapshot` | Top-risk nodes + edges for dashboard |
| `GET` | `/health` | Service health, model version, cache stats |
| `GET` | `/metrics` | Full eval report |

---

## Key Engineering Decisions

**Weighted NLLLoss over Focal Loss** — Frequency-inverse weights give equivalent minority-class focus with zero hyperparameters and stable gradients. At 12.4% fraud prevalence, `w_fraud = 4.031`.

**AUC for early stopping, not F1** — F1 at a fixed 0.5 threshold is noisy during training. AUC is threshold-free and monotonically tracks discriminative power. Threshold search runs once post-training on val set.

**O(1) inference** — Single batched forward pass at startup caches `(risk, confidence, embedding_norm)` for all 14,318 known nodes. Unknown accounts get neutral 0.5 features → MLP-only scoring (no message-passing).

**Account-only ring detection** — Location nodes form spurious cycles through shared merchant addresses. Restricting the DFS subgraph to account nodes only eliminates all false rings.

**Threshold tuning impact** — Default-0.5 F1 = `0.7747`. Tuned F1 = `0.8604`. Proves the model is more confident with the full dataset (threshold 0.9484 → 0.8644) — it's not hedging anymore.

---

## Dependency Reference

| Package | Version | Role |
|---------|---------|------|
| `torch` | 2.3.1 | Deep learning engine |
| `torch-geometric` | 2.5.3 | SAGEConv, GATConv, BatchNorm, Data |
| `torch-scatter` | wheel-matched | Sparse scatter for PyG message passing |
| `torch-sparse` | wheel-matched | Sparse matmul for PyG aggregation |
| `fastapi` | 0.115.0 | REST API framework |
| `uvicorn[standard]` | 0.30.6 | ASGI server |
| `pydantic` | 2.8.2 | Schema validation + JSON serialisation |
| `pandas` | 2.2.2 | Data loading + feature engineering |
| `numpy` | 1.26.4 | Numerical ops + MinMax normalisation |
| `scikit-learn` | 1.5.1 | F1/AUC metrics + PR curve threshold tuning |
| `networkx` | 3.3 | Graph construction, PageRank, community detection |
| `httpx` | latest | HTTP client for test suite |

---

*MuleHunter AI — Because every fraudster leaves a trace in the graph.*