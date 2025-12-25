import logging
import httpx
from app.config import BACKEND_BASE_URL, REQUEST_TIMEOUT


# =============================
# INTERNAL HELPERS
# =============================

async def _post_safe(url: str, data: list):
    """
    Async backend POST with timeout + error isolation.
    This MUST be awaited so it actually executes.
    """
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            await client.post(url, json=data)
            logging.info(
                f"POST success → {url} ({len(data)} records)"
            )
    except Exception as e:
        # Backend failure must NOT crash pipeline
        logging.error(f"POST failed → {url} | {e}")


# =============================
# READ APIs (AWAIT RESPONSE)
# =============================

async def get_nodes_enriched():
    """
    READ call → we wait for backend response.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        resp = await client.get(
            f"{BACKEND_BASE_URL}/backend/api/nodes/enriched"
        )

        if not resp.is_success:
            logging.error(
                f"Backend API failed [{resp.status_code}]: {resp.text}"
            )
            raise RuntimeError("Failed to fetch enriched nodes")

        return resp.json()


# =============================
# WRITE APIs (AWAITABLE, SAFE)
# =============================

async def post_anomaly_scores(data: list):
    await _post_safe(
        f"{BACKEND_BASE_URL}/backend/api/visual/anomaly-scores/batch",
        data
    )


async def post_shap_explanations(data: list):
    await _post_safe(
        f"{BACKEND_BASE_URL}/backend/api/visual/shap-explanations/batch",
        data
    )


async def post_fraud_explanations(data: list):
    await _post_safe(
        f"{BACKEND_BASE_URL}/backend/api/visual/fraud-explanations/batch",
        data
    )
