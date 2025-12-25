import asyncio

from app.clients.backend_client import (
    get_nodes_enriched,
    post_anomaly_scores,
    post_shap_explanations,
    post_fraud_explanations,
)

from app.services.anomaly_detection.eif_detector import run_isolation_forest
from app.services.explainability.shap_runner import run_shap
from app.services.explainability.shap_to_text import generate_human_explanations


def _extract_node_id(node: dict):
    """
    Extract node ID from backend-enriched node schema.
    """
    return node.get("nodeId")

def _normalize_features(node: dict) -> dict:
    """
    Convert backend camelCase features to snake_case
    expected by SHAP pipeline.
    """
    return {
        **node,
        "in_degree": node.get("inDegree"),
        "out_degree": node.get("outDegree"),
        "total_incoming": node.get("totalIncoming"),
        "total_outgoing": node.get("totalOutgoing"),
        "risk_ratio": node.get("riskRatio"),
        "tx_velocity": node.get("txVelocity"),
        "account_age_days": node.get("accountAgeDays"),
    }


async def run_full_pipeline() -> None:
    """
    Runs full visual analytics pipeline aligned with backend schema.
    Backend writes are fire-and-forget.
    """

    print("[Visual-Analytics] Pipeline started")

    # 1️⃣ Fetch ML input (ASYNC READ)
    nodes = await get_nodes_enriched()

    if not nodes:
        print("[Visual-Analytics] No nodes to analyze")
        return

    # 2️⃣ Anomaly detection (CPU-bound, sync is OK)
    anomaly_scores = run_isolation_forest(nodes)

    # 🔥 Fire-and-forget backend write
    await post_anomaly_scores(anomaly_scores)

    # 3️⃣ Merge anomaly scores ONLY for SHAP computation
    score_map = {s["node_id"]: s for s in anomaly_scores}

    scored_nodes = []

    for node in nodes:
            node_id = _extract_node_id(node)

            if node_id is None:
                continue  # safety

            score = score_map.get(node_id, {})

            scored_nodes.append({
                **node,
                "node_id": node_id,  # normalize for ML + SHAP
                "anomaly_score": score.get("anomaly_score"),
                "is_anomalous": score.get("is_anomalous", 0),
            })


    # 4️⃣ SHAP explainability
    normalized_nodes = [
        _normalize_features(node) for node in scored_nodes
    ]

    shap_data = run_shap(normalized_nodes)


    if shap_data:
        # 🔥 Fire-and-forget backend writes
        await post_shap_explanations(shap_data)

        fraud_explanations = generate_human_explanations(shap_data)
        await post_fraud_explanations(fraud_explanations)

    print("[Visual-Analytics] Pipeline completed successfully")
