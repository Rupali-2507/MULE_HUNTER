<div align="center">

# 🎯 alertixAI

### **Defense in Depth — Real-Time Financial Fraud Detection Platform**
*Stopping money mule networks before they cash out*

<br/>

![Java](https://img.shields.io/badge/Java-17-orange?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2-brightgreen?logo=springboot)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)
![PyTorch](https://img.shields.io/badge/PyTorch%20Geometric-2.5.3-red?logo=pytorch)
![MongoDB](https://img.shields.io/badge/MongoDB-7-green?logo=mongodb)
![License](https://img.shields.io/badge/status-national%20presentation%20build-CAFF33)

<br/>

**[🌐 Live Dashboard → localhost:3000](http://localhost:3000)**

</div>

---

## 📋 Table of Contents

- [1. The Problem](#1-the-problem)
- [2. Our Solution — Defense in Depth](#2-our-solution--defense-in-depth)
- [3. Verified Performance](#3-verified-performance)
- [4. System Architecture](#4-system-architecture)
- [5. Service & Port Map](#5-service--port-map)
- [6. Prerequisites](#6-prerequisites)
- [7. Complete Local Setup](#7-complete-local-setup)
  - [7.1 Clone & Environment Files](#71-clone--environment-files)
  - [7.2 Database — MongoDB via Docker](#72-database--mongodb-via-docker)
  - [7.3 Seeding Graph & User Data](#73-seeding-graph--user-data)
  - [7.4 AI Engine (GraphSAGE + GAT GNN)](#74-ai-engine-graphsage--gat-gnn)
  - [7.5 Visual Analytics (Extended Isolation Forest)](#75-visual-analytics-extended-isolation-forest)
  - [7.6 Security Forensics (JA3 + Blockchain Ledger)](#76-security-forensics-ja3--blockchain-ledger)
  - [7.7 Backend (Spring Boot Orchestrator)](#77-backend-spring-boot-orchestrator)
  - [7.8 Frontend (Control Tower)](#78-frontend-control-tower)
- [8. One-Shot Docker Compose (Alternative)](#8-one-shot-docker-compose-alternative)
- [9. Login Credentials](#9-login-credentials)
- [10. Verifying Everything Is Wired Correctly](#10-verifying-everything-is-wired-correctly)
- [11. Dashboard Walkthrough](#11-dashboard-walkthrough)
- [12. Troubleshooting](#12-troubleshooting)
- [13. Repository Structure](#13-repository-structure)
- [14. Team](#14-team)

---

## 1. The Problem

India's UPI network processes **500+ crore transactions per month**. Even a fraud rate of 0.1% translates to roughly **50 lakh fraudulent transactions** slipping through every month. At global scale, an estimated **$3 trillion** is laundered annually through networks just like this.

Modern financial crime doesn't look like a single suspicious account anymore — it looks like a **network**: mule accounts, layered transfers, and circular flows designed specifically to defeat account-level fraud checks.

**Traditional fraud detection is structurally blind to this.** It scores each transaction in isolation and has no concept of the graph that makes the pattern a crime in the first place.

---

## 2. Our Solution — Defense in Depth

MuleHunter reframes the question from *"does this transaction look suspicious?"* to *"does this entire network of relationships look suspicious?"*

We fuse five independent signal sources into one real-time decision:

| Signal | Weight | What it catches |
|---|---|---|
| **GraphSAGE + GAT GNN** | 40% | Structural fraud patterns via message-passing across the transaction graph |
| **Extended Isolation Forest (EIF)** | 20% | Behavioral anomalies invisible to graph structure alone |
| **Behavioral scoring** | 25% | Velocity, burst activity, amount deviation |
| **Graph context** | 10% | Direct + two-hop neighbourhood fraud density |
| **JA3 TLS fingerprinting** | 5% | Bot / shared-infrastructure detection at the network layer |

Every decision is written to an append-only, Merkle-tree-backed audit ledger for full explainability and tamper-evidence.

---

## 3. Verified Performance

Benchmarked on the full IEEE-CIS dataset (590,540 transactions → 14,318 account nodes, 75,488 edges):

```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│    AUC-ROC        │    F1 Score       │    Precision      │    Recall         │
│    0.9906          │    0.8604         │    0.8669         │    0.8539         │
│  target >0.90 ✓    │  target >0.80 ✓   │  1.9% false alarm │  85.4% caught     │
├──────────────────┼──────────────────┼──────────────────┼──────────────────┤
│  Inference         │  Rings Detected   │  Graph Size        │  Training Time     │
│  < 50ms p99        │  300               │  14,318 nodes       │  ~26 min (CPU)      │
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

> These are training-time scientific benchmarks. The live "Operational Audit" numbers shown on the dashboard's **Metrics** tab are computed independently against your seeded transaction data and may differ — this is intentional and explained on that page.

---

## 4. System Architecture

```
                         ┌─────────────────────────┐
                         │   Control Tower (UI)     │
                         │   Next.js 16 · :3000      │
                         └────────────┬─────────────┘
                                      │ REST / SSE
                         ┌────────────▼─────────────┐
                         │   Backend Orchestrator     │
                         │   Spring Boot · :8082       │
                         │   (14-step scoring pipeline)│
                         └───┬─────────┬─────────┬────┘
                 ┌───────────┘         │         └───────────┐
                 ▼                     ▼                     ▼
     ┌───────────────────┐ ┌────────────────────┐ ┌──────────────────────┐
     │   AI Engine          │ │  Visual Analytics    │ │  Security Forensics    │
     │   FastAPI · :8001     │ │  (EIF) FastAPI · :8000│ │  Spring Boot · :8081    │
     │   GraphSAGE+GAT GNN   │ │  Extended Isolation   │ │  JA3 · Merkle Ledger     │
     │                       │ │  Forest + SHAP         │ │  Blockchain Audit Trail  │
     └───────────────────┘ └────────────────────┘ └──────────────────────┘
                 │
                 ▼
       ┌───────────────────┐
       │     MongoDB           │
       │     :27017              │
       └───────────────────┘
```

**Pipeline per transaction:** Validate → Persist → Identity Forensics → Update Aggregates → Behavioral Features → Graph Context → **EIF ‖ GNN (parallel)** → Risk Fusion → Decision Policy → Commit → Blockchain Log (async).

---

## 5. Service & Port Map

Everything below runs on **localhost only** — no external IPs are required or used anywhere in this stack.

| Service | Technology | Port | Health Check |
|---|---|---|---|
| Control Tower (frontend) | Next.js 16 | `3000` | `http://localhost:3000` |
| Backend Orchestrator | Spring Boot | `8082` | `http://localhost:8082/api/health/ai` |
| Security Forensics | Spring Boot | `8081` | `http://localhost:8081/api/security/status` |
| AI Engine (GNN) | FastAPI / Uvicorn | `8001` | `http://localhost:8001/health` |
| Visual Analytics (EIF) | FastAPI / Uvicorn | `8000` | `http://localhost:8000/v1/eif/metrics` |
| MongoDB | Docker container | `27017` | `docker ps` shows `mule_mongo` |

> ⚠️ **Note on internal ports:** the AI Engine's Dockerfile `EXPOSE`s and binds uvicorn to **8001** internally (not 8000). If you're editing `docker-compose.yml`, the port mapping must be `"8001:8001"`, and any inter-container reference must use `ai-engine:8001`, not `:8000`. Similarly, Security Forensics binds to **8081** internally per its own `application.properties` — do not point `security.service.url` at `8080`.

---

## 6. Prerequisites

Install these before starting. Version pins matter — especially for the AI Engine.

| Tool | Required Version | Check |
|---|---|---|
| **Docker Desktop** | Latest, must be running | `docker --version` |
| **Node.js** | v20+ | `node --version` |
| **Java JDK** | Exactly 17 | `java --version` |
| **Maven** | 3.9+ | `mvn --version` |
| **Python** | 3.10 or 3.11 (not 3.12+) | `python --version` |
| **pip** | ≥ 23 | `pip install --upgrade pip` |

---

## 7. Complete Local Setup

Follow these in order. Every command below assumes you're starting from the repository root.

### 7.1 Clone & Environment Files

```bash
git clone <your-repo-url> mule-hunter
cd mule-hunter
```

### 7.2 Database — MongoDB via Docker

```bash
docker run -d -p 27017:27017 --name mule_mongo mongo:latest
docker ps    # confirm mule_mongo is Up on port 27017
```

### 7.3 Seeding Graph & User Data

The frontend's seed scripts populate MongoDB from the pre-processed graph CSVs in `shared-data/`.

```bash
cd control-tower/lib
node --env-file=../.env.local seedDb.js     # seeds nodes.csv + transactions.csv
node seedUser.js                            # seeds the demo login user
cd ../..
```

You should see:
```
✅ Seeded 14,318 Nodes
✅ Seeded 75,488 Transactions
User created!
```

### 7.4 AI Engine (GraphSAGE + GAT GNN)

> 🚨 **Do not `pip install -r requirements.txt` directly.** PyTorch Geometric's sparse backends must be installed in a specific order from a dedicated wheel index, or the import will fail with cryptic `torch_scatter` errors.

```bash
cd ai-engine
python -m venv .venv

# activate:
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\activate           # Windows PowerShell

pip install --upgrade pip
pip install torch==2.3.1
pip install torch-scatter torch-sparse -f https://data.pyg.org/whl/torch-2.3.1+cpu.html
pip install torch-geometric==2.5.3
pip install fastapi==0.115.0 "uvicorn[standard]==0.30.6" pydantic==2.8.2 \
            pandas==2.2.2 numpy==1.26.4 scikit-learn==1.5.1 networkx==3.3 httpx
```

Start the service (this binds to **8001**, matching the Dockerfile):

```bash
python -m uvicorn inference_service:app --host 0.0.0.0 --port 8001 --reload
```

Verify: `curl http://localhost:8001/health` → `"status": "HEALTHY"`, `"model_loaded": true`.

### 7.5 Visual Analytics (Extended Isolation Forest)

New terminal:

```bash
cd visual-analytics/eif_v_2
python -m venv .venv
source .venv/bin/activate        # or .venv\Scripts\activate on Windows

pip install --upgrade pip
pip install numpy==1.26.4 Cython==0.29.36 wheel setuptools
pip install --no-build-isolation eif==2.0.2
pip install fastapi uvicorn scikit-learn pandas joblib pydantic

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify: `curl http://localhost:8000/v1/eif/metrics` returns the training eval report.

### 7.6 Security Forensics (JA3 + Blockchain Ledger)

New terminal:

```bash
cd security-forensics
mvn clean package -DskipTests
java -jar target/security-forensics-1.0.0.jar
```

This binds to **8081** (see `src/main/resources/application.properties`). Verify:
```bash
curl http://localhost:8081/api/security/status
# {"status":"UP","service":"security-forensics","port":"8081"}
```

### 7.7 Backend (Spring Boot Orchestrator)

Confirm `backend/src/main/resources/application.properties` points entirely at localhost:

```properties
spring.application.name=backend
jwt.secret=<your-secret>
visual.internal-api-key=visual-analytics-secret-123
spring.data.mongodb.uri=mongodb://localhost:27017/mule_hunter_auth
security.service.url=http://localhost:8081
ai.service.url=http://localhost:8001
eif.service.url=http://localhost:8000
visual.service.url=http://localhost:8000
spring.mvc.async.request-timeout=-1
server.port=8082
```

New terminal:

```bash
cd backend
mvn spring-boot:run
```

This serves on **8082** (container-internal 8080, per its Dockerfile — irrelevant for local `mvn` runs, which respect `server.port=8082` directly).

### 7.8 Frontend (Control Tower)

Create `control-tower/.env.local`:

```env
# ─── MuleHunter Control Tower — Local Dev Environment ───

NEXTAUTH_SECRET=mule-hunter-super-secret-2026-national-demo
NEXTAUTH_URL=http://localhost:3000

JWT_SECRET=mule-hunter-jwt-secret-2026-national-presentation

MONGODB_URI=mongodb://localhost:27017/mule_hunter_auth

NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:8082
NEXT_PUBLIC_API_URL=http://localhost:8082
NEXT_PUBLIC_ML_URL=http://localhost:8001

ANTHROPIC_API_KEY=
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=
```

New terminal:

```bash
cd control-tower
npm install
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

---

## 8. One-Shot Docker Compose (Alternative)

If you'd rather not run six terminals, the root `docker-compose.yml` brings everything up together on an internal Docker network. Container-to-container calls use service names, not `localhost`:

```bash
docker compose up --build
```

Internally:
- `backend` reaches AI Engine at `http://ai-engine:8001` (not `:8000` — the container binds 8001)
- `backend` reaches Security Forensics at `http://security-forensics:8081` (not `:8080`)
- `backend` reaches Visual Analytics at `http://visual-analytics:8000`

From your host machine, everything is still reachable at the same `localhost` ports listed in [§5](#5-service--port-map).

---

## 9. Login Credentials

Seeded by `seedUser.js` — use exactly these:

| Field | Value |
|---|---|
| **Email** | `user@test.com` |
| **Password** | `userPassword` |
| **Role** | `admin` |

> These are demo-only credentials for local evaluation. Do not reuse this password pattern anywhere else.

---

## 10. Verifying Everything Is Wired Correctly

Run these five checks in order before you present. If any fails, fix it before moving to the next.

```bash
# 1. Database
docker ps | grep mule_mongo

# 2. AI Engine
curl -s http://localhost:8001/health | grep '"model_loaded":true'

# 3. Visual Analytics
curl -s http://localhost:8000/v1/eif/metrics | grep '"f1"'

# 4. Security Forensics
curl -s http://localhost:8081/api/security/status | grep '"status":"UP"'

# 5. Backend (proxies AI health)
curl -s http://localhost:8082/api/health/ai | grep '"status":"HEALTHY"'
```

Then log into `http://localhost:3000/login` with the credentials in [§9](#9-login-credentials) and confirm the **AI System Ready** banner shows green on the Transaction page.

---

## 11. Dashboard Walkthrough

The Control Tower dashboard has nine sections, each independently wired to a different service — walk through all of them once before presenting, since each fails independently:

| Tab | Backed By | What to check |
|---|---|---|
| **Simulator** | Backend `/api/transactions` | Full 14-step pipeline runs end-to-end |
| **GNN** | AI Engine `/network-snapshot` | Live node/edge counts populate |
| **EIF** | Visual Analytics `/v1/eif/score` | Score a transaction first, then view |
| **Identity** | Security Forensics via Backend | JA3/device signals populate after a scored tx |
| **Fusion** | Backend risk-fusion output | Weighted breakdown matches Simulator result |
| **Rings** | AI Engine `/detect-rings` | Pre-cached at AI Engine startup — restart it to refresh |
| **Clusters** | AI Engine `/cluster-report` | Community fraud-rate table |
| **Blockchain** | Backend `/api/admin/stats` | Live audit log entries |
| **Metrics** | Backend `/api/admin/evaluate-models` | Scientific vs. operational metrics side-by-side |

> **Ring/Cluster data is computed once at AI Engine startup** (bounded 20–25s DFS) and does not refresh automatically as you send new transactions. If you want a fresh ring detected live, restart the AI Engine shortly before that part of the demo.

---

## 12. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login page shows different creds than what works | Stale cached page / wrong branch | Confirm you're using `user@test.com` / `userPassword` per [§9](#9-login-credentials) |
| "AI System Initializing…" never resolves | AI Engine not running, or wrong port in `.env.local` | Confirm `curl localhost:8001/health` works; check `NEXT_PUBLIC_ML_URL` |
| GNN score always 0.0000 | AI Engine unreachable, or `security.service.url` misconfigured | Recheck [§10](#10-verifying-everything-is-wired-correctly) checklist top to bottom |
| EIF score always 0.0000 | `visual.service.url` / `eif.service.url` pointing at wrong port | Must be `8000`, not `8001` |
| `403` on visual pipeline calls | `visual.internal-api-key` mismatch between backend and visual-analytics env | Ensure identical value in both configs |
| CORS errors in browser console | Origin not in backend's allowlist | Add your dev origin in `WebConfig.java`'s `allowedOrigins(...)` |
| Rings/Clusters tab looks stale after new transactions | Expected — ring cache is startup-only | Restart AI Engine to force recompute |
| PDF audit download fails | Known issue, feature intentionally disabled in UI | Do not re-enable for live demo |

---

## 13. Repository Structure

```
mule-hunter/
├── control-tower/          # Next.js 16 frontend — dashboard, auth, payment demo
├── backend/                 # Spring Boot orchestrator — 14-step scoring pipeline
├── ai-engine/                # FastAPI — GraphSAGE+GAT GNN training & inference
├── visual-analytics/          # FastAPI — Extended Isolation Forest + SHAP
│   └── eif_v_2/
├── security-forensics/         # Spring Boot — JA3 fingerprinting + Merkle blockchain ledger
├── shared-data/                 # Seeded graph CSVs (nodes, transactions, model artifacts)
├── contracts/                    # OpenAPI / JSON Schema contracts between services
└── docker-compose.yml              # One-shot local orchestration
```


---

*MuleHunter — because every fraudster leaves a trace in the graph.*

</div>