"""
MuleHunter AI - Elite Data Generator 
==========================================
Transforms IEEE-CIS Kaggle dataset into a rich fraud graph with:
- 15 engineered node features 
- Device fingerprinting signals
- Temporal burst patterns
- Smurfing / layering / integration detection features
- Community-ready edge weights
"""

import os
import logging
import pandas as pd
import numpy as np
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger("MuleHunter-DataGen")

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────
if os.path.exists("/app/shared-data"):
    SHARED_DATA = Path("/app/shared-data")
else:
    BASE_DIR = Path(__file__).resolve().parent
    SHARED_DATA = BASE_DIR.parent / "shared-data"

SHARED_DATA.mkdir(parents=True, exist_ok=True)

# ─────────────────────────────────────────────
# HIGH-RISK EMAIL DOMAINS (Fraud signal)
# ─────────────────────────────────────────────
RISKY_DOMAINS = {
    "anonymous.com", "protonmail.com", "guerrillamail.com",
    "mailinator.com", "throwam.com", "yopmail.com",
    "sharklasers.com", "guerrillamailblock.com"
}

FREE_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com"}


def load_kaggle_data(nrows: int = 100_000) -> pd.DataFrame:
    """Load and merge IEEE-CIS transaction + identity files."""
    trans_path = SHARED_DATA / "train_transaction.csv"
    id_path    = SHARED_DATA / "train_identity.csv"

    if not trans_path.exists():
        raise FileNotFoundError(
            f"❌ train_transaction.csv not found at {SHARED_DATA}\n"
            "   Download from: https://www.kaggle.com/c/ieee-fraud-detection/data"
        )

    logger.info(f"📥 Loading {nrows:,} rows from IEEE-CIS dataset...")
    df_trans = pd.read_csv(trans_path, nrows=nrows)
    
    if id_path.exists():
        df_id = pd.read_csv(id_path)
        df = pd.merge(df_trans, df_id, on="TransactionID", how="left")
        logger.info(f"   Merged with identity file → {len(df):,} rows, {len(df.columns)} columns")
    else:
        df = df_trans
        logger.warning("   Identity file not found — device features will be zeroed")

    return df


def engineer_node_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Build per-card (node) feature table with 15 rich fraud signals.
    
    Feature Groups:
      [0] account_age_days        - D1 column: days since first transaction
      [1] balance_mean            - Mean transaction amount
      [2] balance_std             - Amount volatility (smurfing = low std)
      [3] tx_count                - Total transaction count (velocity)
      [4] tx_velocity_7d          - Transactions in simulated recent window
      [5] fan_out_ratio           - Unique recipients / unique senders
      [6] amount_entropy          - Shannon entropy of amounts (round amounts = laundering)
      [7] risky_email             - Email domain risk score
      [8] device_mobile           - Mobile transactions (higher fraud rate)
      [9] device_consistency      - Device type consistency (mules switch devices)
     [10] addr_entropy            - Address diversity (mules use many addresses)
     [11] d_gap_mean              - Mean of D-column gaps (behavioral timing)
     [12] card_network_risk       - Card type risk encoding
     [13] product_code_risk       - ProductCD risk encoding
     [14] international_flag      - Cross-border transaction ratio
    """
    logger.info("🔬 Engineering 15-dimensional node feature space...")

    # ── Card identity ──────────────────────────────────────────────────────────
    df["user_id"] = (
        df["card1"].astype(str) + "_" +
        df["card4"].fillna("X").astype(str) + "_" +
        df["card6"].fillna("X").astype(str)
    )

    # ── Per-user aggregations ──────────────────────────────────────────────────
    agg = df.groupby("user_id").agg(
        account_age_days   = ("D1",             lambda x: x.fillna(0).mean()),
        balance_mean       = ("TransactionAmt", "mean"),
        balance_std        = ("TransactionAmt", "std"),
        tx_count           = ("TransactionID",  "count"),
        is_fraud           = ("isFraud",        "max"),   # If ANY tx is fraud, node is fraud
    ).reset_index()

    agg["balance_std"] = agg["balance_std"].fillna(0)

    # ── Transaction velocity (simulated 7d window using TransactionDT) ─────────
    # TransactionDT is seconds offset; ~7 days = 604800 seconds
    df_sorted = df.sort_values("TransactionDT")
    tx_recent = df_sorted.groupby("user_id").apply(
        lambda g: (g["TransactionDT"] > g["TransactionDT"].max() - 604800).sum()
    ).reset_index(name="tx_velocity_7d")
    agg = agg.merge(tx_recent, on="user_id", how="left")

    # ── Fan-out ratio ──────────────────────────────────────────────────────────
    unique_targets = df.groupby("user_id")["addr1"].nunique().reset_index(name="unique_targets")
    agg = agg.merge(unique_targets, on="user_id", how="left")
    agg["fan_out_ratio"] = (agg["unique_targets"] / (agg["tx_count"] + 1)).clip(0, 1)

    # ── Amount entropy (smurfing detection) ───────────────────────────────────
    def amount_entropy(amounts):
        counts = pd.Series(amounts).round(-1).value_counts(normalize=True)  # Round to nearest 10
        return float(-np.sum(counts * np.log2(counts + 1e-9)))

    entropy_map = df.groupby("user_id")["TransactionAmt"].apply(amount_entropy).reset_index(name="amount_entropy")
    agg = agg.merge(entropy_map, on="user_id", how="left")

    # ── Email domain risk ──────────────────────────────────────────────────────
    def email_risk(domains):
        domains = domains.fillna("unknown")
        risky = domains.isin(RISKY_DOMAINS).mean()
        free  = domains.isin(FREE_DOMAINS).mean()
        return risky * 2.0 + free * 0.5  # Weighted risk score

    if "P_emaildomain" in df.columns:
        email_map = df.groupby("user_id")["P_emaildomain"].apply(email_risk).reset_index(name="risky_email")
        agg = agg.merge(email_map, on="user_id", how="left")
    else:
        agg["risky_email"] = 0.0

    # ── Device features ────────────────────────────────────────────────────────
    if "DeviceType" in df.columns:
        mobile_map = df.groupby("user_id")["DeviceType"].apply(
            lambda x: (x == "mobile").mean()
        ).reset_index(name="device_mobile")
        
        # Consistency: 1 device type = consistent (legit), many = suspicious
        consistency_map = df.groupby("user_id")["DeviceType"].apply(
            lambda x: 1.0 - x.nunique() / (len(x) + 1)
        ).reset_index(name="device_consistency")
        
        agg = agg.merge(mobile_map, on="user_id", how="left")
        agg = agg.merge(consistency_map, on="user_id", how="left")
    else:
        agg["device_mobile"] = 0.5
        agg["device_consistency"] = 1.0

    # ── Address entropy ────────────────────────────────────────────────────────
    addr_ent = df.groupby("user_id")["addr1"].apply(
        lambda x: float(-np.sum(x.fillna(-1).value_counts(normalize=True) *
                                np.log2(x.fillna(-1).value_counts(normalize=True) + 1e-9)))
    ).reset_index(name="addr_entropy")
    agg = agg.merge(addr_ent, on="user_id", how="left")

    # ── D-column behavioral timing gaps ───────────────────────────────────────
    d_cols = [c for c in df.columns if c.startswith("D") and c[1:].isdigit()][:5]
    if d_cols:
        df["d_gap_mean"] = df[d_cols].fillna(0).mean(axis=1)
        d_gap_map = df.groupby("user_id")["d_gap_mean"].mean().reset_index(name="d_gap_mean")
        agg = agg.merge(d_gap_map, on="user_id", how="left")
    else:
        agg["d_gap_mean"] = 0.0

    # ── Card network risk encoding ─────────────────────────────────────────────
    card_risk_map = {"visa": 0.3, "mastercard": 0.3, "american express": 0.2,
                     "discover": 0.4, "X": 0.5}
    if "card4" in df.columns:
        card_enc = df.groupby("user_id")["card4"].apply(
            lambda x: np.mean([card_risk_map.get(str(v).lower(), 0.5) for v in x])
        ).reset_index(name="card_network_risk")
        agg = agg.merge(card_enc, on="user_id", how="left")
    else:
        agg["card_network_risk"] = 0.3

    # ── ProductCD risk ─────────────────────────────────────────────────────────
    prod_risk = {"W": 0.1, "H": 0.3, "C": 0.5, "S": 0.6, "R": 0.7}
    if "ProductCD" in df.columns:
        prod_enc = df.groupby("user_id")["ProductCD"].apply(
            lambda x: np.mean([prod_risk.get(str(v), 0.4) for v in x])
        ).reset_index(name="product_code_risk")
        agg = agg.merge(prod_enc, on="user_id", how="left")
    else:
        agg["product_code_risk"] = 0.3

    # ── International transactions ─────────────────────────────────────────────
    if "card3" in df.columns:  # card3 encodes geography
        intl_map = df.groupby("user_id")["card3"].apply(
            lambda x: (x.fillna(0) > 200).mean()  # High values = international
        ).reset_index(name="international_flag")
        agg = agg.merge(intl_map, on="user_id", how="left")
    else:
        agg["international_flag"] = 0.0

    # ── Final cleanup ──────────────────────────────────────────────────────────
    agg = agg.rename(columns={"user_id": "node_id"})
    agg = agg.fillna(0)
    agg = agg.drop(columns=["unique_targets"], errors="ignore")

    logger.info(f"   ✅ Node features engineered: {len(agg):,} unique accounts")
    logger.info(f"   📊 Fraud prevalence: {agg['is_fraud'].mean():.2%}")
    return agg


def build_edges(df: pd.DataFrame) -> pd.DataFrame:
    """Build transaction edges with rich metadata."""
    logger.info("🕸️  Building transaction graph edges...")

    df["user_id"] = (
        df["card1"].astype(str) + "_" +
        df["card4"].fillna("X").astype(str) + "_" +
        df["card6"].fillna("X").astype(str)
    )

    # Target: addr1 as merchant/location node
    df["target_id"] = "loc_" + df["addr1"].fillna(0).astype(int).astype(str)

    edges = df[["user_id", "target_id", "TransactionAmt", "TransactionDT", "isFraud"]].copy()
    edges.columns = ["source", "target", "amount", "timestamp", "is_fraud_edge"]

    logger.info(f"   ✅ {len(edges):,} edges built")
    return edges


def generate_dataset(nrows: int = 100_000):
    """Full pipeline: Load → Engineer → Save."""
    logger.info("=" * 60)
    logger.info("🚀 MuleHunter Data Generator v2.0 — ELITE MODE")
    logger.info("=" * 60)

    df = load_kaggle_data(nrows)
    nodes = engineer_node_features(df)
    edges = build_edges(df)

    nodes_path = SHARED_DATA / "nodes.csv"
    edges_path = SHARED_DATA / "transactions.csv"

    nodes.to_csv(nodes_path, index=False)
    edges.to_csv(edges_path, index=False)

    logger.info(f"💾 Saved nodes.csv   → {nodes_path}")
    logger.info(f"💾 Saved transactions.csv → {edges_path}")
    logger.info("✅ DATA GENERATION COMPLETE")

    return nodes, edges


if __name__ == "__main__":
    generate_dataset()