import pandas as pd
import numpy as np
import joblib
import json
from pathlib import Path

from eif import iForest
from sklearn.preprocessing import RobustScaler
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score


# ---------------------------------------------------
# PATHS
# ---------------------------------------------------

BASE_DIR = Path(__file__).resolve().parents[3]

DATA_PATH = BASE_DIR / "shared-data" / "eif_features.csv"
MODEL_DIR = BASE_DIR / "visual-analytics" / "eif_v_2" / "models"

SCALER_PATH = MODEL_DIR / "eif_scaler.pkl"
TRAIN_DATA_PATH = MODEL_DIR / "eif_training_data.npy"
EVAL_PATH = MODEL_DIR / "eif_eval.json"
META_PATH = MODEL_DIR / "model_metadata.json"


# ---------------------------------------------------
# RAW FEATURES (FROM BACKEND)
# ---------------------------------------------------

RAW_FEATURES = [
    "velocity_score",
    "burst_score",
    "suspicious_neighbor_count",
    "ja3_reuse_count",
    "device_reuse_count",
    "ip_reuse_count"
]


# ---------------------------------------------------
# FEATURE EXPANSION
# (MUST MATCH INFERENCE)
# ---------------------------------------------------

def expand_features(row):

    velocity = row["velocity_score"]
    burst = row["burst_score"]
    neighbors = row["suspicious_neighbor_count"]
    ja3 = row["ja3_reuse_count"]
    device = row["device_reuse_count"]
    ip = row["ip_reuse_count"]

    infra_risk = ja3 + device + ip
    velocity_burst = velocity * burst
    neighbor_velocity = neighbors * velocity
    device_ip = device * ip
    ja3_weighted = 0.6 * ja3 + 0.25 * device + 0.15 * ip
    burst_neighbor = burst * neighbors

    return [
        velocity,
        burst,
        neighbors,
        ja3,
        device,
        ip,
        infra_risk,
        velocity_burst,
        neighbor_velocity,
        device_ip,
        ja3_weighted,
        burst_neighbor
    ]


FEATURE_NAMES = [
    "velocity",
    "burst",
    "neighbors",
    "ja3",
    "device",
    "ip",
    "infra_risk",
    "velocity_burst",
    "neighbor_velocity",
    "device_ip",
    "ja3_weighted",
    "burst_neighbor"
]


print("\n🚀 Starting EIF Training Pipeline\n")


# ---------------------------------------------------
# LOAD DATA
# ---------------------------------------------------

print("📂 Loading dataset:", DATA_PATH)

df = pd.read_csv(DATA_PATH)

print("Dataset shape:", df.shape)


# ---------------------------------------------------
# VALIDATE FEATURES
# ---------------------------------------------------

missing = [f for f in RAW_FEATURES if f not in df.columns]

if missing:
    raise ValueError(f"Missing features: {missing}")

print("✅ All required features present")


# ---------------------------------------------------
# CLEAN DATA
# ---------------------------------------------------

df = df.replace([np.inf, -np.inf], np.nan)
df = df.fillna(0)


# ---------------------------------------------------
# FEATURE EXPANSION
# ---------------------------------------------------

print("\n⚙️ Expanding features")

expanded = df.apply(expand_features, axis=1, result_type="expand")
expanded.columns = FEATURE_NAMES

X = expanded.values

y = df["is_fraud"].values if "is_fraud" in df.columns else None

print("Expanded feature dimension:", X.shape)


# ---------------------------------------------------
# SCALE FEATURES
# ---------------------------------------------------

print("\n⚙️ Applying RobustScaler")

scaler = RobustScaler()

X_scaled = scaler.fit_transform(X)


# ---------------------------------------------------
# TRAIN EIF
# ---------------------------------------------------

print("\n🧠 Training Extended Isolation Forest")

model = iForest(
    X_scaled,
    ntrees=500,
    sample_size=min(256, len(X_scaled)),
    ExtensionLevel=1
)


# ---------------------------------------------------
# COMPUTE ANOMALY SCORES
# ---------------------------------------------------

scores = np.array(model.compute_paths(X_scaled))

print("\n📊 Score statistics")

print("min:", scores.min())
print("max:", scores.max())
print("mean:", scores.mean())


# ---------------------------------------------------
# THRESHOLD
# ---------------------------------------------------

threshold = np.percentile(scores, 95)

print("\n🎯 Anomaly threshold:", threshold)


# ---------------------------------------------------
# SAVE ARTIFACTS
# ---------------------------------------------------

MODEL_DIR.mkdir(parents=True, exist_ok=True)

joblib.dump(scaler, SCALER_PATH)

np.save(TRAIN_DATA_PATH, X_scaled)

print("\n💾 Scaler saved:", SCALER_PATH)
print("💾 Training data saved:", TRAIN_DATA_PATH)


# ---------------------------------------------------
# EVALUATION
# ---------------------------------------------------

metrics = {}

if y is not None:

    print("\n📈 Running evaluation")

    preds = (scores >= threshold).astype(int)

    f1 = f1_score(y, preds)
    precision = precision_score(y, preds)
    recall = recall_score(y, preds)
    auc = roc_auc_score(y, scores)

    metrics = {
        "f1": float(f1),
        "precision": float(precision),
        "recall": float(recall),
        "auc": float(auc),
        "threshold": float(threshold)
    }

    with open(EVAL_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n📊 Evaluation Metrics")
    print("F1:", f1)
    print("Precision:", precision)
    print("Recall:", recall)
    print("AUC:", auc)

else:

    metrics = {"threshold": float(threshold)}

    print("\n⚠️ No labels found. Skipping evaluation.")


# ---------------------------------------------------
# METADATA
# ---------------------------------------------------

metadata = {
    "model": "EIF",
    "version": "v4",
    "raw_feature_dim": len(RAW_FEATURES),
    "expanded_feature_dim": len(FEATURE_NAMES),
    "threshold": float(threshold),
    "raw_features": RAW_FEATURES,
    "expanded_features": FEATURE_NAMES
}

with open(META_PATH, "w") as f:
    json.dump(metadata, f, indent=2)

print("\n📦 Metadata saved:", META_PATH)


# ---------------------------------------------------
# DEBUG SAMPLE
# ---------------------------------------------------

print("\n🔬 Sample anomaly scores")

for i in range(5):
    print(f"sample {i}: score={scores[i]:.4f}")

print("\n✅ EIF Training Complete\n")