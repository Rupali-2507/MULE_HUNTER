import joblib
import json
import numpy as np

# Load once at startup
model = joblib.load("models/eif_model.pkl")
scaler = joblib.load("models/eif_scaler.pkl")

with open("models/model_metadata.json") as f:
    metadata = json.load(f)

MODEL_VERSION = metadata["version"]
FEATURE_COUNT = len(metadata["features"])

def score_features(features: list):

    if len(features) != FEATURE_COUNT:
        raise ValueError(f"Expected {FEATURE_COUNT} features")

    X = np.array(features).reshape(1, -1)

    # IMPORTANT: same transforms as training
    # Based on your train_eif.py:
    # balance_mean index = 1
    # balance_std index = 2
    # tx_count index = 3

    X[0][1] = np.log1p(X[0][1])
    X[0][2] = np.log1p(X[0][2])
    X[0][3] = np.log1p(X[0][3])

    X_scaled = scaler.transform(X)

    raw_score = model.decision_function(X_scaled)[0]
    anomaly_score = -raw_score

    pred = model.predict(X_scaled)[0]

    # Optional simple normalization clamp
    normalized_score = max(0.0, min(1.0, anomaly_score))

    return {
        "model": "EIF",
        "version": MODEL_VERSION,
        "score": round(float(normalized_score), 6),
        "isAnomalous": int(pred == -1),
        "confidence": 0.85
    }