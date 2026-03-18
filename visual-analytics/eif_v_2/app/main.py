from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .schemas import EIFRequest
from .inference import score_eif

app = FastAPI()


@app.post("/v1/eif/score")
def score_endpoint(req: EIFRequest):

    score, top_factors, explanation = score_eif(req.features)

    return JSONResponse(
        content={
            "model": "EIF",
            "version": "v2.1",
            "score": float(score),
            "confidence": 0.88,
            "topFactors": {
                k: float(v) for k, v in top_factors.items()
            },
            "explanation": explanation
        }
    )