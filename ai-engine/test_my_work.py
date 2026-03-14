"""
MuleHunter AI  ·  Full Test Suite  
============================================
Run:
    python test_my_work.py [--base-url http://localhost:8001] [--shared-data ../shared-data]

The API must already be running on the target port.

"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx
import pandas as pd

# ──────────────────────────────────────────────────────────────────────────────
# CLI args
# ──────────────────────────────────────────────────────────────────────────────
parser = argparse.ArgumentParser(description="MuleHunter test suite")
parser.add_argument(
    "--base-url",
    default="http://localhost:8001",
    help="API base URL (default: http://localhost:8001)",
)
parser.add_argument(
    "--shared-data",
    default=None,
    help="Path to shared-data directory (default: ../shared-data relative to this script)",
)
args = parser.parse_args()

BASE = args.base_url.rstrip("/")

# [FIX 1] Resolve shared-data relative to script, not cwd
if args.shared_data:
    SHARED = Path(args.shared_data).resolve()
else:
    SHARED = (Path(__file__).resolve().parent.parent / "shared-data").resolve()

PASS    = "✅"
FAIL    = "❌"
WARN    = "⚠️ "
results: list[tuple[str, str, str]] = []


def check(name: str, condition: bool, detail: str = "") -> bool:
    status = PASS if condition else FAIL
    results.append((status, name, detail))
    suffix = f" — {detail}" if detail else ""
    print(f"  {status}  {name}{suffix}")
    return condition


def section(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


def get(path: str, timeout: float = 15.0, **params) -> httpx.Response:
    return httpx.get(f"{BASE}{path}", params=params, timeout=timeout)


def post(path: str, payload: dict, timeout: float = 30.0) -> httpx.Response:
    return httpx.post(f"{BASE}{path}", json=payload, timeout=timeout)


# ──────────────────────────────────────────────────────────────────────────────
# 1. FILE CHECKS
# ──────────────────────────────────────────────────────────────────────────────
section("1. FILE CHECKS")

for fname in [
    "mule_model.pth",
    "processed_graph.pt",
    "nodes.csv",
    "norm_params.json",
    "eval_report.json",
    "model_meta.json",
]:
    check(f"{fname} exists", (SHARED / fname).exists(), str(SHARED / fname))


# ──────────────────────────────────────────────────────────────────────────────
# 2. DATA SANITY
# ──────────────────────────────────────────────────────────────────────────────
section("2. DATA SANITY")

df = pd.read_csv(SHARED / "nodes.csv")
check("nodes.csv has rows",            len(df) > 0,                f"{len(df):,} nodes")
check("has 'node_id' column",          "node_id" in df.columns)
check("has 'is_fraud' column",         "is_fraud" in df.columns)
check("has fraud labels",              df["is_fraud"].sum() > 0,   f"{int(df['is_fraud'].sum())} fraud nodes")
check("has ring_membership col",       "ring_membership" in df.columns)
check("has community_fraud_rate",      "community_fraud_rate" in df.columns)
check("has community_id col",          "community_id" in df.columns, "real cluster integer IDs")
check("has second_hop_fraud_rate",     "second_hop_fraud_rate" in df.columns)
check("no NaN in node_id",             df["node_id"].isna().sum() == 0)

fraud_rate = df["is_fraud"].mean()
check("fraud rate is realistic",       0.01 < fraud_rate < 0.30,  f"{fraud_rate:.2%}")

# Grab representative node IDs for later tests
real_node_id  = str(df.iloc[0]["node_id"])
fraud_rows    = df[df["is_fraud"] == 1]
fraud_node_id = str(fraud_rows.iloc[0]["node_id"]) if len(fraud_rows) > 0 else real_node_id
safe_rows     = df[df["is_fraud"] == 0]
safe_node_id  = str(safe_rows.iloc[0]["node_id"]) if len(safe_rows) > 0 else real_node_id

print(f"\n  Test node (real):   {real_node_id}")
print(f"  Test node (fraud):  {fraud_node_id}")
print(f"  Test node (safe):   {safe_node_id}")

# Verify norm_params matches feature column count
with open(SHARED / "norm_params.json") as f:
    norm = json.load(f)

check(
    "norm_params has feature_cols",
    "feature_cols" in norm and len(norm["feature_cols"]) > 0,
    f"{len(norm.get('feature_cols', []))} cols",
)
check(
    "norm_params col_min/max length matches",
    len(norm.get("col_min", [])) == len(norm.get("feature_cols", [])),
)


# ──────────────────────────────────────────────────────────────────────────────
# 3. MODEL PERFORMANCE
# ──────────────────────────────────────────────────────────────────────────────
section("3. MODEL PERFORMANCE")

with open(SHARED / "eval_report.json") as f:
    report = json.load(f)

test = report.get("test", {})
check("F1 score exists",          "f1"       in test)
check("AUC score exists",         "auc_roc"  in test)
check("Precision exists",         "precision" in test)
check("Recall exists",            "recall"    in test)
check("optimal_threshold saved",  "optimal_threshold" in report,
      str(report.get("optimal_threshold")))

f1  = test.get("f1",      0.0)
auc = test.get("auc_roc", 0.0)
check("F1 > 0.50 (beats random)", f1  > 0.50, f"F1={f1:.4f}")
check("AUC > 0.70",               auc > 0.70, f"AUC={auc:.4f}")
check("F1 > 0.80 (target)",       f1  > 0.80, f"{'HIT' if f1  > 0.80 else 'not yet'}")
check("AUC > 0.90 (target)",      auc > 0.90, f"{'HIT' if auc > 0.90 else 'not yet'}")


# ──────────────────────────────────────────────────────────────────────────────
# 4. API CONNECTIVITY
# ──────────────────────────────────────────────────────────────────────────────
section("4. API CONNECTIVITY")

try:
    r    = get("/health")
    data = r.json()
    check("API is reachable",           r.status_code == 200)
    check("status is HEALTHY",          data.get("status") == "HEALTHY")
    check("model_loaded is true",       data.get("model_loaded") is True)
    check("nodes_count > 0",            data.get("nodes_count", 0) > 0,
          f"{data.get('nodes_count')} nodes")
    check("version is present",         bool(data.get("version")))
    check("gnn_endpoint exposed",       "gnn_endpoint" in data)
    check("optimal_threshold present",  "optimal_threshold" in data,
          str(data.get("optimal_threshold")))
    check("rings_cached present",       "rings_cached" in data,
          f"{data.get('rings_cached')} rings")
    check("logit_cache_size present",   "logit_cache_size" in data,
          f"{data.get('logit_cache_size')} nodes cached")
except Exception as exc:
    check("API is reachable", False, str(exc))
    print(f"\n  {WARN}  API is not running. Start it with:")
    print(f"       uvicorn inference_service:app --port 8001 --reload")
    sys.exit(1)


# ──────────────────────────────────────────────────────────────────────────────
# 5. /v1/gnn/score  —  Spring Boot contract
# ──────────────────────────────────────────────────────────────────────────────
section("5. /v1/gnn/score  (Spring Boot contract)")

# 5a. Known node with graph context
r = post("/v1/gnn/score", {
    "accountId": real_node_id,
    "graphFeatures": {
        "suspiciousNeighborCount": 4,
        "twoHopFraudDensity":      0.47,
        "connectivityScore":       0.82,
    },
})
check("returns 200",           r.status_code == 200, f"got {r.status_code}")
d = r.json()

check("has 'model' field",     d.get("model") == "GNN")
check("has 'version' field",   bool(d.get("version")))
check("has 'gnnScore'",        "gnnScore"       in d)
check("has 'confidence'",      "confidence"     in d)
check("has 'fraudClusterId'",  "fraudClusterId" in d)
check("has 'embeddingNorm'",   "embeddingNorm"  in d)
check("has nested 'scores'",   "scores" in d and "gnnScore" in d["scores"])
check("has nested 'fraudCluster'",    "fraudCluster" in d)
check("has nested 'networkMetrics'",  "networkMetrics" in d)
check("has nested 'muleRingDetection'", "muleRingDetection" in d)
check("has 'riskFactors' list",       isinstance(d.get("riskFactors"), list))
check("has 'embedding.embeddingNorm'","embeddingNorm" in d.get("embedding", {}))
check("has 'timestamp'",       bool(d.get("timestamp")))

gnn_score = d.get("gnnScore", -1)
conf      = d.get("confidence", -1)
emb_norm  = d.get("embeddingNorm", 0)

check("gnnScore in [0,1]",     0.0 <= gnn_score <= 1.0, f"{gnn_score:.6f}")
check("confidence in [0,1]",   0.0 <= conf      <= 1.0, f"{conf:.6f}")
check("embeddingNorm > 0",     emb_norm > 0,             f"{emb_norm:.6f}")

# 5b. Fraud node should score higher than safe node  [FIX 3]
r_fraud = post("/v1/gnn/score", {"accountId": fraud_node_id, "graphFeatures": {}})
r_safe  = post("/v1/gnn/score", {"accountId": safe_node_id,  "graphFeatures": {}})
fraud_score = r_fraud.json().get("gnnScore", 0.0)
safe_score  = r_safe.json().get("gnnScore",  1.0)
check(
    "fraud node scores higher than safe node",
    fraud_score > safe_score,
    f"fraud={fraud_score:.4f} safe={safe_score:.4f}",
)
check("fraud node score > 0.3", fraud_score > 0.3, f"{fraud_score:.4f}")

# 5c. Unknown node
r3 = post("/v1/gnn/score", {"accountId": "BRAND_NEW_ACCOUNT_XYZ_99999", "graphFeatures": {}})
check("unknown node returns 200",  r3.status_code == 200)
check("unknown node has gnnScore", "gnnScore" in r3.json())

# 5d. Missing graphFeatures (all defaults)
r4 = post("/v1/gnn/score", {"accountId": real_node_id})
check("missing graphFeatures ok",  r4.status_code == 200)

# 5e. Empty accountId should return 422
r5 = post("/v1/gnn/score", {"accountId": ""})
check("empty accountId → 422",     r5.status_code == 422)


# ──────────────────────────────────────────────────────────────────────────────
# 6. /analyze-transaction
# ──────────────────────────────────────────────────────────────────────────────
section("6. /analyze-transaction  (dashboard)")

r = post("/analyze-transaction", {
    "source_id": real_node_id,
    "target_id": "some_dest",
    "amount":    4500,
})
check("returns 200",               r.status_code == 200)
d = r.json()
check("has risk_score",            "risk_score" in d)
check("has verdict",               "verdict" in d)
check("has risk_factors",          "risk_factors" in d)
check("has ring_detected",         "ring_detected" in d)
check("has latency_ms",            "latency_ms" in d)
check("risk_score in [0,1]",       0.0 <= d.get("risk_score", -1) <= 1.0)
check("latency < 500ms",           d.get("latency_ms", 9999) < 500,  f"{d.get('latency_ms'):.1f}ms")
check("latency < 50ms (target)",   d.get("latency_ms", 9999) < 50,
      f"{'HIT' if d.get('latency_ms', 9999) < 50 else 'optimise further'}")


# ──────────────────────────────────────────────────────────────────────────────
# 7. /analyze-batch
# ──────────────────────────────────────────────────────────────────────────────
section("7. /analyze-batch")

r = post("/analyze-batch", {
    "transactions": [
        {"source_id": real_node_id,  "target_id": "dst1", "amount": 1000},
        {"source_id": fraud_node_id, "target_id": "dst2", "amount": 5000},
        {"source_id": "new_acc_xyz", "target_id": "dst3", "amount": 250},
    ],
})
check("returns 200",            r.status_code == 200)
d = r.json()
check("has 'count' = 3",        d.get("count") == 3)
check("has 'flagged' field",    "flagged" in d)
check("has 'results' list (3)", len(d.get("results", [])) == 3)


# ──────────────────────────────────────────────────────────────────────────────
# 8. /detect-rings  [FIX 2] explicit timeout
# ──────────────────────────────────────────────────────────────────────────────
section("8. /detect-rings")

r = get("/detect-rings", timeout=30.0, max_size=4, limit=5)
check("returns 200",                r.status_code == 200)
d = r.json()
check("has rings_detected field",   "rings_detected" in d)
check("has high_risk_nodes field",  "high_risk_nodes" in d)
check("rings list present",         isinstance(d.get("rings"), list))
print(f"  ℹ️   rings found in cache: {d.get('rings_detected', 0)}")


# ──────────────────────────────────────────────────────────────────────────────
# 9. /cluster-report
# ──────────────────────────────────────────────────────────────────────────────
section("9. /cluster-report")

r = get("/cluster-report", timeout=10.0)
check("returns 200",              r.status_code == 200)
d = r.json()
check("has total_clusters",       "total_clusters"     in d)
check("has high_risk_clusters",   "high_risk_clusters" in d)
check("has top_clusters list",    isinstance(d.get("top_clusters"), list))


# ──────────────────────────────────────────────────────────────────────────────
# 10. /network-snapshot  [FIX 4] new test
# ──────────────────────────────────────────────────────────────────────────────
section("10. /network-snapshot")

r = get("/network-snapshot", timeout=10.0, limit=50)
check("returns 200",            r.status_code == 200)
d = r.json()
check("has 'nodes' list",       isinstance(d.get("nodes"), list) and len(d["nodes"]) > 0)
check("has 'edges' list",       isinstance(d.get("edges"), list))
check("has 'stats' dict",       isinstance(d.get("stats"), dict))
check("stats has fraud_rate",   "fraud_rate" in d.get("stats", {}))


# ──────────────────────────────────────────────────────────────────────────────
# 11. /metrics
# ──────────────────────────────────────────────────────────────────────────────
section("11. /metrics")

r = get("/metrics", timeout=10.0)
check("returns 200",          r.status_code == 200)
d = r.json()
check("has test metrics",     "test" in d)
check("has val metrics",      "val" in d)
check("has model_config",     "model_config" in d)


# ──────────────────────────────────────────────────────────────────────────────
# 12. SCORE DETERMINISM  [FIX 5] 5 runs
# ──────────────────────────────────────────────────────────────────────────────
section("12. SCORE DETERMINISM (same input → same output)")

scores = []
for _ in range(5):
    r = post("/v1/gnn/score", {
        "accountId": real_node_id,
        "graphFeatures": {"suspiciousNeighborCount": 2},
    })
    scores.append(r.json().get("gnnScore"))

unique_scores = set(scores)
check(
    "5 identical calls = same score",
    len(unique_scores) == 1,
    f"scores: {scores}",
)


# ──────────────────────────────────────────────────────────────────────────────
# 13. NORM PARAMS CONSISTENCY
# ──────────────────────────────────────────────────────────────────────────────
section("13. NORM PARAMS CONSISTENCY")

n_feat_cols = len(norm.get("feature_cols", []))
n_col_min   = len(norm.get("col_min", []))
n_col_max   = len(norm.get("col_max", []))
n_col_range = len(norm.get("col_range", []))

check("feature_cols non-empty",                n_feat_cols > 0,                       f"{n_feat_cols} cols")
check("col_min length matches feature_cols",   n_col_min   == n_feat_cols)
check("col_max length matches feature_cols",   n_col_max   == n_feat_cols)
check("col_range length matches feature_cols", n_col_range == n_feat_cols)

# col_range should be all positive (no zero-range columns)
ranges = norm.get("col_range", [])
check(
    "all col_range values > 0 (no degenerate features)",
    all(r > 0 for r in ranges),
    f"min range = {min(ranges) if ranges else 'n/a'}",
)


# ──────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ──────────────────────────────────────────────────────────────────────────────
print(f"\n{'═' * 60}")
passed = sum(1 for s, _, _ in results if s == PASS)
failed = sum(1 for s, _, _ in results if s == FAIL)
total  = len(results)
print(f"  RESULT:  {passed}/{total} passed   |   {failed} failed")
print(f"{'═' * 60}")

if failed > 0:
    print("\n  Failed checks:")
    for s, name, detail in results:
        if s == FAIL:
            suffix = f" — {detail}" if detail else ""
            print(f"    ❌  {name}{suffix}")
    print()

if failed == 0:
    print("\n  🎉  All checks passed. MuleHunter is production-ready.")
else:
    print("  Fix the ❌ items above before connecting to Spring Boot.")

sys.exit(0 if failed == 0 else 1)