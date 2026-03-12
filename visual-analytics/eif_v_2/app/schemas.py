from pydantic import BaseModel
from typing import List

class ScoreRequest(BaseModel):
    accountId: str
    features: List[float]

class ScoreResponse(BaseModel):
    model: str
    version: str
    score: float
    isAnomalous: int
    confidence: float