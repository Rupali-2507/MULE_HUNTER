import joblib
import numpy as np
import json

from eif import iForest

from .config import (
    SCALER_PATH,
    METADATA_PATH,
    FEATURE_NAMES,
    FEATURE_EXPLANATIONS,
)

TRAIN_DATA_PATH = "models/eif_training_data.npy"


print("\n🚀 Loading EIF service...")

# ------------------------------------------------
# Load scaler
# ------------------------------------------------

scaler = joblib.load(SCALER_PATH)

# ------------------------------------------------
# Load metadata
# ------------------------------------------------

with open(METADATA_PATH) as f:
    metadata = json.load(f)

threshold = metadata.get("threshold", 0.5)

# ------------------------------------------------
# Load training data
# ------------------------------------------------

training_data = np.load(TRAIN_DATA_PATH)

# ------------------------------------------------
# Rebuild EIF model
# ------------------------------------------------

model = iForest(
    training_data,
    ntrees=500,
    sample_size=min(256, len(training_data)),
    ExtensionLevel=1
)

print("✅ EIF model rebuilt")
print("✅ Service ready\n")


# ------------------------------------------------
# Feature expansion
# ------------------------------------------------

def expand_features(features):

    velocity, burst, neighbors, ja3, device, ip = features

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


# ------------------------------------------------
# Fast feature importance
# ------------------------------------------------

def compute_feature_importance(model, X, base_score):

    impacts = {}

    for i, name in enumerate(FEATURE_NAMES):

        X_copy = X.copy()

        # remove feature influence
        X_copy[0, i] = 0

        new_score = model.compute_paths(X_copy)[0]

        impacts[name] = float(base_score - new_score)

    return impacts


# ------------------------------------------------
# Explanation builder
# ------------------------------------------------

def generate_explanation(top_features):

    reasons = []

    for feature in top_features.keys():
        if feature in FEATURE_EXPLANATIONS:
            reasons.append(FEATURE_EXPLANATIONS[feature])

    if not reasons:
        return "No strong anomaly signals detected."

    return ", ".join(reasons) + "."


# ------------------------------------------------
# EIF scoring
# ------------------------------------------------

def score_eif(features):

    print("\n------------------------------")
    print("🧪 EIF INFERENCE DEBUG")
    print("------------------------------")

    print("Incoming raw features:", features)

    if len(features) != 6:
        raise ValueError("Expected 6 backend features")

    # expand features
    expanded = expand_features(features)

    X = np.array(expanded).reshape(1, -1)

    # scale
    X_scaled = scaler.transform(X)

    # anomaly score
    raw = model.compute_paths(X_scaled)[0]

    print("Raw score:", raw)

    # smoother normalization
    k = 6   # controls steepness

    score = 1 / (1 + np.exp(-k * (raw - threshold)))
    score = float(score)

    print("Normalized score:", score)

    # fast feature importance
    impacts = compute_feature_importance(model, X_scaled, raw)

    top_features = sorted(
        impacts.items(),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:3]

    top_factors = dict(top_features)

    explanation = generate_explanation(top_factors)

    print("Top factors:", top_factors)
    print("------------------------------\n")

    return float(score), top_factors, explanation