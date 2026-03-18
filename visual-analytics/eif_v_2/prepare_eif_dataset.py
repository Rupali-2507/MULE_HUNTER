import pandas as pd
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "shared-data" / "nodes.csv"

df = pd.read_csv(DATA_PATH)



df["amount_entropy"] = df["amount_entropy"].clip(lower=0)
df["account_age_days"] = df["account_age_days"].clip(lower=1)

# ------------------------------------------------
# Behaviour Features
# ------------------------------------------------

df["velocity_score"] = df["tx_velocity_7d"] / (df["account_age_days"] + 1)

df["burst_score"] = df["balance_std"] / (df["balance_mean"] + 1)

# ------------------------------------------------
# 2️⃣ Transaction Spread Signals
# ------------------------------------------------

df["suspicious_neighbor_count"] = (
    df["fan_out_ratio"] * df["tx_count"]
).clip(0, 20)

df["fan_out_risk"] = df["fan_out_ratio"] * df["tx_velocity_7d"]

df["flow_risk_score"] = df["fan_out_ratio"] * df["in_out_ratio"]

# ------------------------------------------------
# 3️⃣ Infrastructure Risk (Proxy Signals)
# ------------------------------------------------

df["device_reuse_count"] = (
    (1 - df["device_consistency"]) * 10
).clip(0, 10)

df["ip_reuse_count"] = (
    df["addr_entropy"] * 3
).clip(0, 10)

df["ja3_reuse_count"] = (
    df["risky_email"] * 5 +
    (1 - df["device_consistency"]) * 3
).clip(0, 10)

# ------------------------------------------------
# 4️⃣ Network Risk
# ------------------------------------------------

df["network_risk_score"] = (
    df["pagerank"] * 10000 +
    df["community_fraud_rate"] * 5 +
    df["ring_membership"] * 3
)

# ------------------------------------------------
# 5️⃣ Behaviour Pattern Interaction
# ------------------------------------------------

df["entropy_velocity_ratio"] = (
    df["amount_entropy"] * df["velocity_score"]
)

# ------------------------------------------------
# Final Feature Set (10 features)
# ------------------------------------------------

FEATURE_NAMES = [
    "velocity_score",
    "burst_score",
    "suspicious_neighbor_count",
    "fan_out_risk",
    "device_reuse_count",
    "ip_reuse_count",
    "ja3_reuse_count",
    "network_risk_score",
    "flow_risk_score",
    "entropy_velocity_ratio"
]

eif_df = df[FEATURE_NAMES]

# ------------------------------------------------
# Remove Highly Correlated Features
# ------------------------------------------------

corr = eif_df.corr().abs()

upper = corr.where(
    np.triu(np.ones(corr.shape), k=1).astype(bool)
)

drop_cols = [
    column for column in upper.columns if any(upper[column] > 0.85)
]

eif_df = eif_df.drop(columns=drop_cols)

print("Removed correlated features:", drop_cols)

# ------------------------------------------------
# Save Dataset
# ------------------------------------------------

OUT_PATH = BASE_DIR / "shared-data" / "eif_features.csv"
eif_df.to_csv(OUT_PATH, index=False)

print("✅ EIF dataset created:", OUT_PATH)
print("Final feature count:", eif_df.shape[1])
print(eif_df.head())