# 🔍 MuleHunter AI — Mule Account & Collusive Fraud Detection

> A real-time Graph Neural Network system that hunts down money mule accounts, money laundering rings, and collusive fraud clusters in UPI payment networks — before the money disappears.

---

## What Problem Does This Solve?

Imagine you send ₹10,000 to pay your rent. What you don't see is that your bank's payment rails are simultaneously being used by a network of fraudsters who have recruited hundreds of innocent-seeming accounts — *mule accounts* — to bounce stolen money around so fast it becomes untraceable.

These **mule accounts** are often real people who were tricked or coerced into letting fraudsters use their bank accounts. The money flows through them in a chain or ring pattern — deposited, moved, withdrawn — so quickly that by the time the fraud is detected, the money is gone.

India's UPI system processes **500 crore+ transactions per month**. Even a 0.1% fraud rate means 50 lakh fraudulent transactions. This system is built to catch them.

---

## How It Works — The Big Picture

Traditional fraud detection asks: *"Does this transaction look suspicious?"*

MuleHunter asks: *"Does this **entire network of accounts and relationships** look suspicious?"*

This is the difference between looking at a single tree and seeing the whole forest.

```
Raw Transactions (IEEE-CIS)
         │
         ▼
  ┌─────────────────┐
  │  Data Generator │  ← Builds account-level features (15 signals)
  └────────┬────────┘
           │
           ▼
  ┌──────────────────────┐
  │  Feature Engineering │  ← Builds the transaction graph + graph features
  └────────┬─────────────┘     PageRank · Ring Detection · Community Detection
           │
           ▼
  ┌──────────────────┐
  │   GNN Training   │  ← SAGE→GAT→SAGE architecture + Focal Loss
  └────────┬─────────┘     Learns from BOTH node features AND graph structure
           │
           ▼
  ┌──────────────────────┐
  │  Inference Service   │  ← FastAPI · <50ms latency · Spring Boot compatible
  └──────────────────────┘
```

---

## Installation

> ⚠️ **Do not run `pip install -r requirements.txt` directly.**
> PyTorch Geometric's sparse backends must be installed in a specific order and fetched from a separate wheel server. Follow the four steps below exactly.

### Prerequisites

- **Python 3.10 or 3.11** — Python 3.12+ is not yet fully supported by all PyG sparse backends.
- **pip ≥ 23** — run `pip install --upgrade pip` if unsure.

If you need a clean environment:

```bash
python3.11 -m venv .venv
source .venv/bin/activate        # Linux / macOS
.venv\Scripts\activate           # Windows PowerShell
```

---

### Step 1 — Install PyTorch

**CPU build** (works on every machine, no GPU required):

```bash
pip install torch==2.3.1
```

**GPU build** (faster training — only if you have an NVIDIA GPU):

```bash
# Replace cu121 with your actual CUDA version (run: nvcc --version)
pip install torch==2.3.1 --index-url https://download.pytorch.org/whl/cu121
```

Verify:

```bash
python -c "import torch; print(torch.__version__)"   # → 2.3.1
```

---

### Step 2 — Install PyTorch Geometric + sparse backends

`torch-scatter` and `torch-sparse` are compiled against a specific PyTorch version and **must** be fetched from PyG's own wheel server. The URL encodes both the torch version and the compute platform:

**CPU:**

```bash
pip install torch-geometric==2.5.3

pip install torch-scatter torch-sparse \
    -f https://data.pyg.org/whl/torch-2.3.1+cpu.html
```

**GPU (CUDA 12.1):**

```bash
pip install torch-geometric==2.5.3

pip install torch-scatter torch-sparse \
    -f https://data.pyg.org/whl/torch-2.3.1+cu121.html
```

> If you see `ERROR: No matching distribution found`, double-check that the torch version string in the URL (`torch-2.3.1+cpu`) exactly matches what `torch.__version__` prints.

---

### Step 3 — Install remaining dependencies

```bash
pip install \
    "fastapi==0.115.0" \
    "uvicorn[standard]==0.30.6" \
    "pydantic==2.8.2" \
    "pandas==2.2.2" \
    "numpy==1.26.4" \
    "scikit-learn==1.5.1" \
    "networkx==3.3" \
    "httpx"
```

---

### Step 4 — Verify everything is working

```bash
python - <<'EOF'
import torch, torch_geometric
import fastapi, uvicorn, pydantic
import pandas, numpy, sklearn, networkx, httpx

print(f"torch           {torch.__version__}")
print(f"torch-geometric {torch_geometric.__version__}")
print(f"fastapi         {fastapi.__version__}")
print(f"pandas          {pandas.__version__}")
print(f"numpy           {numpy.__version__}")
print("All dependencies OK ✅")
EOF
```

Expected output:

```
torch           2.3.1
torch-geometric 2.5.3
fastapi         0.115.0
pandas          2.2.2
numpy           1.26.4
All dependencies OK ✅
```

---

### Dependency Reference

| Package | Pinned Version | Role |
|---------|---------------|------|
| `torch` | 2.3.1 | Deep learning engine for GNN training and inference |
| `torch-geometric` | 2.5.3 | Graph Neural Network layers — `SAGEConv`, `GATConv`, `BatchNorm`, `Data` |
| `torch-scatter` | wheel-matched | Sparse scatter operations required by PyG message passing |
| `torch-sparse` | wheel-matched | Sparse matrix multiplication required by PyG aggregation |
| `fastapi` | 0.115.0 | REST API framework for the inference service |
| `uvicorn[standard]` | 0.30.6 | ASGI server; `[standard]` adds WebSocket support and performance extras |
| `pydantic` | 2.8.2 | Request/response schema validation and JSON serialisation |
| `pandas` | 2.2.2 | Tabular data loading and feature engineering |
| `numpy` | 1.26.4 | Numerical operations and MinMax normalisation |
| `scikit-learn` | 1.5.1 | F1 / AUC metrics and precision-recall curve for threshold tuning |
| `networkx` | 3.3 | Graph construction, PageRank, community detection, cycle detection |
| `httpx` | latest | HTTP client used by the test suite to call the running API |

---

### Common Installation Errors

**`RuntimeError: Tried to instantiate 'SAGEConv' but it is not present in the PyG registry`**
→ `torch-scatter` / `torch-sparse` were not installed. Re-run Step 2.

**`ERROR: No matching distribution found for torch-scatter`**
→ The torch version in the `-f` URL doesn't match your installed torch. Check `python -c "import torch; print(torch.__version__)"` and update the URL accordingly.

**`ImportError: numpy.core.multiarray failed to import`**
→ numpy 2.x was accidentally installed. Fix with: `pip install "numpy==1.26.4" --force-reinstall`

**`ModuleNotFoundError: No module named 'torch_sparse'`**
→ The sparse backend wheel was not found for your platform. Try installing with `--no-cache-dir` to force a fresh download: `pip install torch-sparse -f https://data.pyg.org/whl/torch-2.3.1+cpu.html --no-cache-dir`

**Training is very slow even with a GPU**
→ Verify PyTorch sees the GPU: `python -c "import torch; print(torch.cuda.is_available())"`. If `False`, reinstall torch with the correct CUDA index URL from Step 1.

---

## Dataset

Download the IEEE-CIS Fraud Detection dataset from Kaggle:

```
https://www.kaggle.com/c/ieee-fraud-detection/data
```

Place both files in the `shared-data/` directory:

```
shared-data/
├── train_transaction.csv   ← required  (~590 MB)
└── train_identity.csv      ← optional but strongly recommended (~27 MB, adds device fingerprint features)
```

The `shared-data/` directory is created automatically on first run. If running inside Docker, map it as a volume:

```bash
docker run -v $(pwd)/shared-data:/app/shared-data mulehunter:latest
```

---

## Running the Pipeline

Run each step in order. Each produces files that the next step reads.

```bash
# 1. Ingest IEEE-CIS, engineer 15 per-account features
python data_generator.py

# 2. Build transaction graph, detect rings and communities, create PyG tensors
#    (ring detection is time-bounded to 30s — it will not hang)
python feature_engineering.py

# 3. Train the GNN — up to 500 epochs with early stopping at patience=40
#    Best checkpoint is saved automatically to shared-data/mule_model.pth
python train_model.py

# 4. Start the real-time inference API on port 8001
uvicorn inference_service:app --port 8001 --reload

# 5. Run the full integration test suite (API must already be running)
python test_my_work.py

# Run tests against a non-default URL or data path:
python test_my_work.py --base-url http://staging:8001 --shared-data /data/mule
```

> **Tip:** Steps 1–3 are one-time training setup. After training completes, only Step 4 needs to run in production.

---

## Project Structure

```
MULE_HUNTER/
├── ai-engine/
│   ├── data_generator.py       ← Step 1: Ingest IEEE-CIS, engineer 15 node features
│   ├── feature_engineering.py  ← Step 2: Build graph, ring/community/graph features
│   ├── train_model.py          ← Step 3: Train SAGE→GAT→SAGE GNN with Focal Loss
│   ├── inference_service.py    ← Step 4: FastAPI service for real-time scoring
│   ├── test_my_work.py         ← Full integration test suite (pass/fail + CLI args)
│   ├── requirements.txt        ← Pinned versions (read installation notes above)
│   └── README.md               ← You are here
│
└── shared-data/                ← All generated artifacts live here
    ├── train_transaction.csv   ← IEEE-CIS input (you provide this)
    ├── train_identity.csv      ← IEEE-CIS input (optional, you provide this)
    ├── nodes.csv               ← Engineered per-account feature table
    ├── transactions.csv        ← Directed edge list for graph construction
    ├── processed_graph.pt      ← PyTorch Geometric Data object (graph + split masks)
    ├── norm_params.json        ← MinMax normalisation params (used at inference time)
    ├── mule_model.pth          ← Trained GNN weights (best validation checkpoint)
    ├── model_meta.json         ← Version, in_channels, F1/AUC, optimal threshold
    └── eval_report.json        ← Full Precision/Recall/F1/AUC/confusion matrix
```

---

## The Science — Explained Simply

### Why a Graph Neural Network?

A bank account on its own might look completely normal — low transaction amounts, regular timing, legitimate email address. But connect it to the graph of *who it transacts with* and suddenly you see it's sitting at the centre of a 7-account ring where money flows in a perfect circle.

That circular pattern is called **layering** in Anti-Money Laundering (AML) terminology — one of the three phases of money laundering (Placement → Layering → Integration).

A **Graph Neural Network (GNN)** is a type of AI that learns from both the features of individual nodes (accounts) AND the structure of the connections between them. It propagates information across the graph — "guilt by association" — so that an account connected to many known fraudsters inherits some of that suspicion, even if its own transactions look clean.

### The Architecture: SAGE → GAT → SAGE

Our GNN has three layers, each doing a different job:

| Layer | Type | What It Does |
|-------|------|-------------|
| 1 | **GraphSAGE** | Aggregates information from the neighbourhood broadly — "who are your friends?" |
| 2 | **GAT** (Graph Attention) | Learns *which* neighbours matter most using attention weights — "which friends are suspicious?" |
| 3 | **GraphSAGE** | Final aggregation before classification — synthesises everything |

A **residual (skip) connection** carries the original input features directly to the output layer, preventing information loss in deep networks (similar to ResNet in image recognition).

---

## The 21 Features

Each account in our graph is described by 21 numerical features, divided into two groups:

### Group 1: Account-Level Features (computed from raw transactions)

| # | Feature | What It Measures | Why It Matters |
|---|---------|-----------------|----------------|
| 0 | `account_age_days` | How long this account has been active | Mule accounts are often newly opened |
| 1 | `balance_mean` | Average transaction amount | Unusually uniform amounts signal smurfing |
| 2 | `balance_std` | Volatility of transaction amounts | Low volatility + high volume = structured transactions |
| 3 | `tx_count` | Total number of transactions | High velocity is a red flag |
| 4 | `tx_velocity_7d` | Transactions in the last 7 days | Burst activity precedes withdrawal |
| 5 | `fan_out_ratio` | How many different destinations money goes to | Mules scatter funds to many accounts |
| 6 | `amount_entropy` | Diversity of transaction amounts | Round, repeated amounts = smurfing |
| 7 | `risky_email` | Email domain risk score | Disposable email = identity hiding |
| 8 | `device_mobile` | Fraction of mobile transactions | Fraud patterns differ by device |
| 9 | `device_consistency` | Does the account use the same device? | Mules switch devices frequently |
| 10 | `addr_entropy` | Address diversity | Mules transact from many locations |
| 11 | `d_gap_mean` | Behavioural timing patterns | Bots have unnaturally regular timing |
| 12 | `card_network_risk` | Card type risk (Visa/MC/Amex/Discover) | Some networks have higher fraud rates |
| 13 | `product_code_risk` | Transaction product type risk | Cash-equivalent products are riskier |
| 14 | `international_flag` | Cross-border transaction ratio | Cross-border moves funds across jurisdictions |

### Group 2: Graph-Level Features (computed from the transaction network)

| # | Feature | What It Measures | Why It Matters |
|---|---------|-----------------|----------------|
| 15 | `pagerank` | Network centrality (importance) | Hubs in fraud networks = organisers |
| 16 | `in_out_ratio` | Inflow vs outflow of money | Mules receive more than they send |
| 17 | `reciprocity_score` | Circular flow detection | Money bouncing back = layering |
| 18 | `community_fraud_rate` | Fraud rate in the account's cluster | Fraudsters cluster together |
| 19 | `ring_membership` | Number of circular rings this account is in | Direct laundering ring membership |
| 20 | `second_hop_fraud_rate` | Fraud density 2 hops away | Guilt-by-association propagation |

---

## Money Laundering Ring Detection

One of the most powerful features of MuleHunter is its ability to detect **mule ring structures** — coordinated groups of accounts that pass money between themselves in patterns designed to obscure its origin.

### Ring Shapes We Detect

```
    STAR                CHAIN               CYCLE            DENSE CLUSTER

     A                A → B → C            A → B            A ←→ B
   / | \                                   ↑   |            ↑ ↘  ↑ ↘
  B  C  D                                  |   ↓            |   C   |
   \ | /                                   D ← C            D ←→ E
     E

  One hub      Sequential   Perfect   Fully interconnected
  distributes  laundering   loop      criminal network
```

Each account's **role** within the ring is classified:
- **HUB** — the organiser who coordinates fund flows
- **BRIDGE** — connects different parts of the network (high betweenness centrality)
- **MULE** — a leaf node receiving and forwarding funds

---

## Community Detection

Beyond individual rings, MuleHunter uses **greedy modularity community detection** to identify clusters of accounts that transact heavily amongst themselves. High-fraud clusters (>30% of members are known fraudsters) are flagged as high-risk, and all accounts within them receive elevated suspicion scores.

This is powerful because it catches **collusive fraud networks** — groups of fraudsters who haven't formed explicit rings but who are statistically over-connected to each other.

---

## The API

The inference service runs as a FastAPI application and exposes these endpoints:

### Core Scoring

```
POST /v1/gnn/score
```
The main Spring Boot integration endpoint. Takes an account ID and optional graph context from the Java backend. Returns the full risk schema including GNN score, cluster info, ring membership, and risk factors.

```
POST /analyze-transaction
```
Single transaction scoring for dashboard use. Returns risk score, verdict (SAFE / SUSPICIOUS / CRITICAL), and human-readable risk factors explaining the decision.

```
POST /analyze-batch
```
Score up to 100 transactions in one request. Efficient for batch processing use cases.

### Investigation Tools

```
GET /detect-rings
```
Returns detected money laundering rings from the pre-cached cycle detection. Filter by maximum ring size.

```
GET /cluster-report
```
Summary of all detected fraud communities — how many clusters, which are high-risk, top flagged accounts.

```
GET /network-snapshot
```
Graph data (nodes + edges) for the highest-risk accounts. Designed to power network visualisation dashboards.

### Monitoring

```
GET /health       # Service health, model version, cache stats
GET /metrics      # Full evaluation report (F1, AUC, Precision, Recall)
```

---

## Output Schema

Every `/v1/gnn/score` call returns this full JSON:

```json
{
  "model": "GNN",
  "version": "MuleHunter-V3",
  "entity": { "type": "ACCOUNT", "id": "card1_visa_debit" },
  "scores": {
    "gnnScore":   0.847,
    "confidence": 0.694,
    "riskLevel":  "HIGH"
  },
  "fraudCluster": {
    "clusterId":        12,
    "clusterSize":      9,
    "clusterRiskScore": 0.84
  },
  "networkMetrics": {
    "suspiciousNeighbors": 5,
    "sharedDevices":       2,
    "sharedIPs":           1,
    "centralityScore":     0.0081,
    "transactionLoops":    true
  },
  "muleRingDetection": {
    "isMuleRingMember": true,
    "ringId":           3,
    "ringShape":        "STAR",
    "ringSize":         7,
    "role":             "MULE",
    "hubAccount":       "card5_visa_credit",
    "ringAccounts":     ["card1_...", "card2_...", "..."]
  },
  "riskFactors": [
    "Embedded in a high-risk fraud community",
    "member_of_star_mule_ring",
    "Circular flows detected: money bouncing back"
  ],
  "embedding":  { "embeddingNorm": 0.923 },
  "timestamp":  "2026-03-14T10:42:11Z",
  "gnnScore":       0.847,
  "confidence":     0.694,
  "fraudClusterId": 12,
  "embeddingNorm":  0.923
}
```

---

## Key Engineering Decisions

### Why Focal Loss?

Standard cross-entropy loss treats all mistakes equally. But in fraud detection, fraud cases are only 3–5% of the data. The model would achieve 97% accuracy just by predicting "safe" for everything.

**Focal Loss** down-weights easy examples (the 95% of clean transactions the model gets right trivially) and focuses the gradient signal on the hard cases — the borderline fraud cases that are most important to get right. This is the same technique used in object detection (RetinaNet) for the same reason: severe class imbalance.

### Why Optimal Threshold Tuning?

After training, the default decision threshold of 0.5 is almost never optimal for imbalanced datasets. We use the validation set to find the threshold that maximises F1 score, then apply it consistently to the test set and in production. This alone can improve real-world recall by 10–20%.

### Why O(1) Inference?

During startup, MuleHunter runs a single full forward pass over all known nodes and caches the results. Every subsequent scoring request for a known account is a dictionary lookup — microseconds, not milliseconds. New/unknown accounts trigger a minimal incremental forward pass. This is how the system achieves sub-50ms latency under load.

### Why Restrict Ring Detection to Account Nodes?

In the raw transaction graph, there are two types of nodes: account nodes (`card1_visa_debit`) and location nodes (`loc_1234` representing merchant addresses). Location nodes can form spurious "rings" — account A → location X → account B → location X — that look circular but aren't money laundering. Restricting `simple_cycles` to account-only subgraphs eliminates this noise entirely.

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| F1 Score | > 0.80 | Harmonic mean of precision and recall |
| AUC-ROC | > 0.90 | Area under the ROC curve |
| Inference latency | < 50ms | For known accounts (O(1) cache lookup) |
| Ring detection | < 30s | Time-bounded startup pre-cache |

---

## Datasets Used

- **IEEE-CIS Fraud Detection** (Kaggle) — Primary training dataset
- **APATE Social Network Fraud** — Graph topology reference
- **PaySim Financial Fraud** — Synthetic UPI flow patterns
- **DGFraud / YelpChi / T-Finance** — Graph fraud benchmarks

---

*MuleHunter AI — Because every fraudster leaves a trace in the graph.*