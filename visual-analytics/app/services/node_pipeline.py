import asyncio
from typing import Any, Dict, List

from app.services.anomaly_detection.score_nodes import score_single_node
from app.services.explainability.explanation_mapper import build_fraud_explanation
from app.services.explainability.shap_runner import run_shap
from app.clients.backend_client import (
    fetch_all_enriched_nodes,
    post_anomaly_score,
    post_fraud_explanation,
    post_shap_explanation,
)


# =========================
# SSE EVENT EMITTER
# =========================
async def emit_event(queue, stage: str, data: Dict[str, Any]):
    if queue is not None:
        await queue.put({
            "stage": stage,
            "data": data
        })


# =========================
# NORMALIZATION
# =========================
def normalize_enriched_node(enriched: dict) -> dict:
    """
    Converts backend NodeEnriched payload into ML-safe schema.
    """
    return {
        "node_id": enriched.get("nodeId"),
        "in_degree": enriched.get("inDegree", 0),
        "out_degree": enriched.get("outDegree", 0),
        "total_incoming": enriched.get("totalIncoming", 0),
        "total_outgoing": enriched.get("totalOutgoing", 0),
        "risk_ratio": enriched.get("riskRatio", 0),
        "tx_velocity": enriched.get("txVelocity", 0),
        "account_age_days": enriched.get("accountAgeDays", 0),
        "balance": enriched.get("balance", 0),
    }


# =========================
# FALLBACK SHAP
# =========================
def build_non_anomalous_shap(node_id: int, score: float) -> dict:
    """
    Placeholder explanation for non-anomalous nodes.
    """
    return {
        "node_id": node_id,
        "anomaly_score": round(float(score), 6),
        "top_factors": [
            {
                "feature": "overall",
                "impact": 0.0,
                "description": "No anomalous behavior detected"
            }
        ],
        "model": "baseline",
        "source": "shap"
    }


# =========================
# MAIN PIPELINE
# =========================
async def run_node_pipeline(nodes: List, event_queue: asyncio.Queue = None):
    """
    Runs Visual Analytics ML pipeline with real-time SSE updates.
    Emits exactly ONE terminal event.
    """

    try:

        # -------------------------
        # STREAM START
        # -------------------------
        await emit_event(event_queue, "stream_started", {
            "nodes": [n.nodeId for n in nodes],
            "message": "Visual investigation started"
        })


        # -------------------------
        # FETCH POPULATION
        # -------------------------
        all_nodes = await fetch_all_enriched_nodes()

        population_size = len(all_nodes)

        await emit_event(event_queue, "population_loaded", {
            "population_size": population_size,
            "message": f"Loaded {population_size} reference accounts"
        })

        if not all_nodes or population_size < 10:
            await emit_event(event_queue, "unsupervised_completed", {
                "final_status": "SKIPPED",
                "reason": "Insufficient reference population"
            })
            return


        normalized_population = [
            normalize_enriched_node(n)
            for n in all_nodes
            if n.get("nodeId") is not None
        ]


        # -------------------------
        # PROCESS EACH NODE
        # -------------------------
        for node in nodes:

            node_id = node.nodeId
            if node_id is None:
                continue

            raw_node = next(
                (n for n in all_nodes if n.get("nodeId") == node_id),
                None
            )

            if not raw_node:
                continue

            target_node = normalize_enriched_node(raw_node)

            await emit_event(event_queue, "scoring_started", {
                "node_id": node_id,
                "message": "Isolation Forest anomaly scoring started"
            })


            reference_nodes = [
                n for n in normalized_population
                if n["node_id"] != node_id
            ]

            if len(reference_nodes) < 10:
                continue


            # -------------------------
            # ML SCORE
            # -------------------------
            score, is_anomalous = score_single_node(
                enriched_node=target_node,
                reference_nodes=reference_nodes
            )

            await emit_event(event_queue, "eif_result", {
                "node_id": node_id,
                "score": round(float(score), 6),
                "is_anomalous": is_anomalous,
                "message": f"Anomaly score = {round(float(score),4)}"
            })


            reasons = build_fraud_explanation(target_node, score)


            # -------------------------
            # SHAP EXPLAINABILITY
            # -------------------------
            if is_anomalous:

                await emit_event(event_queue, "shap_started", {
                    "node_id": node_id,
                    "message": "Generating SHAP explanation"
                })

                shap_input = []

                for n in reference_nodes[:300]:
                    shap_input.append({
                        **n,
                        "is_anomalous": 0,
                        "anomaly_score": 0.0,
                    })

                shap_input.append({
                    **target_node,
                    "is_anomalous": 1,
                    "anomaly_score": score,
                })

                shap_results = run_shap(shap_input)

                await emit_event(event_queue, "shap_completed", {
                    "node_id": node_id,
                    "top_factors": shap_results[0]["top_factors"],
                    "message": "Top fraud indicators identified"
                })

            else:

                shap_results = [build_non_anomalous_shap(node_id, score)]

                await emit_event(event_queue, "shap_skipped", {
                    "node_id": node_id,
                    "message": "Node classified as normal behavior"
                })


            # -------------------------
            # PERSIST RESULTS
            # -------------------------
            await post_anomaly_score(node_id, score)

            await post_fraud_explanation(node_id, reasons)

            for shap in shap_results:
                await post_shap_explanation({
                    "node_id": shap["node_id"],
                    "anomaly_score": shap["anomaly_score"],
                    "top_factors": shap["top_factors"],
                    "model": shap.get("model", "shap_v1"),
                    "source": "visual-analytics",
                })


        # -------------------------
        # FINAL TERMINAL EVENT
        # -------------------------
        await emit_event(event_queue, "unsupervised_completed", {
            "final_status": "DONE",
            "nodes_processed": [n.nodeId for n in nodes],
            "message": "Investigation completed successfully"
        })


    except Exception as e:

        # -------------------------
        # ERROR TERMINAL EVENT
        # -------------------------
        await emit_event(event_queue, "error", {
            "message": str(e)
        })