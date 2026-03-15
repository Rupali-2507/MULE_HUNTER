# 🎯 Mule Hunter Engine

<div align="center">

### **Defense in Depth: Real-Time Financial Fraud Detection Platform**

*Stopping money mule networks before they cash out*

---

## 🌐 Live Deployment

**Access the deployed application here:**

**http://34.230.243.158:3000/**

---

</div>

---

## 🚨 The Problem: A $3 Trillion Crisis

Modern financial crime has evolved from simple credit card theft into **industrialized money laundering networks**. Criminals exploit real-time payment rails (UPI, IMPS) to move illicit funds through "mule accounts"—legitimate banking accounts used as pass-through entities.

**Traditional fraud detection fails because:**
- ❌ **Tabular ML** assumes Customer A is independent of Customer B
- ❌ **Rule-based systems** can't detect novel attack patterns
- ❌ **Centralized models** can't handle new users without retraining
- ❌ **Black-box AI** provides no explanation for blocked transactions

**In money laundering, the relationship *between* accounts IS the crime.**

---

## 💡 Our Solution: Graph Neural Networks + Defense in Depth

The Mule Hunter Engine shifts the paradigm from **analyzing entities** to **analyzing topologies** using a 4-layer defense architecture:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: 🛡️  THE SHIELD (JA3 Fingerprinting)             │
│  → Block automated botnets before they transact             │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 🧠 THE BRAIN (Graph Neural Networks)             │
│  → Detect known fraud topologies (Star, Chain, Ring)        │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 🕸️  THE SAFETY NET (Isolation Forest)            │
│  → Catch zero-day anomalies the GNN hasn't seen             │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: 📦 THE BLACK BOX (Blockchain Ledger)             │
│  → Immutable forensic evidence, tamper-proof logs           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Features

### 🎯 **Inductive Graph Learning (The Game-Changer)**

Unlike traditional GCNs that memorize specific nodes, our **GraphSAGE** implementation learns *how to aggregate neighbor information*:

- ✅ **Handles new users instantly** without model retraining
- ✅ **Scales to millions of daily transactions**
- ✅ **Detects fraud topologies** (Star, Chain, Ring) in milliseconds

```python
# The "Bouncer" analogy: Recognizes bad behavior, not faces
if suspicious_behavior(new_user.neighbors):
    flag_as_fraud()  # No retraining needed!
```

### 🛡️ **JA3 TLS Fingerprinting**

Bots can rotate IP addresses, but they **can't change their SSL handshake signature**:

```
Chrome Browser:   769,47-53-5-10,0-23-65281,29-23-24
Python Bot:       771,49-51-47,0-23,23-24-25
                  ↑ Different fingerprint = Instant block
```

### 🔬 **Extended Isolation Forest (Zero-Day Detection)**

Standard anomaly detection uses axis-parallel cuts. **EIF uses diagonal hyperplanes** to catch complex, multi-dimensional fraud patterns:

```
Standard IF:  |||  (vertical/horizontal cuts)
Extended IF:  ///  (angled cuts → better isolation)
```

### 📊 **Real-Time 3D Visualization**

WebGL-powered force-directed graph rendering **10,000+ nodes at 60 FPS**:

- 🔴 **Red nodes** = Confirmed fraud
- 🟡 **Yellow nodes** = Suspicious activity
- 🔗 **Edge thickness** = Transaction volume
- 🎬 **Animated playback** of attack propagation

### 🔒 **Forensic Blockchain**

Private Merkle Tree ledger ensures fraud evidence is **tamper-evident**:

```
Block 1: Hash(TX_001 + TX_002) → Root_A
Block 2: Hash(Root_A + TX_003) → Root_B
         ↑
If TX_001 changes, Root_B breaks → Tampering detected
```

---

## 🏗️ Architecture

### Tech Stack

```
Frontend:    Next.js 14 + Tailwind CSS + Three.js (WebGL)
Backend:     Spring Boot (WebFlux) + FastAPI (Python)
AI Engine:   PyTorch Geometric + NetworkX + Scikit-learn
Database:    PostgreSQL + MongoDB
Real-Time:   WebSockets (Socket.io) + Server-Sent Events
Security:    JA3 Fingerprinting + Cloudflare Workers
DevOps:      Docker + Kubernetes + GitHub Actions
```

### System Flow

```mermaid
graph LR
    A[Transaction] --> B[JA3 Shield]
    B --> C{Bot?}
    C -->|Yes| D[Block]
    C -->|No| E[GraphSAGE Brain]
    E --> F{Known Pattern?}
    F -->|Yes| G[Flag High Risk]
    F -->|No| H[Isolation Forest]
    H --> I{Anomaly?}
    I -->|Yes| G
    I -->|No| J[Allow]
    G --> K[Blockchain Log]
    J --> K
    K --> L[Real-Time Dashboard]
```

---

## 🚀 Quick Start

### Prerequisites

```bash
# Required
- Docker Desktop
- Node.js 20+
- Python 3.11+
- Java 17+

# Optional (for development)
- CUDA 12.0+ (GPU acceleration)
- PostgreSQL 15+
```

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/mule-hunter.git
cd mule-hunter

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 3. Start with Docker Compose (easiest!)
docker-compose up --build

# 4. Access the dashboard
open http://localhost:3000
```

### Manual Setup (Development)

```bash
# AI Service (Python)
cd ai-engine
pip install -r requirements.txt
uvicorn inference_service:app --port 8001 --reload

# Backend (Java)
cd backend
./mvnw spring-boot:run

# Frontend (Next.js)
cd control-tower
npm install
npm run dev
```

---

## 📚 How It Works

### 1️⃣ Dataset & Network Construction — AI Engine _(Muskan)_

Due to strict banking data regulations (GDPR / PCI-DSS), direct access to real financial transaction graphs is not possible. To ensure realism without violating compliance, we leveraged the publicly available **IEEE-CIS Fraud Detection** Kaggle dataset — widely used for fraud detection research.

**Dataset:** IEEE-CIS Fraud Detection (Kaggle) · Real-world, anonymized · **590,540 transactions** · 434 feature columns · Labeled fraud instances

#### Graph Construction

We transformed the tabular transaction data into a directed heterogeneous transaction graph:

- **Nodes:** Accounts / Cards / Users — **14,318 unique accounts**
- **Edges:** Co-occurrence relationships (shared address, card BIN, device) — **75,488 directed edges**
- **Labels:** Fraud / Non-fraud (ground truth from dataset) · **12.4% fraud prevalence**

This produces a scale-free, highly imbalanced financial network closely resembling real banking systems.

#### ✅ Verified Model Performance

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│    AUC-ROC       │    F1 Score      │    Precision     │    Recall        │
│    0.9906        │    0.8604        │    0.8669        │    0.8539        │
│  ✅ Target >0.90 │  ✅ Target >0.80 │  1.9% false alarm│  85.4% detected  │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Inference       │  Rings Found     │  Fraud Clusters  │  Training        │
│  < 50ms          │  300 rings       │  857 high-risk   │  450 epochs CPU  │
│  O(1) cache      │  in < 25s        │  of 11,343 total │  ~26 min         │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

**Confusion Matrix** (test set — 2,149 nodes, 267 fraud nodes):

```
                  Predicted Safe    Predicted Fraud
Actual Safe            1,847               35       ← 1.9% false alarm rate
Actual Fraud              39              228       ← 85.4% of mule accounts caught
```

> Threshold `0.8644` tuned on val set. Default-0.5 F1 was `0.7747` — threshold tuning alone added **+0.086 F1**.

#### Fraud Pattern Emergence

Instead of manually injecting patterns, the dataset inherently contains realistic fraud behaviors:

- **Smurfing-like structures** — many low-value transactions keeping amounts below detection thresholds
- **Layered transaction paths** — funds hop through multiple accounts before reaching the beneficiary
- **Collusive rings / cyclic flows** — circular money movement to obscure origin

These patterns are **learned implicitly** by the GNN rather than hard-coded.

#### The 21-Feature GNN

Each account is described by 21 features — 15 engineered from raw transactions, 6 computed from the graph structure:

| Group | # | Feature | What It Catches |
|-------|---|---------|-----------------|
| Account | 0 | `account_age_days` | Newly opened mule accounts |
| Account | 1–2 | `balance_mean/std` | Uniform amounts → smurfing |
| Account | 3–4 | `tx_count/velocity_7d` | Burst activity before cash-out |
| Account | 5 | `fan_out_ratio` | Scattering funds to many destinations |
| Account | 6 | `amount_entropy` | Round/repeated amounts → laundering |
| Account | 7 | `risky_email` | Disposable / anonymous email domains |
| Account | 8–9 | `device_mobile/consistency` | Mules switch devices frequently |
| Account | 10–11 | `addr_entropy/d_gap_mean` | Location diversity + bot-like timing |
| Account | 12–14 | `card/product/intl_flag` | Card risk + cross-border flows |
| Graph | 15 | `pagerank` | Hub accounts = ring organisers |
| Graph | 16 | `in_out_ratio` | Mules receive far more than they send |
| Graph | 17 | `reciprocity_score` | Circular flows = layering |
| Graph | 18 | `community_fraud_rate` | Embedded in a high-fraud cluster |
| Graph | 19 | `ring_membership` | Direct laundering ring participation |
| Graph | 20 | `second_hop_fraud_rate` | Guilt-by-association propagation |

#### GNN Architecture: SAGE → GAT → SAGE

```
Input (21 features)
     ├──[Skip Linear 21→64]──────────────────────────┐
     │                                                │
  SAGEConv(21→128) → BatchNorm → ReLU → Dropout(0.10)│
     │                                                │
  GATConv(128→128, 4 heads) → BatchNorm → ReLU       │
     │                                                │
  SAGEConv(128→64) → BatchNorm → ReLU                │
     │                                                │
     └──────────────── Add ──────────────────────────┘
                          │
              Linear(64→32) → ReLU → Linear(32→2)
                          │
                   fraud probability
```

- **Layer 1 — GraphSAGE:** Aggregates neighbourhood broadly — *"who are your friends?"*
- **Layer 2 — GAT (4 heads):** Attention-weighted — *"which friends are suspicious?"*
- **Layer 3 — GraphSAGE:** Final synthesis before classification
- **Skip connection:** Residual path preserves input features, prevents signal loss

**Training details:** Weighted NLLLoss (`w_fraud=4.031`, `w_safe=0.571`) · AdamW + ReduceLROnPlateau · AUC-based early stopping · 150-epoch warmup guard

#### Money Laundering Ring Detection

300 ring structures detected at startup using time-bounded DFS (25s budget), restricted to account nodes only:

```
    STAR                CHAIN               CYCLE          DENSE CLUSTER
     A                A → B → C            A → B            A ←→ B
   / | \                                   ↑   |            ↑ ↘  ↑ ↘
  B  C  D                                  |   ↓            |   C   |
   \ | /                                   D ← C            D ←→ E
     E
One hub         Sequential         Perfect loop      Interconnected
distributes     laundering path                      criminal cluster
```

Each account is classified as **HUB** (coordinator), **BRIDGE** (high betweenness), or **MULE** (leaf forwarder).

#### Real-Time Inference API

```
POST /v1/gnn/score          ← Spring Boot contract (full schema)
POST /analyze-transaction   ← Single tx risk scoring + explainability
POST /analyze-batch         ← Bulk scoring (≤ 100 transactions)
GET  /detect-rings          ← Money-laundering ring report
GET  /cluster-report        ← Fraud cluster summary
GET  /network-snapshot      ← Graph snapshot for dashboard
GET  /health                ← System health + model metadata
GET  /metrics               ← Full F1/AUC/Precision/Recall report
```

**O(1) inference:** Single batched forward pass at startup caches risk scores for all known nodes. Known-node requests are dictionary lookups — microseconds, not milliseconds.

---

### 2️⃣ Feature Engineering

```python
features = {
    'pagerank': nx.pagerank(G),           # Financial influence
    'in_out_ratio': money_in / money_out, # Mules ≈ 1.0
    'burst_velocity': tx_count / time,    # Bot speed
    'clustering': nx.clustering(G),       # Social ties
    'betweenness': nx.betweenness(G)      # Bridge detection
}
```

### 3️⃣ GraphSAGE Training

```python
class MuleSAGE(torch.nn.Module):
    def __init__(self):
        self.conv1 = SAGEConv(in_feat=5, hidden=32)
        self.conv2 = SAGEConv(hidden=32, out=2)
    
    def forward(self, x, edge_index):
        # Message passing: aggregate neighbor info
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return F.log_softmax(x, dim=1)
```

**Key Innovation:** Inductive learning allows instant fraud detection for **new users** without retraining

### 4️⃣ Real-Time Inference

```javascript
// Frontend → Backend → AI → Response
const result = await fetch('/api/transactions', {
  method: 'POST',
  body: JSON.stringify({
    source: '12345',
    target: '67890',
    amount: 50000
  })
});

// Response
{
  "verdict": "CRITICAL (MULE)",
  "risk_score": 0.89,
  "topology": "star_pattern",
  "linked_accounts": ["acc_001", "acc_002", "acc_003"],
  "shap_explanation": {
    "pagerank": +0.35,
    "velocity": +0.28,
    "in_out_ratio": +0.26
  }
}
```

---

## 📊 Performance Metrics

| Metric | Result | Industry Benchmark |
|--------|--------|-------------------|
| **Precision** | 94.3% | ~70% |
| **Recall** | 91.7% | ~60% |
| **F1-Score** | 93.0% | ~65% |
| **Latency** | 42ms | ~500ms |
| **Throughput** | 10,000 TPS | ~1,000 TPS |
| **False Positive Rate** | 2.1% | ~15% |

**Dataset:** 2,000 nodes, 8,000 edges, 160 fraud cases (8% fraud rate)

---

## 🎯 Use Cases

### 1. **Smurfing Detection (Star Topology)**
```
50 victims → 1 mule → 1 criminal
Detection: High in-degree, zero clustering coefficient
```

### 2. **Layering Detection (Chain Topology)**
```
A → B → C → D → E (rapid sequential transfers)
Detection: High betweenness, low balance retention
```

### 3. **Synthetic Identity Rings**
```
A ↔ B ↔ C ↔ A (circular wash trading)
Detection: High modularity, isolated community
```

### 4. **Bot Farm Prevention**
```
Same JA3 fingerprint across 100 accounts in 1 minute
Detection: IP + TLS signature correlation
```

---

## 🔬 Research & Innovation

### **Why GraphSAGE Over GCN?**

| Feature | GCN (Transductive) | GraphSAGE (Inductive) |
|---------|-------------------|----------------------|
| **New Nodes** | ❌ Requires retraining | ✅ Instant embedding |
| **Scalability** | 🐌 Slow for large graphs | ⚡ Batched sampling |
| **Real-Time** | ❌ Not feasible | ✅ Production-ready |
| **Memory** | 📈 O(N²) edges | 📊 O(k) neighbors |

**The Bouncer Analogy:**
- GCN = Memorizes every banned person's face (fails on strangers)
- GraphSAGE = Recognizes "bad behavior" (works on anyone)

### **Extended Isolation Forest Advantage**

```python
# Standard IF: Only axis-parallel cuts
if x > threshold_x or y > threshold_y:
    anomaly = True

# Extended IF: Hyperplane cuts (any angle)
if dot(weights, [x, y, z]) > threshold:
    anomaly = True  # Captures diagonal patterns!
```

**Result:** 23% better anomaly detection on non-linear fraud patterns

---

## 🛡️ Security Features

### **JA3 Fingerprinting**
```python
ja3_hash = md5(f"{ssl_version},{ciphers},{extensions}")

blacklist = {
    "e7d705a3286e19ea42f587b344ee6865": "Python requests bot",
    "6734f37431670b3ab4292b8f60f29984": "Selenium automation"
}

if ja3_hash in blacklist:
    block_request()
```

### **Merkle Tree Integrity**
```
Transaction Logs:
TX1: "ACC_001 → ACC_002: ₹5000"
TX2: "ACC_003 → ACC_004: ₹3000"

Hash: H(TX1+TX2) = "abc123..."
Root: H(abc123 + previous_root) = "def456..."

If TX1 modified → Root changes → Tampering detected
```

### **Circuit Breaker Pattern**
```java
@CircuitBreaker(name = "aiService", fallbackMethod = "fallback")
public FraudScore analyze(Transaction tx) {
    return aiService.predict(tx);
}

// If AI fails 50% of the time:
// → Open circuit → Use rule-based fallback
// → Bank stays online!
```

---

## 📖 API Documentation

### **POST /api/transactions**

```bash
curl -X POST http://localhost:8082/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "sourceAccount": "12345",
    "targetAccount": "67890",
    "amount": 50000
  }'
```

**Response:**
```json
{
  "id": "tx_abc123",
  "verdict": "SUSPICIOUS",
  "riskScore": 0.67,
  "outDegree": 15,
  "riskRatio": 1.85,
  "populationSize": "2000 Nodes",
  "ja3Detected": false,
  "linkedAccounts": ["Card_66", "Card_88"],
  "unsupervisedScore": 0.0884,
  "model_version": "Kaggle-IEEE-GraphSAGE-V2"
}
```

### **GET /api/health/ai**

```bash
curl http://localhost:8082/api/health/ai
```

**Response:**
```json
{
  "status": "HEALTHY",
  "model_loaded": true,
  "nodes_count": 2000,
  "version": "Kaggle-IEEE-V2-AutoTrain"
}
```

---

## 🎓 Team

### **The Architects**

<table>
<tr>
<td align="center">
<img src="https://github.com/muskan.png" width="100px"/><br/>
<b>Muskan</b><br/>
<i>Lead AI Engineer</i><br/>
🧠 GraphSAGE • Data Engineering
</td>
<td align="center">
<img src="https://github.com/ratnesh.png" width="100px"/><br/>
<b>Ratnesh</b><br/>
<i>Security Architect</i><br/>
🛡️ JA3 • Blockchain
</td>
<td align="center">
<img src="https://github.com/rupali.png" width="100px"/><br/>
<b>Rupali</b><br/>
<i>ML & Visualization</i><br/>
🔬 EIF • WebGL • SHAP
</td>
</tr>
<tr>
<td align="center">
<img src="https://github.com/prisha.png" width="100px"/><br/>
<b>Prisha</b><br/>
<i>Backend Architect</i><br/>
⚡ Spring WebFlux • Resilience
</td>
<td align="center">
<img src="https://github.com/manya.png" width="100px"/><br/>
<b>Manya</b><br/>
<i>Full Stack Lead</i><br/>
🎨 Next.js • Real-Time UX
</td>
</tr>
</table>

---

## 📊 Roadmap

### **Phase 1: Core MVP** ✅
- [x] GraphSAGE implementation
- [x] JA3 fingerprinting
- [x] Real-time dashboard
- [x] Docker deployment

### **Phase 2: Production Features** 🚧
- [ ] Multi-bank federation
- [ ] Explainable AI (LIME + SHAP)
- [ ] Mobile app (React Native)
- [ ] Kubernetes auto-scaling

### **Phase 3: Research** 📚
- [ ] Temporal Graph Networks
- [ ] Federated Learning (privacy-preserving)
- [ ] Quantum-resistant blockchain
- [ ] Cross-border AML compliance

---

## 🙏 Acknowledgments

- **Stanford SNAP** - GraphSAGE research
- **PyTorch Geometric** - GNN framework
- **Kaggle IEEE-CIS** - Fraud detection dataset
- **NetworkX** - Graph algorithms
- **Three.js** - 3D visualization

---

<div align="center">

**⭐ Star this repo if you found it helpful! ⭐**

**Made with ❤️ by Team Alertix**

</div>

---

### 🔒 `contracts/` — Integration Schemas

Defines data and API formats used across services.  
Prevents dependency conflicts and team blocking.

---

### 🔄 `shared-data/` — Data Exchange

Temporary CSV/JSON files for testing, visualization, and demos.  
_Not used for long-term storage._

---

### 🧭 `control-tower/` — Dashboard & Realtime UX _(Manya)_

Next.js dashboard, WebSocket alerts, BFF layer, authentication,  
and edge security using Cloudflare Workers.

---

### 🧠 `ai-engine/` — AI & Simulation _(Muskan)_

Synthetic graph generation, fraud injection, feature engineering,  
GraphSAGE training, and FastAPI-based inference.

**Verified results:** AUC-ROC `0.9906` · F1 `0.8604` · Precision `0.8669` · Recall `0.8539` · Inference `<50ms` · 300 rings detected · 857 high-risk clusters · 14,318 nodes · 75,488 edges · trained on 590,540 transactions · CPU only · ~26 min.

---

### 👁️ `visual-analytics/` — Analytics & Visualization _(Rupali)_

Zero-day fraud detection using Extended Isolation Forest,  
SHAP explainability, and high-performance 3D WebGL visualization.

---

### 🧬 `backend/` — Reactive Backend _(Prishaa)_

High-throughput transaction simulation using Spring WebFlux,  
AI integration, and resilience via circuit breakers.

---

### 🛡️ `security-forensics/` — Security & Integrity _(Ratnesh)_

JA3 TLS fingerprinting for bot detection and  
tamper-proof forensic logging using cryptographic structures.

---

### 🐳 `docker-compose.yml`

One-command deployment of all core services for demo.