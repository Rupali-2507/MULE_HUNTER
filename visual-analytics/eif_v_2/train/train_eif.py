import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import precision_score, recall_score, f1_score

# =============================
# CONFIG
# =============================

CSV_PATH = "../../shared-data/nodes.csv"   # adjust path if needed
MODEL_DIR = "../models"
MODEL_VERSION = "v1.0"

os.makedirs(MODEL_DIR, exist_ok=True)

# =============================
# LOAD DATA
# =============================

df = pd.read_csv(CSV_PATH)

# Keep label separately for evaluation
y_true = df["is_fraud"]

# Drop non-feature columns
df = df.drop(columns=["node_id", "is_fraud"])

# =============================
# SELECT EIF FEATURES
# (Behavioral + Identity only)
# =============================

EIF_FEATURES = [
    "account_age_days",
    "balance_mean",
    "balance_std",
    "tx_count",
    "tx_velocity_7d",
    "fan_out_ratio",
    "amount_entropy",
    "risky_email",
    "device_mobile",
    "device_consistency",
    "addr_entropy",
    "d_gap_mean",
    "card_network_risk",
    "product_code_risk",
    "international_flag",
    "in_out_ratio"
]

X = df[EIF_FEATURES].fillna(0)

# =============================
# PREPROCESSING
# =============================

# Log transform heavy-tailed columns
for col in ["balance_mean", "balance_std", "tx_count"]:
    X[col] = np.log1p(X[col])

# =============================
# SCALE FEATURES
# =============================

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# =============================
# TRAIN ISOLATION FOREST
# =============================

model = IsolationForest(
    n_estimators=300,
    contamination=0.05,  # adjust based on fraud ratio
    random_state=42,
    n_jobs=-1
)

model.fit(X_scaled)

# =============================
# OFFLINE EVALUATION
# =============================

preds = model.predict(X_scaled)
preds_binary = np.where(preds == -1, 1, 0)

precision = precision_score(y_true, preds_binary)
recall = recall_score(y_true, preds_binary)
f1 = f1_score(y_true, preds_binary)

print("========== OFFLINE METRICS ==========")
print("Precision:", round(precision, 4))
print("Recall:", round(recall, 4))
print("F1 Score:", round(f1, 4))

# =============================
# SAVE MODEL + SCALER
# =============================

joblib.dump(model, f"{MODEL_DIR}/eif_model.pkl")
joblib.dump(scaler, f"{MODEL_DIR}/eif_scaler.pkl")

metadata = {
    "model": "EIF",
    "version": MODEL_VERSION,
    "features": EIF_FEATURES,
    "metrics": {
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1)
    },
    "training_rows": int(len(df))
}

with open(f"{MODEL_DIR}/model_metadata.json", "w") as f:
    json.dump(metadata, f, indent=2)

print("✅ Model training complete and saved.")