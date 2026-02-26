from pydantic import BaseModel
from typing import List


class FraudFactor(BaseModel):
    feature: str
    impact: float


class FraudExplanation(BaseModel):
    top_factors: List[FraudFactor]


class ShapExplanation(BaseModel):
    model: str
    reasons: List[str]


class VisualNodeResult(BaseModel):
    node_id: int
    anomaly_score: float
    is_anomalous: bool
    risk_ratio: float

    fraud_explanation: FraudExplanation
    shap_explanation: ShapExplanation


class VisualAnalyticsResponse(BaseModel):
    final_status: str
    nodes_processed: List[int]
    results: List[VisualNodeResult]
