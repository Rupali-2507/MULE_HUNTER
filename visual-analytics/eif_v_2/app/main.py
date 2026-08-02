import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from .schemas import EIFRequest
from .inference import score_eif
from .config import EVAL_REPORT_PATH
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/v1/eif/score")
def score_endpoint(req: EIFRequest):

    score, top_factors, explanation = score_eif(req.features)

    # Confidence = distance from the decision boundary (0.5), mapped to [0, 1].
    # score=0.50 → 0.00 (maximally uncertain)
    # score=0.80 → 0.60 (reasonably confident fraud)
    # score=0.05 → 0.90 (confidently clean)
    confidence = round(abs(float(score) - 0.5) * 2, 3)

    is_anomalous = int(score >= 0.5)

    return JSONResponse(
        content={
            "model": "EIF",
            "version": "v2.1",
            "score": float(score),
            "isAnomalous": is_anomalous,
            "confidence": confidence,
            "topFactors": {
                k: float(v) for k, v in top_factors.items()
            },
            "explanation": explanation
        }
    )


@app.get("/v1/eif/metrics")
def metrics_endpoint():
    """Returns the training-time scientific evaluation report (F1, AUC, etc)."""
    if not EVAL_REPORT_PATH.exists():
        raise HTTPException(status_code=404, detail="Evaluation report not found")

    with open(EVAL_REPORT_PATH, "r") as f:
        data = json.load(f)
    return JSONResponse(content=data)