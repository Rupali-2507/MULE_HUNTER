from fastapi import FastAPI
from .schemas import ScoreRequest, ScoreResponse
from .inference import score_features

app = FastAPI(
    title="EIF Behavioral Scoring Service",
    version="1.0.0"
)

@app.post("/eif/score", response_model=ScoreResponse)
def score(request: ScoreRequest):
    result = score_features(request.features)
    return result

@app.get("/health")
def health():
    return {"status": "ok"}