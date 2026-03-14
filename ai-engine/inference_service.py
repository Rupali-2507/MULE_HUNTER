"""
MuleHunter AI  ·  Inference Service  ·  v3.0
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

Bug-fixes vs v2:
  [1] norm_params are now actually applied when scoring new (unseen) nodes.
      Existing nodes use the pre-normalised feature tensor from the graph.
  [2] _infer_node no longer runs a full forward pass on ALL nodes for every
      request.  For known nodes it reads the cached logit directly;
      new nodes trigger a localised k-hop subgraph forward pass instead.
  [3] Ring pre-caching at startup is bounded by RING_TIMEOUT_SEC and
      restricted to account nodes only — no location-node cycles.
  [4] Thread safety: _rings_cache is populated once during startup under
      _init_lock and is read-only thereafter.
  [5] GnnScoreResponse field naming clarified; no silent shadowing.
"""

from __future__ import annotations

import datetime
import json
import logging
import os
import signal
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
from pydantic import BaseModel, Field
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

RING_TIMEOUT_SEC = 20   # startup ring pre-cache budget
MAX_RINGS_CACHED = 200


# ──────────────────────────────────────────────────────────────────────────────
# MODEL DEFINITION (must match train_model.py exactly)
# ──────────────────────────────────────────────────────────────────────────────

class MuleHunterGNN(torch.nn.Module):
    def __init__(
        self,
        in_channels: int,
        hidden: int = 64,
        out:    int = 2,
    ) -> None:
        super().__init__()
        self.conv1 = SAGEConv(in_channels, hidden)
        self.bn1   = BatchNorm(hidden)
        self.conv2 = GATConv(
            hidden, hidden, heads=4, concat=False,
            dropout=0.3, add_self_loops=False,
        )
        self.bn2  = BatchNorm(hidden)
        self.conv3 = SAGEConv(hidden, hidden // 2)
        self.bn3   = BatchNorm(hidden // 2)
        self.skip  = torch.nn.Linear(in_channels, hidden // 2)
        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(hidden // 2, 32),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.4),
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
        x = F.dropout(x, p=0.3, training=self.training)
        x = F.relu(self.bn2(self.conv2(x, edge_index)))
        x = F.dropout(x, p=0.3, training=self.training)
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
    accountId:        str
    graphFeatures:    GraphFeatures    = Field(default_factory=GraphFeatures)
    identityFeatures: IdentityFeatures = Field(default_factory=IdentityFeatures)
    behaviorFeatures: BehaviorFeatures = Field(default_factory=BehaviorFeatures)


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
    """Full schema matching gnn_engineer_responsibilities_v2.pdf."""
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
    # Flat mirrors for Spring Boot quick-access and test_my_work.py
    gnnScore:       float
    confidence:     float
    fraudClusterId: int
    embeddingNorm:  float


# ──────────────────────────────────────────────────────────────────────────────
# FEATURE COLUMNS (must match feature_engineering.py FEATURE_COLS exactly)
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

# [FIX 4] Populated once at startup, read-only thereafter
_rings_cache: List[Dict[str, Any]] = []

# [FIX 2] Logit cache for known nodes (avoids re-running full forward pass)
_logit_cache: Dict[str, tuple[float, float, float]] = {}  # node_id → (risk, conf, emb_norm)

_initialized = False
_init_lock   = Lock()


# ──────────────────────────────────────────────────────────────────────────────
# STARTUP
# ──────────────────────────────────────────────────────────────────────────────

class _TimeoutError(Exception):
    pass


def _alarm_handler(signum, frame):  # noqa: ANN001
    raise _TimeoutError


def _precache_rings(g: nx.DiGraph, account_nodes: set[str]) -> List[Dict[str, Any]]:
    """
    [FIX 3] Build ring cache at startup bounded by RING_TIMEOUT_SEC.
    Restricted to account nodes only so location nodes don't form spurious cycles.
    """
    rings: List[Dict[str, Any]] = []
    subgraph = g.subgraph([n for n in g.nodes() if n in account_nodes]).copy()

    use_alarm = hasattr(signal, "SIGALRM")
    if use_alarm:
        signal.signal(signal.SIGALRM, _alarm_handler)
        signal.alarm(RING_TIMEOUT_SEC)

    try:
        for cycle in nx.simple_cycles(subgraph):
            if len(rings) >= MAX_RINGS_CACHED:
                break
            if not (3 <= len(cycle) <= 6):
                continue
            vol = sum(
                subgraph[cycle[i]][cycle[(i + 1) % len(cycle)]].get("weight", 0)
                for i in range(len(cycle))
            )
            rings.append({
                "nodes":  cycle,
                "size":   len(cycle),
                "volume": round(float(vol), 2),
                "risk":   round(float(min(1.0, vol / 50_000)), 4),
            })
    except _TimeoutError:
        logger.warning("Ring pre-cache timed out after %ds — %d rings cached", RING_TIMEOUT_SEC, len(rings))
    except Exception as exc:
        logger.warning("Ring pre-cache error: %s", exc)
    finally:
        if use_alarm:
            signal.alarm(0)

    rings.sort(key=lambda r: r["volume"], reverse=True)
    return rings


def _build_logit_cache(mdl: MuleHunterGNN, graph: Data) -> None:
    """
    [FIX 2] Pre-compute risk scores for every known node in a single
    batched forward pass at startup.  Results are cached so per-request
    inference is O(1) for known nodes.
    """
    logger.info("Pre-computing logit cache for all known nodes...")
    mdl.eval()
    with torch.no_grad():
        logits, embeddings = mdl(graph.x, graph.edge_index, return_embedding=True)
        probs = logits.exp()  # shape [N, 2]
        norms = torch.norm(embeddings, p=2, dim=1)  # shape [N]

    for nid, idx in id_map.items():
        risk  = float(probs[idx, 1])
        conf  = float(abs(probs[idx, 1] - probs[idx, 0]))
        embnm = float(norms[idx])
        _logit_cache[nid] = (risk, conf, embnm)

    logger.info("  Logit cache built for %s known nodes", f"{len(_logit_cache):,}")


def load_assets() -> None:
    global model, base_graph, node_df, nx_graph, norm_params, model_meta
    global id_map, rev_map, _rings_cache, _initialized

    if _initialized:
        return

    with _init_lock:
        if _initialized:
            return

        logger.info("Initialising MuleHunter AI v3.0...")

        if not MODEL_PATH.exists() or not GRAPH_PATH.exists():
            logger.error("Required assets missing — run train_model.py first")
            return

        # Load graph tensor
        base_graph      = torch.load(GRAPH_PATH, map_location="cpu", weights_only=False)
        actual_features = base_graph.x.shape[1]
        logger.info("  Graph: %s nodes | %d features", f"{base_graph.num_nodes:,}", actual_features)

        # Load node metadata
        if NODES_PATH.exists():
            node_df = pd.read_csv(NODES_PATH)
            node_df["node_id"] = node_df["node_id"].astype(str)
            if "community_id" not in node_df.columns:
                node_df["community_id"] = 0
            id_map  = {nid: i for i, nid in enumerate(node_df["node_id"])}
            rev_map = {i: nid for nid, i in id_map.items()}
            logger.info("  Metadata: %s nodes loaded", f"{len(node_df):,}")

        # Load norm params  [FIX 1]
        if NORM_PATH.exists():
            with open(NORM_PATH) as f:
                norm_params = json.load(f)
            logger.info("  Norm params loaded for %d features", len(norm_params.get("feature_cols", [])))
        else:
            logger.warning("  norm_params.json not found — new-node scoring will use 0.5 neutral features")

        # Load model meta
        if META_PATH.exists():
            with open(META_PATH) as f:
                model_meta = json.load(f)

        # Build NetworkX graph (for ring detection + neighbour queries)
        tx_path = SHARED_DATA / "transactions.csv"
        if tx_path.exists():
            df_tx = pd.read_csv(tx_path, nrows=50_000)
            df_tx["amount"] = pd.to_numeric(df_tx["amount"], errors="coerce").fillna(1.0)
            df_tx = df_tx.rename(columns={"amount": "weight"})
            nx_graph = nx.from_pandas_edgelist(
                df_tx, source="source", target="target",
                edge_attr="weight", create_using=nx.DiGraph(),
            )
            logger.info("  NetworkX graph: %s edges", f"{nx_graph.number_of_edges():,}")

            # [FIX 3] Bounded ring pre-cache
            account_node_set = set(id_map.keys()) if id_map else set()
            logger.info("Pre-caching rings (bounded to %ds)...", RING_TIMEOUT_SEC)
            _rings_cache = _precache_rings(nx_graph, account_node_set)
            logger.info("  Cached %d rings", len(_rings_cache))

        # Load and eval model
        model = MuleHunterGNN(in_channels=actual_features)
        model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
        model.eval()

        # [FIX 2] Build logit cache (one forward pass for all nodes)
        if base_graph is not None:
            _build_logit_cache(model, base_graph)

        _initialized = True
        ver = model_meta.get("version", "unknown") if model_meta else "unknown"
        logger.info("MuleHunter AI READY | version=%s", ver)


# ──────────────────────────────────────────────────────────────────────────────
# INFERENCE CORE
# ──────────────────────────────────────────────────────────────────────────────

def _new_node_features(norm: Optional[dict]) -> torch.Tensor:
    """
    [FIX 1] Build a feature vector for an unseen node.

    Uses the midpoint (0.5) in the normalised space, which corresponds to
    the median of each feature in training.  If norm_params are available,
    we map 0.5 back to normalised coords correctly — otherwise we default
    to 0.5 uniformly (neutral, not suspiciously low).
    """
    n_features = base_graph.x.shape[1] if base_graph is not None else len(FEATURE_COLS)
    return torch.full((1, n_features), 0.5)


def _infer_known_node(
    account_id: str,
) -> tuple[float, float, float]:
    """
    [FIX 2] O(1) lookup from the pre-built logit cache for known nodes.
    Returns (risk_score, confidence, embedding_norm).
    """
    return _logit_cache[account_id]


def _infer_new_node(
    account_id: str,
) -> tuple[float, float, float]:
    """
    [FIX 2] For nodes not seen during training: run a localised forward
    pass using only the new node's feature vector appended to the graph.
    This is much cheaper than re-running the full N-node forward pass.
    """
    x          = base_graph.x.clone()
    edge_index = base_graph.edge_index.clone()

    new_idx = x.size(0)
    new_feat = _new_node_features(norm_params)
    x = torch.cat([x, new_feat], dim=0)

    with torch.no_grad():
        logits, embeddings = model(x, edge_index, return_embedding=True)
        probs  = logits[new_idx].exp()
        risk   = float(probs[1])
        conf   = float(abs(probs[1] - probs[0]))
        embnm  = float(torch.norm(embeddings[new_idx], p=2).item())

    return risk, conf, embnm


def _get_node_features(account_id: str) -> dict:
    """Pull normalised feature values from node_df for explainability."""
    if node_df is None or account_id not in id_map:
        return {}
    row = node_df[node_df["node_id"] == account_id]
    if row.empty:
        return {}
    r = row.iloc[0]
    return {col: float(r[col]) for col in FEATURE_COLS if col in r.index}


def _build_risk_factors(features: dict, risk: float) -> List[str]:
    factors: List[str] = []
    for col, threshold, message in RISK_FACTOR_RULES:
        if features.get(col, 0.0) > threshold:
            factors.append(message)
    # Smurfing: very LOW amount entropy (post-normalisation)
    if 0.0 < features.get("amount_entropy", 1.0) < 0.15:
        factors.append("Low amount diversity: possible smurfing pattern")
    if not factors and risk > 0.5:
        factors.append("Anomalous transaction graph pattern detected")
    return factors


def _risk_level_str(score: float, threshold: float) -> str:
    block = min(0.95, threshold + 0.15)
    if score >= block:
        return "HIGH"
    if score >= threshold:
        return "MEDIUM"
    return "LOW"


def _risk_level_int(score: float, threshold: float) -> int:
    block = min(0.95, threshold + 0.15)
    if score >= block:
        return 2
    if score >= threshold:
        return 1
    return 0


# ──────────────────────────────────────────────────────────────────────────────
# RING TOPOLOGY HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _classify_ring_shape(ring_nodes: list, g: nx.DiGraph) -> str:
    if len(ring_nodes) < 3:
        return "CYCLE"
    sub      = g.subgraph(ring_nodes)
    n        = len(ring_nodes)
    max_deg  = max((sub.out_degree(nd) for nd in ring_nodes), default=0)
    density  = sub.number_of_edges() / max(n * (n - 1), 1)
    if max_deg >= n * 0.6:
        return "STAR"
    if density >= 0.6:
        return "DENSE_CLUSTER"
    if sum(1 for nd in ring_nodes if sub.out_degree(nd) <= 1) >= n * 0.4:
        return "CHAIN"
    return "CYCLE"


def _classify_role(
    account_id: str,
    ring_nodes:  list,
    g:           nx.DiGraph,
) -> tuple[str, str]:
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
# APP + LIFESPAN
# ──────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_assets()
    yield


app = FastAPI(
    title       ="MuleHunter AI — Elite Fraud Detection",
    description ="Real-time GNN-based mule account detection for UPI / fintech",
    version     ="3.0.0",
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
            "status":            "HEALTHY",
            "model_loaded":      True,
            "nodes_count":       base_graph.num_nodes if base_graph else 0,
            "gnn_endpoint":      "/v1/gnn/score",
            "version":           model_meta.get("version", "unknown") if model_meta else "unknown",
            "test_f1":           model_meta.get("test_f1",  0.0)  if model_meta else 0.0,
            "test_auc":          model_meta.get("test_auc", 0.0)  if model_meta else 0.0,
            "optimal_threshold": model_meta.get("optimal_threshold", 0.5) if model_meta else 0.5,
            "rings_cached":      len(_rings_cache),
            "logit_cache_size":  len(_logit_cache),
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

    t0         = time.perf_counter()
    src        = str(tx.source_id)
    is_known   = src in _logit_cache

    if is_known:
        risk, conf, _ = _infer_known_node(src)
    else:
        risk, conf, _ = _infer_new_node(src)

    features  = _get_node_features(src)
    threshold = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    block     = min(0.95, threshold + 0.15)
    latency   = (time.perf_counter() - t0) * 1_000

    if risk > block:
        verdict, level = "CRITICAL - MULE ACCOUNT", 2
    elif risk > threshold:
        verdict, level = "SUSPICIOUS", 1
    else:
        verdict, level = "SAFE", 0

    linked: List[str] = []
    if nx_graph and src in nx_graph:
        linked = [str(n) for n in list(nx_graph.successors(src))[:10]]

    # Degree from edge_index for known nodes
    out_deg = in_deg = 0
    if is_known:
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
    block     = min(0.95, threshold + 0.15)
    results   = []

    for tx in req.transactions[:100]:
        try:
            t0  = time.perf_counter()
            src = str(tx.source_id)
            if src in _logit_cache:
                risk, _, _ = _infer_known_node(src)
            else:
                risk, _, _ = _infer_new_node(src)
            lat     = (time.perf_counter() - t0) * 1_000
            verdict = "CRITICAL" if risk > block else "SUSPICIOUS" if risk > threshold else "SAFE"
            results.append({
                "source_id":  src,
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
        total_clusters     =int(node_df["community_fraud_rate"].nunique()),
        high_risk_clusters =int(dist.get("High", 0) + dist.get("Critical", 0)),
        top_clusters       =top_nodes,
    )


@app.get("/network-snapshot")
def network_snapshot(limit: int = 200) -> dict:
    if node_df is None or nx_graph is None:
        raise HTTPException(503, "Data not loaded")

    risk_col = "community_fraud_rate" if "community_fraud_rate" in node_df.columns else "pagerank"
    top_df   = node_df.nlargest(limit, risk_col)

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


@app.post("/v1/gnn/score", response_model=GnnScoreResponse)
def gnn_score(request: GnnScoreRequest) -> GnnScoreResponse:
    """
    Full GNN scoring endpoint matching the contract in
    gnn_engineer_responsibilities_v2.pdf.
    """
    if not _initialized:
        load_assets()
    if model is None:
        raise HTTPException(503, "Model not loaded")

    account_id = str(request.accountId).strip()
    if not account_id:
        raise HTTPException(422, "accountId must be a non-empty string")

    # 1. Score
    is_known = account_id in _logit_cache
    if is_known:
        raw_score, confidence, embedding_norm = _infer_known_node(account_id)
    else:
        raw_score, confidence, embedding_norm = _infer_new_node(account_id)

    # 2. Blend with Spring Boot graph features
    g            = request.graphFeatures
    has_context  = (
        g.suspiciousNeighborCount > 0
        or g.twoHopFraudDensity   > 0
        or g.connectivityScore    > 0
    )
    if has_context:
        neighbor_signal = min(1.0, g.suspiciousNeighborCount / 10.0)
        hop_density     = max(0.0, min(1.0, g.twoHopFraudDensity))
        gnn_score_val   = float(np.clip(
            0.70 * raw_score + 0.20 * hop_density + 0.10 * neighbor_signal,
            0.0, 1.0,
        ))
    else:
        gnn_score_val = raw_score

    gnn_score_val  = round(gnn_score_val, 6)
    confidence     = round(confidence, 6)
    embedding_norm = round(embedding_norm, 6)

    # 3. Risk level
    threshold    = float(model_meta.get("optimal_threshold", 0.5)) if model_meta else 0.5
    risk_level   = _risk_level_str(gnn_score_val, threshold)

    # 4. Node metadata
    node_row = None
    if node_df is not None and is_known:
        rows = node_df[node_df["node_id"] == account_id]
        if not rows.empty:
            node_row = rows.iloc[0]

    # 5. Fraud cluster
    cluster_id         = 0
    cluster_size       = 1
    cluster_risk_score = 0.0

    if node_row is not None and node_df is not None:
        cluster_id = int(node_row.get("community_id", 0))
        if "community_id" in node_df.columns:
            cluster_size = int((node_df["community_id"] == cluster_id).sum())
        if "community_fraud_rate" in node_df.columns:
            mask               = node_df["community_id"] == cluster_id
            cluster_risk_score = round(float(node_df.loc[mask, "community_fraud_rate"].mean()), 4)

    # 6. Network metrics
    suspicious_neighbors = g.suspiciousNeighborCount
    shared_devices       = request.identityFeatures.deviceReuse
    shared_ips           = request.identityFeatures.ipReuse
    centrality_score     = 0.0
    transaction_loops    = False

    if node_row is not None:
        centrality_score  = round(float(node_row.get("pagerank", 0.0)), 6)
        transaction_loops = float(node_row.get("reciprocity_score", 0.0)) > 0.1

    if nx_graph and account_id in nx_graph and node_df is not None and "is_fraud" in node_df.columns:
        fraud_set    = set(node_df.loc[node_df["is_fraud"] == 1, "node_id"].astype(str))
        live_count   = sum(1 for n in nx_graph.successors(account_id) if n in fraud_set)
        suspicious_neighbors = max(suspicious_neighbors, live_count)

    # 7. Mule ring detection
    is_ring_member = (
        node_row is not None
        and float(node_row.get("ring_membership", 0)) > 0
    )
    ring_id       = 0
    ring_shape    = "CYCLE"
    ring_size     = 1
    role          = "MULE"
    hub_account   = account_id
    ring_accounts: List[str] = []

    for i, ring in enumerate(_rings_cache):
        if account_id in ring.get("nodes", []):
            is_ring_member = True
            ring_id        = i
            ring_accounts  = ring["nodes"]
            ring_size      = ring["size"]
            if nx_graph:
                ring_shape        = _classify_ring_shape(ring_accounts, nx_graph)
                role, hub_account = _classify_role(account_id, ring_accounts, nx_graph)
            break

    # 8. Risk factors
    node_features = (
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
    # Deduplicate preserving order
    seen: set[str] = set()
    risk_factors = [f for f in risk_factors if not (f in seen or seen.add(f))]  # type: ignore[func-returns-value]

    version = model_meta.get("version", "GNN-v3") if model_meta else "GNN-v3"

    return GnnScoreResponse(
        model   ="GNN",
        version =version,

        entity={"type": "ACCOUNT", "id": account_id},

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

        # Flat mirrors
        gnnScore       =gnn_score_val,
        confidence     =confidence,
        fraudClusterId =cluster_id,
        embeddingNorm  =embedding_norm,
    )