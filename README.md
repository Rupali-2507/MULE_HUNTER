# 🎯 Mule Hunter Engine

<div align="center">

### **Defense in Depth: Real-Time Financial Fraud Detection Platform**
*Stopping money mule networks before they cash out*

---

## 🌐 Live Deployment

**Access the deployed application here:**

**[http://34.230.243.158:3000/](http://34.230.243.158:3000/)**

## 🔐 Admin Panel Credentials

Use the following credentials to access the admin panel after logging in:

**Email:** admin@test.com  
**Password:** Test@123

> ⚠️ **Note:** These credentials are provided for testing purposes during the hackathon
---


```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   An account sending ₹500 to five people looks clean.               ║
║   Connect it to the graph — it's the hub of a 12-node star ring     ║
║   bouncing stolen UPI funds between burner accounts.                ║
║                                                                      ║
║   That pattern is invisible to tabular ML.                          ║
║   The GNN sees it in every forward pass.                            ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

</div>

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [Our Solution](#-our-solution-defense-in-depth)
- [Verified Performance](#-verified-performance)
- [System Architecture](#-system-architecture)
- [AI Engine Deep Dive](#-ai-engine-deep-dive)
- [The 4 Defensive Layers](#-the-4-defensive-layers)
- [Real-Time Pipeline](#-real-time-transaction-pipeline)
- [Dashboard & UI](#-dashboard--ui)
- [API Reference](#-api-reference)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Key Engineering Decisions](#-key-engineering-decisions)
- [Team](#-team)

---

## 🚨 The Problem

India's UPI network processes **500 crore+ transactions per month**. Even 0.1% fraud equals **50 lakh fraudulent transactions**. At global scale, money laundering moves an estimated **$3 trillion annually** — and the criminals have industrialized.

Modern financial crime no longer looks like a single suspicious account. It looks like a **network**:

```
Victim A ──₹8,500──►  Mule_01 ──₹4,200──►  Mule_04 ──►  Criminal Hub
Victim B ──₹6,300──►  Mule_02 ──₹3,900──►  Mule_05 ──►  Criminal Hub
Victim C ──₹9,100──►  Mule_03 ──₹5,700──►  Mule_06 ──►  Criminal Hub
                                                                │
                                                         Cash Out / Crypto
```

**Traditional fraud detection cannot see this.** It analyzes accounts in isolation — completely blind to the graph that makes this a crime.

| Approach | What It Sees | What It Misses |
|:---------|:------------|:---------------|
| Rule-based systems | Single-transaction anomalies | Coordinated multi-hop patterns |
| Tabular ML (XGBoost) | Per-account features | Relationships between accounts |
| Standard GCN | Graph structure | New users — requires full retraining |
| **MuleHunter GNN** ✅ | **Full topology + new users instantly** | **Nothing** |

---

## 💡 Our Solution: Defense in Depth

MuleHunter shifts the paradigm from *"does this transaction look suspicious?"* to *"does this entire network of relationships look suspicious?"*

```
  ┌───────────────────────────────────────────────────────────────────┐
  │                                                                   │
  │   🛡️  LAYER 1 ── THE SHIELD          JA3 TLS Fingerprinting     │
  │        Block bots before they even transact                       │
  │                                                                   │
  ├───────────────────────────────────────────────────────────────────┤
  │                                                                   │
  │   🧠  LAYER 2 ── THE BRAIN           Graph Neural Network        │
  │        SAGE → GAT → SAGE · detect known fraud topologies          │
  │                                                                   │
  ├───────────────────────────────────────────────────────────────────┤
  │                                                                   │
  │   🕸️  LAYER 3 ── THE SAFETY NET      Extended Isolation Forest   │
  │        Catch zero-day behavioral anomalies the GNN hasn't seen   │
  │                                                                   │
  ├───────────────────────────────────────────────────────────────────┤
  │                                                                   │
  │   📦  LAYER 4 ── THE BLACK BOX       Blockchain Forensics        │
  │        Tamper-proof immutable audit trail for every decision      │
  │                                                                   │
  └───────────────────────────────────────────────────────────────────┘
```

---

## ✅ Verified Performance (GNN)

> Trained and evaluated on the full **590,540-transaction IEEE-CIS Kaggle dataset** · CPU only · no GPU required

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│    AUC-ROC       │    F1 Score      │    Precision     │    Recall        │
│    0.9906        │    0.8604        │    0.8669        │    0.8539        │
│  ✅ Target >0.90 │  ✅ Target >0.80 │  1.9% false alarm│  85.4% caught    │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Inference       │  Rings Detected  │  Fraud Clusters  │  Training Time   │
│  < 50ms P99      │  300 rings       │  857 high-risk   │  ~26 min CPU     │
│  O(1) cache      │  in under 25s    │  of 11,343 total │  450 epochs      │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Confusion Matrix (GNN)** — test set · 2,149 nodes · 267 fraud:

```
                     Predicted Safe    Predicted Fraud
  Actual Safe             1,847               35        ←  1.9% false alarm rate
  Actual Fraud               39              228        ←  85.4% of mule accounts caught
```

> **Graph:** 14,318 accounts · 75,488 directed edges · 12.4% fraud prevalence
>
> **Threshold:** `0.8644` tuned on val set. Default-0.5 F1 = `0.7747`. Threshold tuning alone added **+0.086 F1** — the model is that confident at the right cutoff.

---

## 🏗️ System Architecture

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                    Next.js Dashboard  :3000                         │
  │       Simulator · GNN Graph · Rings · Clusters · Metrics           │
  └──────────────────────────┬──────────────────────────────────────────┘
                             │  REST
  ┌──────────────────────────▼──────────────────────────────────────────┐
  │                  Spring Boot Backend  :8082                         │
  │                                                                     │
  │    TransactionController → 14-step reactive pipeline (WebFlux)     │
  │    Step 8 fires GNN and EIF in PARALLEL ─────────────────────────► │
  │    Step 9 fuses all signals ─────────────────────────────────────► │
  └──────┬────────────────────────┬──────────────────────┬─────────────┘
         │                        │                      │
  ┌──────▼──────────┐   ┌─────────▼────────────┐   ┌────▼───────────────┐
  │  GNN Service    │   │   EIF Service         │   │  JA3 Security      │
  │  FastAPI :8001  │   │   FastAPI :8000       │   │  AWS Beanstalk     │
  │                 │   │                       │   │                    │
  │  SAGE→GAT→SAGE  │   │  Ext. Isolation       │   │  TLS fingerprint   │
  │  O(1) inference │   │  Forest + SHAP        │   │  Bot detection     │
  │  Ring detection │   │  6 → 12 features      │   │  velocity/fanout   │
  └──────────────────┘   └───────────────────────┘   └────────────────────┘
                                    │
  ┌─────────────────────────────────▼───────────────────────────────────┐
  │               MongoDB Atlas  ·  AP_SOUTH_1  ·  Replica Set          │
  │       Transactions · Node metadata · Risk scores · Audit trail      │
  └─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|:------|:----------|
| **Frontend** | Next.js 14, Tailwind CSS, Canvas API (particle graph) |
| **Backend** | Spring Boot 3, WebFlux (reactive), Resilience4j circuit breakers |
| **AI — GNN** | PyTorch 2.3.1, PyTorch Geometric 2.5.3, SAGEConv + GATConv |
| **AI — Anomaly** | Extended Isolation Forest, RobustScaler, SHAP path perturbation |
| **Graph Engine** | NetworkX 3.3, PageRank α=0.85, Louvain community detection |
| **Database** | MongoDB Atlas (replica set, AP_SOUTH_1) |
| **Security** | JA3 TLS fingerprinting, Merkle tree blockchain ledger |
| **DevOps** | Docker, AWS EC2, GitHub Actions |

---

## 🧠 AI Engine Deep Dive

### Dataset & Graph Construction

Real banking transaction data is protected under GDPR/PCI-DSS. We used the **IEEE-CIS Fraud Detection** dataset — 590,540 real-world anonymized transactions with labeled fraud instances, the industry standard for financial fraud research.

We transformed this tabular dataset into a **directed heterogeneous transaction graph**:

- **Nodes** — 14,318 unique account fingerprints (composite key: `card1_card4_card6`)
- **Edges** — 75,488 co-occurrence edges built from shared billing address, card BIN prefix, or device fingerprint
- **Labels** — Any fraudulent transaction on an account → account node labeled fraud
- **Class balance** — 12.4% fraud prevalence; addressed via frequency-inverse loss weights

Fraud patterns emerge **naturally from the data** rather than being manually injected — smurfing structures, layered transaction paths, and collusive rings are all learned implicitly by the GNN.

---

### The 21 Features

Each account node carries **21 features** — 15 engineered from raw transactions, 6 from graph structure:

| # | Feature | What It Catches | Source |
|:-|:--------|:---------------|:-------|
| 0 | `account_age_days` | Newly opened mule accounts | D1 column mean |
| 1 | `balance_mean` | Uniform amounts → smurfing | Tx amount mean |
| 2 | `balance_std` | Low volatility + high volume → structured deposits | Tx amount std |
| 3 | `tx_count` | Raw transaction velocity | Count |
| 4 | `tx_velocity_7d` | Burst activity before cash-out | 7-day window |
| 5 | `fan_out_ratio` | Scattering funds to many destinations | Unique targets / count |
| 6 | `amount_entropy` | Round/repeated amounts → laundering | Shannon entropy |
| 7 | `risky_email` | Disposable / anonymous email domains | Domain risk score [0,1] |
| 8 | `device_mobile` | Device type distribution | Mobile fraction |
| 9 | `device_consistency` | Mules switch devices frequently | 1 − (unique types / count) |
| 10 | `addr_entropy` | Transacting from many locations | Address diversity |
| 11 | `d_gap_mean` | Bot-like unnaturally regular timing | D-column mean |
| 12 | `card_network_risk` | Card type risk encoding | Visa/MC/Amex/Discover |
| 13 | `product_code_risk` | Cash-equivalent product risk | W/H/C/S/R encoding |
| 14 | `international_flag` | Cross-border transaction ratio | card3 > 150 fraction |
| 15 | `pagerank` | Hub accounts = ring organisers | Graph PageRank α=0.85 |
| 16 | `in_out_ratio` | Mules receive far more than they send | In-flow / out-flow |
| 17 | `reciprocity_score` | Circular flows = layering | Reciprocal neighbors / degree |
| 18 | `community_fraud_rate` | Embedded in a high-fraud cluster | Louvain community |
| 19 | `ring_membership` | Direct laundering ring participation | DFS ring count |
| 20 | `second_hop_fraud_rate` | Guilt-by-association propagation | 2-hop neighbor fraud % |

> ⚠️ **ORDER IS CONTRACT** — `FEATURE_COLS` ordering is fixed across `feature_engineering.py`, `inference_service.py`, and `norm_params.json`. Never reorder.

---

### GNN Architecture: SAGE → GAT → SAGE

```
  Input (21 features)
       │
       ├──── Skip Linear (21 → 64) ─────────────────────────────────────┐
       │                                                                  │
    SAGEConv(21 → 128) → BatchNorm → ReLU → Dropout(0.10)               │
       │                                                                  │
    GATConv(128 → 128, 4 heads, concat=False) → BatchNorm → ReLU        │
       │                                                                  │
    SAGEConv(128 → 64) → BatchNorm → ReLU                               │
       │                                                                  │
       └────────────────────────── Add ──────────────────────────────────┘
                                      │
                               embedding (64-dim)
                                      │
             Linear(64 → 64) → BatchNorm → ReLU → Dropout(0.15)
             Linear(64 → 32) → ReLU → Dropout(0.05)
             Linear(32 → 2)  → LogSoftmax
                                      │
                               fraud probability
```

| Layer | Role |
|:------|:-----|
| **GraphSAGE L1** | Broad neighbourhood aggregation — *"who are your counterparties?"* |
| **GAT × 4 heads** | Attention-weighted selection — *"which counterparties are suspicious?"* |
| **GraphSAGE L3** | Final synthesis; each head specialises in a different fraud signal |
| **Skip connection** | Residual path from raw input; prevents signal loss in deep layers |

**Training configuration:**

| Hyperparameter | Value | Rationale |
|:---|:---|:---|
| Loss | `WeightedNLLLoss` | `w_fraud=4.031`, `w_safe=0.571` — frequency-inverse weights |
| Optimizer | AdamW | `lr=1e-3`, `weight_decay=1e-4` |
| LR Schedule | ReduceLROnPlateau | Monitors val AUC, patience=40 checks |
| Warmup | 150 epochs | No early stopping before this — model must stabilise first |
| Early stopping | AUC-based | patience=30 checks = 300 epochs of no improvement |
| Max epochs | 1,000 | Hard ceiling; fires at ~450 in practice |
| Split | Stratified 70/15/15 | Preserves 12.4% fraud ratio across all three splits |

---

### O(1) Inference Architecture

```
  Training complete
        │
        ▼
  Single batched forward pass → cache (risk, confidence, embedding_norm)
                                      for ALL 14,318 known nodes
        │
        ├── Known node request  →  dict lookup  →  microseconds
        └── New node request    →  neutral 0.5 features → MLP-only → ~0.3–0.5 score
```

The `logit_cache` is built once at startup. Known-node scoring is a pure dictionary lookup — no GNN recomputation. New accounts receive neutral 0.5 features with MLP-only scoring: a conservatively uncertain output that neither flags nor clears them.

---

### Money Laundering Ring Detection

300 ring structures detected at startup using time-bounded DFS (25s budget, max 6 hops, account nodes only):

```
    STAR                  CHAIN                 CYCLE            DENSE CLUSTER
     A                  A → B → C              A → B             A ←→ B
   / | \                                       ↑   |             ↑ ↘   ↑ ↘
  B  C  D                                     |   ↓             |   C    |
   \ | /                                      D ← C             D ←→ E
     E

 One hub           Sequential            Perfect loop       Interconnected
 distributes       laundering path                          criminal cluster
```

Each account in a ring is assigned a role:

- 🔴 **HUB** — highest out-degree; the ring organiser
- 🟡 **BRIDGE** — high betweenness centrality; connects sub-clusters  
- ⚪ **MULE** — leaf forwarder; executes transfers, low betweenness

> **Why bounded DFS over Johnson's algorithm?** `nx.simple_cycles` enumerates every cycle and can run for hours on a 75k-edge graph. The DFS finds the most criminally significant small rings in under 25 seconds — all that's needed to flag ring-member nodes.

---

## 🔒 The 4 Defensive Layers

### 🛡️ Layer 1 — JA3 TLS Fingerprinting

Bots rotate IP addresses and user agents. They cannot change their TLS ClientHello signature. JA3 hashes SSL version, cipher suites, extensions, elliptic curves, and EC point formats:

```
Chrome 120:   771,4866-4867-4865-49196,0-23-65281-13-43-45-51,29-23-24,0
Python bot:   771,49196-49200-159-52393,0-23-65281,29-23-24,0
                                ↑
              Different fingerprint — instant detection regardless of IP
```

Returns `velocity` · `fanout` · `ja3Risk` · `isNewDevice` · `isNewJa3` — all fed into risk fusion at Step 9.

---

### 🧠 Layer 2 — Graph Neural Network

The GNN is the core. It learns not what fraud looks like in isolation, but **what fraud looks like inside a network**. Every account is scored in the context of its entire transaction neighbourhood. An account that looks clean on its own may sit at the centre of a laundering ring — the GNN sees exactly that.

---

### 🕸️ Layer 3 — Extended Isolation Forest

Standard Isolation Forest uses only axis-parallel hyperplane cuts. EIF uses `ExtensionLevel=1` — cuts at **any angle** — capturing diagonal multi-dimensional fraud patterns that standard IF misses:

```
  Standard IF:  |||  (vertical / horizontal cuts only)
  Extended IF:  ///  (angled cuts → better isolation of complex patterns)
```

**6 raw features → 12 expanded via cross-products:**

| Raw Feature | Measures |
|:------------|:---------|
| `velocity_score` | `txCount24h / 10`, capped at 1.0 |
| `burst_score` | `24h_outflow / (7d_daily_avg × 3)` |
| `suspicious_neighbor_count` | Direct fraud-connected accounts |
| `ja3_reuse_count` | Fingerprint seen across N accounts |
| `device_reuse_count` | Device hash seen across N accounts |
| `ip_reuse_count` | IP shared across N accounts |

Cross-products: `infra_risk` · `velocity_burst` · `neighbor_velocity` · `device_ip` · `ja3_weighted` · `burst_neighbor`

Scoring formula: `sigmoid(k × (threshold − raw_path_length))` — shorter isolation path = more anomalous = higher fraud score. SHAP path-length perturbation identifies top factors per decision.

---

### 📦 Layer 4 — Blockchain Forensics

Every fraud decision is committed to an immutable Merkle tree ledger at async Step 14:

```
  1  Decision committed to MongoDB
  2  FraudDecisionEvent published (Spring Event Bus)
  3  leafHash = SHA256(txId + riskScore + decision + timestamp)
  4  Batch 50 decisions → Merkle tree construction
  5  Root hash written to blockchain

  If any leaf is modified → root breaks → tampering instantly detected
```

No PII on-chain — only decision hashes. Creates tamper-evident forensic evidence.

---

## ⚡ Real-Time Transaction Pipeline

Every transaction traverses a **14-step reactive pipeline** built on Spring WebFlux:

```
  POST /api/transactions
           │
    ┌──────▼────────────────────────────────────────────────────┐
    │  Step  1   Validate (timestamp, numeric IDs, amount > 0)   │
    │  Step  2   Persist Transaction → MongoDB                   │
    │  Step  3   Persist Identity (device, IP, JA3 header)       │
    │  Step  4   Identity Forensics (JA3 microservice)           │
    ├─────────────────────────────────────────────────────────────┤
    │  Steps 5–7  PARALLEL                                        │
    │             Update Aggregates                               │
    │             Behavioral Feature Scoring                      │
    │             Graph Context Enrichment                        │
    ├─────────────────────────────────────────────────────────────┤
    │  Step  8  ∥  EIF score  ‖  GNN score  (both parallel)      │
    ├─────────────────────────────────────────────────────────────┤
    │  Step  9   Risk Fusion → finalRisk                          │
    │  Step 10   Log Predictions                                  │
    │  Step 11   Decision Policy (APPROVE / REVIEW / BLOCK)       │
    │  Step 12   Commit to MongoDB                                │
    │  Step 13   Return Verdict  ←  caller receives here          │
    └──────┬──────────────────────────────────────────────────────┘
           │  async (non-blocking)
    ┌──────▼──────┐
    │  Step 14    │  Blockchain: leafHash → Merkle batch → ledger
    └─────────────┘
```

**Risk fusion formula** (Spring Boot `combineRiskSignals`):

```
  finalRisk =  0.40 × GNN_score
             + 0.20 × EIF_score
             + 0.25 × behavior_score   (velocity×0.3 + burst×0.5 + deviation×0.2)
             + 0.10 × graph_score      (connectivity×0.6 + twoHopDensity×0.4)
             + 0.05 × ja3_risk
```

**Decision thresholds:**

```
  < 0.45    →  ✅  APPROVE
  0.45–0.75 →  🟡  REVIEW
  ≥ 0.75    →  🚫  BLOCK
```

> The ML layer **outputs scores only**. Decision policy lives entirely in Spring Boot — threshold adjustment is a config change, no retraining needed.

---

## 📊 Dashboard & UI

The Next.js dashboard provides **9 live-wired sections**, all connected via `LastResultCtx`. The Simulator writes every scored transaction into shared React context; EIF, Identity, and Fusion sections read from it instantly — zero duplicate API calls.

| Section | Data Source | What It Shows |
|:--------|:-----------|:--------------|
| **🎯 Simulator** | `POST /api/transactions` | 14-step pipeline animation · full score breakdown · ring membership |
| **🧠 GNN** | `GET /network-snapshot` | Animated particle graph · 21-feature reference · architecture |
| **🔬 EIF** | Last result + `/api/health/ai` | EIF score · SHAP top factors · feature space reference |
| **🔑 Identity** | Last result | JA3 velocity/fanout/risk · device reuse · IP/geo analysis |
| **⚖️ Fusion** | Last result | Live score composition with real weights and values |
| **💫 Rings** | `GET /detect-rings` | 300 pre-cached rings · topology diagrams · member roles |
| **🗂️ Clusters** | `GET /cluster-report` | 11,343 communities · fraud rate distribution |
| **⛓️ Blockchain** | `GET /api/admin/stats` | Merkle tree · audit log · async flow steps |
| **📈 Metrics** | `/metrics` + `/api/admin/evaluate-models` | GNN/EIF/Fusion comparison · confusion matrix · arc gauges |

---

## 📡 API Reference

### GNN Service — `:8001`

```
POST  /v1/gnn/score             Full scoring — Spring Boot contract
POST  /analyze-transaction      Single tx scoring + risk factors
POST  /analyze-batch            Bulk scoring (≤ 100 transactions)
GET   /detect-rings             Pre-cached ring report
GET   /cluster-report           Community fraud summary
GET   /network-snapshot         Top-risk nodes + edges for dashboard
GET   /health                   Service health · model version · cache stats
GET   /metrics                  Full eval report (F1/AUC/Precision/Recall + confusion matrix)
```

**`POST /v1/gnn/score`**

```json
// Request
{
  "accountId": "1553_visa_debit",
  "graphFeatures": {
    "suspiciousNeighborCount": 4,
    "twoHopFraudDensity": 0.47
  }
}

// Response
{
  "gnnScore": 0.891,
  "confidence": 0.782,
  "riskLevel": "HIGH",
  "fraudCluster": { "clusterId": 42, "clusterSize": 87, "clusterRiskScore": 0.63 },
  "muleRingDetection": {
    "isMuleRingMember": true,
    "ringShape": "STAR",
    "role": "MULE",
    "hubAccount": "1201"
  },
  "riskFactors": ["Embedded in a high-risk fraud community", "member_of_star_mule_ring"],
  "embeddingNorm": 3.47
}
```

### EIF Service — `:8000`

```
POST  /v1/eif/score             Anomaly scoring (6 features → score + SHAP)
GET   /health                   Service health + model status
```

```json
// Request — [velocity, burst, suspicious_neighbors, ja3_reuse, device_reuse, ip_reuse]
{ "features": [0.73, 0.61, 4.0, 8.0, 2.0, 1.0] }
```

### Backend API — `:8082`

```
POST  /api/transactions              Submit transaction (full 14-step pipeline)
GET   /api/health/ai                 Aggregated AI service health
GET   /api/admin/stats               Live stats (TPS, blocked, accuracy, FPR)
GET   /api/admin/evaluate-models     Live eval on stored transactions
```

```json
// POST /api/transactions — request
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "sourceAccount": "1553",
  "targetAccount": "899",
  "amount": 2077,
  "timestamp": "2026-03-20T10:30:00"
}
```

> ⚠️ `sourceAccount` / `targetAccount` must be **numeric strings** — they map to graph node IDs.
> `timestamp` must be ISO-8601 LocalDateTime with **no trailing `Z`**.

---

## 🚀 Quick Start

### Prerequisites

```
Python 3.10 or 3.11    ← 3.12+ has PyG sparse backend issues
Java 17+
Node.js 20+
Docker Desktop         ← optional, recommended
```

### 1 — Clone

```bash
git clone https://github.com/Rupali-2507/MULE_HUNTER.git
cd MULE_HUNTER
```

### 2 — Dataset

Download from Kaggle: [IEEE-CIS Fraud Detection](https://www.kaggle.com/c/ieee-fraud-detection/data)

```
shared-data/
├── train_transaction.csv    ← required  (~590 MB)
└── train_identity.csv       ← recommended (~27 MB, enables device features)
```

### 3 — AI Engine (one-time, ~30 min CPU)

```bash
cd ai-engine

python3.11 -m venv .venv
source .venv/bin/activate            # Linux/macOS
# .venv\Scripts\activate             # Windows

# Step A — PyTorch
pip install torch==2.3.1

# Step B — PyG + sparse backends
pip install torch-geometric==2.5.3
pip install torch-scatter torch-sparse \
    -f https://data.pyg.org/whl/torch-2.3.1+cpu.html

# Step C — Remaining dependencies
pip install fastapi==0.115.0 "uvicorn[standard]==0.30.6" pydantic==2.8.2 \
            pandas==2.2.2 numpy==1.26.4 scikit-learn==1.5.1 networkx==3.3 httpx

# Step D — Training pipeline
python data_generator.py        # ~2 min   → nodes.csv + transactions.csv
python feature_engineering.py  # ~1 min   → processed_graph.pt + norm_params.json
python train_model.py           # ~26 min  → mule_model.pth + eval_report.json
```

### 4 — EIF Service

> ⚠️ **Windows users:** The `eif` package has a compiler bug on MSVC that breaks a standard `pip install`. Follow the patched setup below. Linux/macOS users can skip straight to the short path.
 
<details>
<summary><strong>🪟 Windows — Patched Installation (MSVC compiler fix)</strong></summary>
 
The `-Wcpp` flag in `eif`'s `setup.py` crashes the MSVC compiler. You need to clone the source, patch one line, and build manually.
 
**Step 1 — Navigate and create a Python 3.11 environment**
 
> Python 3.11 must be installed. Check with `py -3.11 --version`.
 
```powershell
cd visual-analytics/eif_v_2
py -3.11 -m venv venv311
.\venv311\Scripts\Activate.ps1
```
 
**Step 2 — Install core build tools**
 
```powershell
python -m pip install --upgrade pip setuptools wheel
pip install numpy "cython<3.0"
```
 
**Step 3 — Clone the `eif` source and patch the compiler flag**
 
```powershell
# Keep Git clean
echo "eif/" >> .gitignore
 
git clone https://github.com/sahandha/eif.git
cd eif
```
 
Open `setup.py` in your editor. Around line 25, find:
 
```python
extra_compile_args=["-std=c++11", "-Wcpp"],
```
 
Remove `-Wcpp` so it reads:
 
```python
extra_compile_args=["-std=c++11"],
```
 
Save the file.
 
**Step 4 — Build, install, and clean up**
 
```powershell
pip install --no-build-isolation .
cd ..
rm -r -force eif
```
 
**Step 5 — Install remaining requirements**
 
```powershell
pip install -r requirements.txt
```
 
**Step 6 — Start the service**
 
```powershell
python train/train_eif.py  
```
 
</details>
 
<details>
<summary><strong>🐧 Linux / macOS — Standard Installation</strong></summary>
 
```bash
cd visual-analytics/eif_v_2
pip install eif==2.0.0 scikit-learn shap fastapi uvicorn pandas numpy --break-system-packages
python train/train_eif.py  
 ```
 
</details>

### 5 — Start All Services

```bash
# Terminal 1 — GNN inference service
cd ai-engine && uvicorn inference_service:app --port 8001

# Terminal 2 — EIF anomaly service
cd visual-analytics/eif_v_2 && uvicorn app.main:app --port 8000 --reload  

# Terminal 3 — Spring Boot backend
cd backend && ./mvnw spring-boot:run

# Terminal 4 — Next.js dashboard
cd control-tower && npm install && npm run dev
```

### 6 — Verify

```
Dashboard   →   http://localhost:3000
GNN health  →   http://localhost:8001/health
EIF health  →   http://localhost:8000/health
API health  →   http://localhost:8082/api/health/ai
```

### Common Issues

| Error | Fix |
|:------|:----|
| `SAGEConv not in PyG registry` | `torch-scatter`/`torch-sparse` not installed — re-run Step B |
| `No matching distribution for torch-scatter` | The `+cpu` in the wheel URL must exactly match `torch.__version__` |
| `numpy.core.multiarray failed to import` | `pip install "numpy==1.26.4" --force-reinstall` |
| All scores return 0 | `timestamp` missing from POST body — required by `TransactionValidationService` |
| `NumberFormatException` in backend | Account IDs must be numeric strings — not `"ACC1553"` |
| `No primary constructor for ServerHttpRequest` | Backend is Spring MVC — use `HttpServletRequest`, not the WebFlux reactive type |
| EIF scores inverted | Old model artifacts have wrong threshold — delete `models/` and re-run `startup.py` |

---

## 📁 Project Structure

```
mule-hunter/
│
├── ai-engine/                     ← GNN training & inference  (:8001)
│   ├── data_generator.py          ← IEEE-CIS → 15-feature node table
│   ├── feature_engineering.py     ← Graph build → 21-feature PyG tensor + norm params
│   ├── train_model.py             ← SAGE→GAT→SAGE · AUC early stopping · threshold search
│   ├── inference_service.py       ← FastAPI · O(1) logit cache · ring pre-cache
│   └── requirements.txt
│
├── visual-analytics/
│   └── eif_v_2/                   ← EIF anomaly detection  (:8000)
│       ├── app/
│       │   ├── main.py            ← FastAPI endpoints (/v1/eif/score, /health)
│       │   ├── inference.py       ← EIF scoring (path-length inversion fixed)
│       │   ├── schemas.py         ← Request/response models
│       │   └── config.py          ← Absolute paths (relative path bug fixed)
│       ├── train/
│       │   └── train_eif.py       ← EIF training · correct threshold direction
│       └── startup.py             ← Auto-train if artifacts missing → start server
│
├── backend/                       ← Spring Boot 3 reactive backend  (:8082)
│   └── src/main/java/com/mulehunter/
│       ├── controller/            ← TransactionController (MVC, not WebFlux reactive)
│       ├── service/               ← TransactionService · RiskFusionService
│       │                             IdentityCollectorService · BehaviorService
│       └── config/                ← WebClient beans · circuit breakers
│
├── control-tower/                 ← Next.js 14 dashboard  (:3000)
│   └── src/app/dashboard/
│       └── FraudDashboard.tsx     ← 9 sections · LastResultCtx shared state
│           ├── SimulatorSection   ← 14-step pipeline animation
│           ├── GnnSection         ← Particle graph + feature reference
│           ├── EifSection         ← Live EIF scores + SHAP
│           ├── IdentitySection    ← JA3 + device + IP forensics
│           ├── FusionSection      ← Live score composition
│           ├── RingsSection       ← Ring detection + topology
│           ├── ClustersSection    ← Community report
│           ├── BlockchainSection  ← Audit trail + Merkle tree
│           └── MetricsSection     ← Model evaluation + comparison
│
├── shared-data/                   ← Populated after training  (gitignored)
│   ├── nodes.csv                  ← 14,318-node feature table
│   ├── transactions.csv           ← 75,488 directed edges
│   ├── processed_graph.pt         ← PyG Data object (train/val/test masks)
│   ├── norm_params.json           ← MinMax normalisation params for inference
│   ├── mule_model.pth             ← Best validation checkpoint
│   ├── model_meta.json            ← Version · F1/AUC · optimal threshold
│   └── eval_report.json           ← Full confusion matrix + training history
│
└── contracts/                     ← API schemas (prevent integration drift)
```

---

## 🔬 Key Engineering Decisions

**Why GraphSAGE (inductive) over GCN (transductive)?**
GCN memorises node embeddings at training time — it fails on unseen accounts without full retraining. GraphSAGE learns *how* to aggregate neighbourhood information. Any new account is embedded instantly using its local subgraph. The analogy: GCN memorises faces; GraphSAGE recognises suspicious behaviour and works on anyone.

**Why AUC for early stopping, not F1?**
F1 at a fixed 0.5 threshold is noisy during training — it thrashes based on threshold position, not model quality. AUC is threshold-free and monotonically tracks true discriminative power. Threshold search runs once, post-training, on the validation set.

**Why WeightedNLLLoss over Focal Loss?**
Frequency-inverse weights give equivalent minority-class focus with zero additional hyperparameters and stable gradients. At 12.4% fraud prevalence: `w_fraud = 4.031`, `w_safe = 0.571`.

**Why account-only ring detection?**
Location nodes (shared `addr1` values) form spurious cycles through high-volume merchant addresses. Restricting DFS to account nodes eliminates all false rings with zero accuracy cost.

**Why was EIF scoring inverted before the fix?**
`iForest.compute_paths()` returns average *path length* to isolate a point — shorter = more anomalous. The original code used `scores >= np.percentile(scores, 95)`, which is the *longest* path = the *most normal* accounts. It was flagging normals as fraud. Fixed to `scores <= np.percentile(scores, 5)` with `sigmoid(+k × (threshold − raw_path))`.

---

## 👥 Team

| Name | Role | Responsibilities |
|:-----|:-----|:----------------|
| **Muskan** | Lead AI Engineer | GraphSAGE architecture · IEEE-CIS data pipeline · GNN training · inference service |
| **Rupali** | ML & Visualization | Extended Isolation Forest · SHAP explainability · Canvas particle graph |
| **Prisha** | Backend Architect | Spring Boot 14-step pipeline · AI service integration · circuit breakers |
| **Ratnesh** | Security Architect | JA3 TLS fingerprinting · Merkle tree ledger · blockchain forensics |
| **Manya** | Full Stack Lead | Next.js dashboard · real-time UX · all 9 live-wired sections · deployment |

---

## 📈 Roadmap

**Phase 1 — Core MVP** ✅
- [x] GNN training pipeline (IEEE-CIS, 590k transactions, AUC 0.9906)
- [x] Real-time FastAPI inference with O(1) logit cache
- [x] Extended Isolation Forest + SHAP explainability
- [x] Spring Boot 14-step reactive transaction pipeline
- [x] JA3 fingerprinting microservice
- [x] Merkle tree blockchain forensics
- [x] Next.js dashboard — 9 live-wired sections

**Phase 2 — Production Hardening** 🚧
- [ ] Temporal Graph Networks (capture transaction sequence patterns)
- [ ] Federated learning across bank nodes (privacy-preserving)
- [ ] LIME explanations for regulatory audit reports
- [ ] Kubernetes autoscaling with HPA
- [ ] Multi-rail support (SWIFT, SEPA, IMPS)

**Phase 3 — Research** 📚
- [ ] Dynamic graph embeddings (fraud patterns evolve; model should too)
- [ ] Quantum-resistant blockchain signatures
- [ ] Cross-border AML compliance (FATF recommendations)
- [ ] Differential privacy for node feature publishing

---

## 🙏 Acknowledgments

- **IEEE-CIS** — Fraud Detection dataset (Kaggle, 590k anonymized real-world transactions)
- **Hamilton et al.** — [Inductive Representation Learning on Large Graphs](https://arxiv.org/abs/1706.02216) (GraphSAGE)
- **Veličković et al.** — [Graph Attention Networks](https://arxiv.org/abs/1710.10903)
- **Hariri et al.** — [Extended Isolation Forest](https://arxiv.org/abs/1811.02141)
- **PyTorch Geometric** — GNN framework (SAGEConv, GATConv, BatchNorm)
- **NetworkX** — Graph algorithms (PageRank, Louvain, betweenness)

---

<div align="center">

<br />

```
╔════════════════════════════════════════════════════════╗
║   Built by Team Alertix                                ║
║                                                        ║
║   Because every fraudster leaves a trace               ║
║   in the graph.                                        ║
╚════════════════════════════════════════════════════════╝
```

<br />

⭐ **Star this repo if you found it useful** ⭐

</div>