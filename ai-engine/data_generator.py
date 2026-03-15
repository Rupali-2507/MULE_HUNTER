"""
MuleHunter AI  ·  Data Generator  ·  v3.0
==========================================
Transforms the IEEE-CIS Kaggle dataset into a rich fraud graph with:

  · 15 engineered per-account node features
  · Device fingerprinting signals
  · Temporal burst / velocity patterns
  · Smurfing / layering / integration detection features
  · Community-ready edge weights
  · Second-hop fraud exposure (guilt-by-association seed)

"""

from __future__ import annotations

import logging
import os
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("MuleHunter-DataGen")

# ──────────────────────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

SHARED_DATA.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────────
# DOMAIN RISK LISTS
# ──────────────────────────────────────────────────────────────────────────────
RISKY_DOMAINS: frozenset[str] = frozenset({
    "anonymous.com", "protonmail.com", "guerrillamail.com",
    "mailinator.com", "throwam.com", "yopmail.com",
    "sharklasers.com", "guerrillamailblock.com", "trashmail.com",
    "dispostable.com", "tempmail.com", "10minutemail.com",
})

FREE_DOMAINS: frozenset[str] = frozenset({
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
    "icloud.com", "aol.com", "live.com",
})

# card3 geographic encoding: values consistently above this threshold
# in the IEEE-CIS dataset correspond to non-US geographies.
_INTL_CARD3_THRESHOLD = 150


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _safe_entropy(series: pd.Series, n_buckets: int = 20) -> float:
    """
    Shannon entropy (bits) of a numeric series with adaptive bucketing.

    Uses pd.cut with *n_buckets* equal-width bins rather than a fixed
    rounding constant so the signal is meaningful for any value range.
    Returns 0.0 for constant series (smurfing signal = low entropy).
    """
    if len(series) < 2:
        return 0.0
    lo, hi = series.min(), series.max()
    if hi == lo:
        return 0.0  # all identical amounts → perfect smurfing signal
    # Use at most n_buckets but never more than unique values
    bins = min(n_buckets, series.nunique())
    counts = pd.cut(series, bins=bins, include_lowest=True).value_counts(normalize=True)
    probs = counts.values
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs)))


def _safe_addr_entropy(series: pd.Series) -> float:
    """Shannon entropy of categorical address values."""
    filled = series.fillna(-1)
    probs = filled.value_counts(normalize=True).values
    probs = probs[probs > 0]
    return float(-np.sum(probs * np.log2(probs)))


def _email_risk_score(domains: pd.Series) -> float:
    """
    Weighted risk score in [0, 1]:
      · Each risky domain contributes 0.6 to a running average.
      · Each free / anonymous domain contributes 0.3.
      · Corporate / unknown domains contribute 0.1.
    Clipped to [0, 1] to keep the MinMax normaliser stable.
    """
    domains = domains.fillna("unknown")
    # Isolate domain part (handles "user@domain.com" format in IEEE-CIS)
    domains = domains.str.split("@").str[-1].str.lower().str.strip()
    risky_rate = domains.isin(RISKY_DOMAINS).mean()
    free_rate  = domains.isin(FREE_DOMAINS).mean()
    score = risky_rate * 0.6 + free_rate * 0.3 + (1 - risky_rate - free_rate) * 0.1
    return float(np.clip(score, 0.0, 1.0))


# ──────────────────────────────────────────────────────────────────────────────
# DATA LOADING
# ──────────────────────────────────────────────────────────────────────────────

def load_kaggle_data(nrows: int = 100_000) -> pd.DataFrame:
    """Load and merge IEEE-CIS transaction + identity files."""
    trans_path = SHARED_DATA / "train_transaction.csv"
    id_path    = SHARED_DATA / "train_identity.csv"

    if not trans_path.exists():
        raise FileNotFoundError(
            f"train_transaction.csv not found at {SHARED_DATA}\n"
            "  Download from: https://www.kaggle.com/c/ieee-fraud-detection/data"
        )

    logger.info("Loading %s rows from IEEE-CIS dataset...", f"{nrows:,}")
    df_trans = pd.read_csv(trans_path, nrows=nrows)

    if id_path.exists():
        df_id = pd.read_csv(id_path)
        df = pd.merge(df_trans, df_id, on="TransactionID", how="left")
        logger.info(
            "  Merged with identity file → %s rows, %s columns",
            f"{len(df):,}", len(df.columns),
        )
    else:
        df = df_trans
        logger.warning("  Identity file not found — device features will be neutral")

    return df


# ──────────────────────────────────────────────────────────────────────────────
# NODE FEATURE ENGINEERING
# ──────────────────────────────────────────────────────────────────────────────

def engineer_node_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build per-card (node) feature table with 15 rich fraud signals.

    Feature index  Name                Description
    ─────────────  ──────────────────  ──────────────────────────────────────
      [0]  account_age_days      D1 column mean — days since first transaction
      [1]  balance_mean          Mean transaction amount
      [2]  balance_std           Amount volatility (smurfing → low std)
      [3]  tx_count              Total transaction count (velocity proxy)
      [4]  tx_velocity_7d        Transactions in the trailing 7-day window
      [5]  fan_out_ratio         Unique address targets / tx_count (dispersion)
      [6]  amount_entropy        Shannon entropy of amounts (round = laundering)
      [7]  risky_email           Email domain risk score [0, 1]
      [8]  device_mobile         Fraction of mobile transactions
      [9]  device_consistency    Device type consistency (mules switch devices)
     [10]  addr_entropy          Address diversity entropy
     [11]  d_gap_mean            Mean of D-column behavioral timing gaps
     [12]  card_network_risk     Card type risk encoding
     [13]  product_code_risk     ProductCD risk encoding
     [14]  international_flag    Continuous cross-border transaction ratio
    """
    logger.info("Engineering 15-dimensional node feature space...")

    # ── Card identity composite key ───────────────────────────────────────────
    df = df.copy()
    df["user_id"] = (
        df["card1"].astype(str) + "_" +
        df["card4"].fillna("X").astype(str) + "_" +
        df["card6"].fillna("X").astype(str)
    )

    # ── Core aggregations ─────────────────────────────────────────────────────
    agg = df.groupby("user_id").agg(
        account_age_days=("D1",             lambda x: x.fillna(0).mean()),
        balance_mean    =("TransactionAmt", "mean"),
        balance_std     =("TransactionAmt", "std"),
        tx_count        =("TransactionID",  "count"),
        is_fraud        =("isFraud",        "max"),   # any fraud tx → node is fraud
    ).reset_index()
    agg["balance_std"] = agg["balance_std"].fillna(0)

    # ── [FIX 1] tx_velocity_7d: vectorised window via max_dt merge ─────────────
    # Compute per-user max TransactionDT, merge back, flag recent rows,
    # then group-count — no slow apply() needed.
    max_dt = (
        df.groupby("user_id")["TransactionDT"]
        .max()
        .reset_index(name="max_dt")
    )
    df_dt = df[["user_id", "TransactionDT"]].merge(max_dt, on="user_id")
    df_dt["is_recent"] = df_dt["TransactionDT"] > df_dt["max_dt"] - 604_800  # 7d
    velocity = (
        df_dt.groupby("user_id")["is_recent"]
        .sum()
        .reset_index(name="tx_velocity_7d")
    )
    agg = agg.merge(velocity, on="user_id", how="left")

    # ── [FIX 3] fan_out_ratio ─────────────────────────────────────────────────
    unique_targets = (
        df.groupby("user_id")["addr1"]
        .nunique()
        .reset_index(name="unique_targets")
    )
    agg = agg.merge(unique_targets, on="user_id", how="left")
    agg["fan_out_ratio"] = (
        agg["unique_targets"] / (agg["tx_count"] + 1)
    ).clip(0, 1)

    # ── [FIX 3] amount_entropy with adaptive bucketing ─────────────────────────
    entropy_map = (
        df.groupby("user_id")["TransactionAmt"]
        .apply(_safe_entropy)
        .reset_index(name="amount_entropy")
    )
    agg = agg.merge(entropy_map, on="user_id", how="left")

    # ── [FIX 7/2] Email domain risk — extract domain first ────────────────────
    if "P_emaildomain" in df.columns:
        email_map = (
            df.groupby("user_id")["P_emaildomain"]
            .apply(_email_risk_score)
            .reset_index(name="risky_email")
        )
        agg = agg.merge(email_map, on="user_id", how="left")
    else:
        agg["risky_email"] = 0.1  # neutral, not zero

    # ── Device features ───────────────────────────────────────────────────────
    if "DeviceType" in df.columns:
        mobile_map = (
            df.groupby("user_id")["DeviceType"]
            .apply(lambda x: (x.str.lower() == "mobile").mean())
            .reset_index(name="device_mobile")
        )
        # [FIX 4] device_consistency: clip to [0,1] to handle edge cases
        consistency_map = (
            df.groupby("user_id")["DeviceType"]
            .apply(lambda x: float(np.clip(1.0 - x.nunique() / max(len(x), 1), 0.0, 1.0)))
            .reset_index(name="device_consistency")
        )
        agg = agg.merge(mobile_map,       on="user_id", how="left")
        agg = agg.merge(consistency_map,  on="user_id", how="left")
    else:
        agg["device_mobile"]      = 0.5
        agg["device_consistency"] = 1.0

    # ── [FIX 5] Address entropy ───────────────────────────────────────────────
    addr_ent = (
        df.groupby("user_id")["addr1"]
        .apply(_safe_addr_entropy)
        .reset_index(name="addr_entropy")
    )
    agg = agg.merge(addr_ent, on="user_id", how="left")

    # ── D-column behavioral timing gaps ───────────────────────────────────────
    d_cols = [c for c in df.columns if c.startswith("D") and c[1:].isdigit()][:5]
    if d_cols:
        df["d_gap_mean"] = df[d_cols].fillna(0).mean(axis=1)
        d_gap_map = (
            df.groupby("user_id")["d_gap_mean"]
            .mean()
            .reset_index(name="d_gap_mean")
        )
        agg = agg.merge(d_gap_map, on="user_id", how="left")
    else:
        agg["d_gap_mean"] = 0.0

    # ── Card network risk encoding ─────────────────────────────────────────────
    _CARD_RISK = {
        "visa": 0.3, "mastercard": 0.3,
        "american express": 0.2, "discover": 0.4,
    }
    if "card4" in df.columns:
        card_enc = (
            df.groupby("user_id")["card4"]
            .apply(
                lambda x: float(np.mean([
                    _CARD_RISK.get(str(v).lower().strip(), 0.5) for v in x
                ]))
            )
            .reset_index(name="card_network_risk")
        )
        agg = agg.merge(card_enc, on="user_id", how="left")
    else:
        agg["card_network_risk"] = 0.3

    # ── ProductCD risk encoding ────────────────────────────────────────────────
    _PROD_RISK = {"W": 0.1, "H": 0.3, "C": 0.5, "S": 0.6, "R": 0.7}
    if "ProductCD" in df.columns:
        prod_enc = (
            df.groupby("user_id")["ProductCD"]
            .apply(
                lambda x: float(np.mean([_PROD_RISK.get(str(v), 0.4) for v in x]))
            )
            .reset_index(name="product_code_risk")
        )
        agg = agg.merge(prod_enc, on="user_id", how="left")
    else:
        agg["product_code_risk"] = 0.3

    # ── [FIX 6] International transactions — continuous ratio ─────────────────
    # card3 encodes geographic bin in IEEE-CIS; values > 150 → non-US geography.
    # We express this as a ratio [0,1] rather than a boolean.
    if "card3" in df.columns:
        intl_map = (
            df.groupby("user_id")["card3"]
            .apply(lambda x: float((x.fillna(0) > _INTL_CARD3_THRESHOLD).mean()))
            .reset_index(name="international_flag")
        )
        agg = agg.merge(intl_map, on="user_id", how="left")
    else:
        agg["international_flag"] = 0.0

    # ── [NEW] second_hop_fraud_rate seed (graph-level feature, pre-computed) ──
    # For each account, what fraction of its direct neighbours (via addr1)
    # are fraudulent?  This is a cheap proxy for graph-propagated risk and
    # lets feature_engineering.py skip one expensive full-graph pass.
    fraud_by_addr = (
        df.groupby("addr1")["isFraud"]
        .max()
        .reset_index(name="addr_fraud")
    )
    df_addr = df[["user_id", "addr1"]].merge(fraud_by_addr, on="addr1", how="left")
    second_hop = (
        df_addr.groupby("user_id")["addr_fraud"]
        .mean()
        .fillna(0)
        .reset_index(name="second_hop_fraud_rate")
    )
    agg = agg.merge(second_hop, on="user_id", how="left")

    # ── Cleanup ───────────────────────────────────────────────────────────────
    agg = agg.rename(columns={"user_id": "node_id"})
    agg = agg.fillna(0)
    agg = agg.drop(columns=["unique_targets"], errors="ignore")

    logger.info("  Node features engineered: %s unique accounts", f"{len(agg):,}")
    logger.info(
        "  Fraud prevalence: %.2f%%", agg["is_fraud"].mean() * 100
    )
    return agg


# ──────────────────────────────────────────────────────────────────────────────
# EDGE BUILDING  —  account-to-account co-occurrence edges
# ──────────────────────────────────────────────────────────────────────────────

def build_edges(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build ACCOUNT-TO-ACCOUNT edges so the GNN has a real graph to learn from.

    The previous version wrote account → loc_<addr1> edges.  Because location
    nodes never appear in nodes.csv, every target mapped to NaN inside
    feature_engineering.py's node_mapping, so valid was all-False and
    edge_index ended up with 0 edges.  The GNN therefore ran as a pure MLP
    with no message-passing whatsoever.

    Strategy — co-occurrence edges:
      Two accounts share an edge when they have a common attribute that fraud
      rings exploit:
        • shared_addr   : same billing address (addr1) — geographic co-location
        • shared_card   : same card BIN prefix (card1) — issuer batch cluster
        • shared_device : same DeviceInfo string — same physical device used for
                          multiple accounts (strongest mule signal)

    Edge weight: sum of transaction amounts across the shared group (flow proxy).

    MAX_GROUP_SIZE caps how many accounts can link via one shared value to
    prevent mega-cliques (e.g. NaN address, popular BIN) from producing O(N²)
    edges and blowing up memory.
    """
    logger.info("Building account-to-account co-occurrence edges...")

    df = df.copy()
    df["user_id"] = (
        df["card1"].astype(str) + "_" +
        df["card4"].fillna("X").astype(str) + "_" +
        df["card6"].fillna("X").astype(str)
    )

    MAX_GROUP_SIZE = 20
    all_edges: list[dict] = []

    def _cooccurrence(group_col: str, edge_type: str, source_df=None) -> None:
        """Emit bidirectional edges between accounts sharing group_col value."""
        target = source_df if source_df is not None else df
        col_series = target[group_col]
        # Drop nulls and empty strings
        valid_mask = col_series.notna() & (col_series.astype(str).str.strip() != "")
        sub = target[valid_mask][["user_id", group_col, "TransactionAmt"]].copy()
        sub[group_col] = sub[group_col].astype(str)

        # Per-group, per-account total flow
        flow = (
            sub.groupby([group_col, "user_id"])["TransactionAmt"]
            .sum()
            .reset_index()
        )

        for gval, grp in flow.groupby(group_col):
            members = grp["user_id"].values
            if len(members) < 2:
                continue
            # Cap large groups: keep top-flow accounts
            if len(members) > MAX_GROUP_SIZE:
                top_idx = grp["TransactionAmt"].nlargest(MAX_GROUP_SIZE).index
                members = grp.loc[top_idx, "user_id"].values
            avg_w = float(grp.loc[grp["user_id"].isin(members), "TransactionAmt"].mean())
            # Bidirectional edges for every pair in this group
            for i in range(len(members)):
                for j in range(i + 1, len(members)):
                    src, tgt = str(members[i]), str(members[j])
                    all_edges.append({"source": src, "target": tgt,
                                      "amount": avg_w, "is_fraud_edge": 0})
                    all_edges.append({"source": tgt, "target": src,
                                      "amount": avg_w, "is_fraud_edge": 0})

    if "addr1" in df.columns:
        _cooccurrence("addr1", "shared_addr")

    if "card1" in df.columns:
        _cooccurrence("card1", "shared_card")

    if "DeviceInfo" in df.columns:
        # Strip out generic device values that would create spurious mass-cliques
        df_dev = df.copy()
        df_dev["DeviceInfo"] = df_dev["DeviceInfo"].astype(str).str.strip()
        generic = {"nan", "unknown", "", "windows", "ios", "android",
                   "macintel", "linux", "other"}
        df_dev = df_dev[~df_dev["DeviceInfo"].str.lower().isin(generic)]
        if len(df_dev) > 0:
            # Pass df_dev explicitly — no closure df-swap needed
            _cooccurrence("DeviceInfo", "shared_device", source_df=df_dev)

    if not all_edges:
        logger.warning(
            "  No account-to-account edges produced — "
            "check that addr1/card1 columns exist in your dataset"
        )
        return pd.DataFrame(columns=["source", "target", "amount", "is_fraud_edge"])

    edges = pd.DataFrame(all_edges)

    # Deduplicate same-pair edges (can appear from multiple shared attributes)
    # Keep the maximum weight across all edge types for the same (src, tgt) pair
    edges = (
        edges.groupby(["source", "target"], as_index=False)
        .agg(amount=("amount", "max"), is_fraud_edge=("is_fraud_edge", "max"))
    )

    logger.info(
        "  %s account-to-account edges built (%s unique pairs)",
        f"{len(edges):,}",
        f"{len(edges):,}",
    )
    return edges


# ──────────────────────────────────────────────────────────────────────────────
# MAIN PIPELINE
# ──────────────────────────────────────────────────────────────────────────────

def generate_dataset(nrows: int = 590_540):
    """Full pipeline: Load → Feature-engineer → Save."""
    logger.info("=" * 60)
    logger.info("MuleHunter Data Generator v3.0")
    logger.info("=" * 60)

    df    = load_kaggle_data(nrows)
    nodes = engineer_node_features(df)
    edges = build_edges(df)

    nodes_path = SHARED_DATA / "nodes.csv"
    edges_path = SHARED_DATA / "transactions.csv"

    nodes.to_csv(nodes_path, index=False)
    edges.to_csv(edges_path, index=False)

    logger.info("Saved nodes.csv        → %s", nodes_path)
    logger.info("Saved transactions.csv → %s", edges_path)
    logger.info(
        "Feature columns: %s",
        [c for c in nodes.columns if c not in ("node_id", "is_fraud")],
    )
    logger.info("DATA GENERATION COMPLETE")
    return nodes, edges


if __name__ == "__main__":
    generate_dataset()