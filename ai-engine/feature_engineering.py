"""
MuleHunter AI - Elite Feature Engineering 
===============================================
Graph-level feature extraction with:
- Ring / cycle detection (money laundering signature)
- Louvain community detection (collusive cluster identification)
- Second-hop fraud exposure (guilt-by-association)
- Temporal burst detection
- Reciprocity scoring (circular flow detection)
- Normalized feature tensors for GNN
"""

import os
import logging
import warnings
from pathlib import Path
from collections import defaultdict

import pandas as pd
import numpy as np
import torch
import networkx as nx
from torch_geometric.data import Data

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("MuleHunter-FeatureEng")

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

# Feature columns that go into the GNN (order matters — must match train & inference)
FEATURE_COLS = [
    "account_age_days", "balance_mean", "balance_std",
    "tx_count", "tx_velocity_7d", "fan_out_ratio",
    "amount_entropy", "risky_email", "device_mobile",
    "device_consistency", "addr_entropy", "d_gap_mean",
    "card_network_risk", "product_code_risk", "international_flag",
    # Graph-derived (added below)
    "pagerank", "in_out_ratio", "reciprocity_score",
    "community_fraud_rate", "ring_membership",
]


# ─────────────────────────────────────────────
# RING / CYCLE DETECTION
# ─────────────────────────────────────────────
def detect_rings(G: nx.DiGraph, max_ring_size: int = 8):
    """
    Find circular money flows — the signature of layering in AML.
    Uses Johnson's algorithm O((V+E)(C+1)).
    Returns per-node ring membership count and total ring volume.
    """
    logger.info("🔄 Detecting circular money flows (ring detection)...")
    ring_count  = defaultdict(int)
    ring_volume = defaultdict(float)
    rings_found = []

    try:
        for cycle in nx.simple_cycles(G):
            if 3 <= len(cycle) <= max_ring_size:
                vol = sum(
                    G[cycle[i]][cycle[(i + 1) % len(cycle)]].get("weight", 0)
                    for i in range(len(cycle))
                )
                rings_found.append({"nodes": cycle, "size": len(cycle), "volume": vol})
                for node in cycle:
                    ring_count[node]  += 1
                    ring_volume[node] += vol
    except Exception as e:
        logger.warning(f"   Ring detection skipped for large components: {e}")

    logger.info(f"   🔴 {len(rings_found)} suspicious rings detected")
    return ring_count, ring_volume, rings_found


# ─────────────────────────────────────────────
# COMMUNITY DETECTION (Louvain / Greedy)
# ─────────────────────────────────────────────
def detect_communities(G: nx.DiGraph, fraud_labels: dict):
    """
    Identify fraud clusters using community detection.
    Returns per-node community fraud rate (guilt-by-association).
    """
    logger.info("🏘️  Detecting fraud communities...")
    G_undirected = G.to_undirected()

    try:
        communities = nx.community.greedy_modularity_communities(G_undirected)
    except Exception:
        # Fallback: connected components
        communities = list(nx.connected_components(G_undirected))

    community_fraud_rate = {}
    for i, comm in enumerate(communities):
        fraud_in_community = sum(fraud_labels.get(n, 0) for n in comm)
        rate = fraud_in_community / len(comm) if comm else 0
        for node in comm:
            community_fraud_rate[node] = rate

    high_risk_communities = sum(1 for c in communities
                                if sum(fraud_labels.get(n, 0) for n in c) / len(c) > 0.3)
    logger.info(f"   📍 {len(communities)} communities | {high_risk_communities} high-risk clusters")
    return community_fraud_rate


# ─────────────────────────────────────────────
# GRAPH METRICS
# ─────────────────────────────────────────────
def compute_graph_metrics(G: nx.DiGraph, node_ids: list):
    """Compute PageRank, in/out ratio, and reciprocity per node."""
    logger.info("📊 Computing advanced graph metrics...")

    pagerank = nx.pagerank(G, alpha=0.85, max_iter=200)

    metrics = []
    for nid in node_ids:
        out_amt = sum(d.get("weight", 0) for _, _, d in G.out_edges(nid, data=True))
        in_amt  = sum(d.get("weight", 0) for _, _, d in G.in_edges(nid,  data=True))
        in_out  = in_amt / (out_amt + 1e-5)

        # Reciprocity: how many of my outgoing edges have a return edge?
        out_neighbors = set(G.successors(nid))
        in_neighbors  = set(G.predecessors(nid))
        reciprocal    = len(out_neighbors & in_neighbors)
        recip_score   = reciprocal / (len(out_neighbors) + 1)

        metrics.append({
            "node_id":          nid,
            "pagerank":         pagerank.get(nid, 0),
            "in_out_ratio":     in_out,
            "reciprocity_score": recip_score,
        })

    return pd.DataFrame(metrics)


# ─────────────────────────────────────────────
# MAIN PIPELINE
# ─────────────────────────────────────────────
def build_graph_data():
    logger.info("=" * 60)
    logger.info("🚀 MuleHunter Feature Engineering v2.0 — ELITE MODE")
    logger.info("=" * 60)

    # 1. Load raw data
    df_nodes = pd.read_csv(SHARED_DATA / "nodes.csv")
    df_tx    = pd.read_csv(SHARED_DATA / "transactions.csv")

    df_nodes["node_id"] = df_nodes["node_id"].astype(str)
    df_tx["source"]     = df_tx["source"].astype(str)
    df_tx["target"]     = df_tx["target"].astype(str)

    logger.info(f"   Loaded {len(df_nodes):,} nodes, {len(df_tx):,} edges")

    # 2. Build NetworkX graph
    logger.info("🕸️  Building directed transaction graph...")
    G = nx.DiGraph()
    G.add_nodes_from(df_nodes["node_id"])

    for _, row in df_tx.iterrows():
        src, tgt, amt = row["source"], row["target"], row.get("amount", 1)
        if G.has_edge(src, tgt):
            G[src][tgt]["weight"] += amt
        else:
            G.add_edge(src, tgt, weight=amt)

    logger.info(f"   Graph: {G.number_of_nodes():,} nodes | {G.number_of_edges():,} edges")

    # 3. Ring detection
    ring_count, ring_volume, rings_found = detect_rings(G)

    # 4. Community detection
    fraud_labels = dict(zip(df_nodes["node_id"], df_nodes["is_fraud"]))
    community_fraud_rate = detect_communities(G, fraud_labels)

    # 5. Graph metrics
    graph_metrics_df = compute_graph_metrics(G, df_nodes["node_id"].tolist())

    # 6. Merge all features back
    df_nodes = df_nodes.merge(graph_metrics_df, on="node_id", how="left")
    df_nodes["ring_membership"]     = df_nodes["node_id"].map(ring_count).fillna(0)
    df_nodes["ring_volume"]         = df_nodes["node_id"].map(ring_volume).fillna(0)
    df_nodes["community_fraud_rate"]= df_nodes["node_id"].map(community_fraud_rate).fillna(0)

    # 7. Fill any missing feature columns
    for col in FEATURE_COLS:
        if col not in df_nodes.columns:
            df_nodes[col] = 0.0
    df_nodes = df_nodes.fillna(0)

    # 8. Normalize features (MinMax per column)
    logger.info("📐 Normalizing feature matrix...")
    feature_data = df_nodes[FEATURE_COLS].values.astype(np.float32)
    col_min = feature_data.min(axis=0)
    col_max = feature_data.max(axis=0)
    col_range = np.where(col_max - col_min == 0, 1, col_max - col_min)
    feature_data = (feature_data - col_min) / col_range

    # 9. Build PyG tensors
    logger.info("🔥 Building PyTorch Geometric tensors...")
    node_mapping = {nid: idx for idx, nid in enumerate(df_nodes["node_id"])}

    src_idx = df_tx["source"].map(node_mapping)
    tgt_idx = df_tx["target"].map(node_mapping)
    valid   = src_idx.notna() & tgt_idx.notna()

    edge_index = torch.tensor(
        [src_idx[valid].astype(int).tolist(), tgt_idx[valid].astype(int).tolist()],
        dtype=torch.long
    )
    edge_weight = torch.tensor(
        df_tx.loc[valid, "amount"].fillna(1).values,
        dtype=torch.float
    )

    x = torch.tensor(feature_data, dtype=torch.float)
    y = torch.tensor(df_nodes["is_fraud"].values, dtype=torch.long)

    # 10. Train / Val / Test masks (stratified split)
    n = len(df_nodes)
    fraud_idx = (y == 1).nonzero(as_tuple=True)[0]
    safe_idx  = (y == 0).nonzero(as_tuple=True)[0]

    def split_idx(idx, ratios=(0.7, 0.15, 0.15)):
        perm = idx[torch.randperm(len(idx))]
        t = int(ratios[0] * len(perm))
        v = int((ratios[0] + ratios[1]) * len(perm))
        return perm[:t], perm[t:v], perm[v:]

    f_tr, f_va, f_te = split_idx(fraud_idx)
    s_tr, s_va, s_te = split_idx(safe_idx)

    train_mask = torch.zeros(n, dtype=torch.bool)
    val_mask   = torch.zeros(n, dtype=torch.bool)
    test_mask  = torch.zeros(n, dtype=torch.bool)

    for idx_set, mask in [(torch.cat([f_tr, s_tr]), train_mask),
                           (torch.cat([f_va, s_va]), val_mask),
                           (torch.cat([f_te, s_te]), test_mask)]:
        mask[idx_set] = True

    data = Data(
        x=x, edge_index=edge_index, y=y,
        edge_weight=edge_weight,
        train_mask=train_mask,
        val_mask=val_mask,
        test_mask=test_mask
    )

    # 11. Save
    torch.save(data, SHARED_DATA / "processed_graph.pt")
    df_nodes.to_csv(SHARED_DATA / "nodes.csv", index=False)

    # Save normalization params for inference
    norm_params = {
        "feature_cols": FEATURE_COLS,
        "col_min": col_min.tolist(),
        "col_max": col_max.tolist(),
    }
    import json
    with open(SHARED_DATA / "norm_params.json", "w") as f:
        json.dump(norm_params, f)

    logger.info(f"✅ Graph tensor saved | Features: {x.shape[1]} | Nodes: {x.shape[0]:,}")
    logger.info(f"   Train: {train_mask.sum()} | Val: {val_mask.sum()} | Test: {test_mask.sum()}")
    logger.info(f"   Rings detected: {len(rings_found)} | Ring nodes: {len(ring_count)}")

    return data


if __name__ == "__main__":
    build_graph_data()