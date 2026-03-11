package com.mulehunter.backend.DTO;

public class RiskDecisionDTO {

    private String transactionId;
    private String decision;        // APPROVE | REVIEW | BLOCK
    private double riskScore;       // 0.0 – 1.0
    private String explanation;
    private boolean highConfidence;

    private RiskDecisionDTO() {}

    public String getTransactionId() { return transactionId; }
    public String getDecision()      { return decision; }
    public double getRiskScore()     { return riskScore; }
    public String getExplanation()   { return explanation; }
    public boolean isHighConfidence(){ return highConfidence; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private final RiskDecisionDTO dto = new RiskDecisionDTO();
        public Builder transactionId(String v)  { dto.transactionId = v;  return this; }
        public Builder decision(String v)        { dto.decision = v;        return this; }
        public Builder riskScore(double v)       { dto.riskScore = v;       return this; }
        public Builder explanation(String v)     { dto.explanation = v;     return this; }
        public Builder highConfidence(boolean v) { dto.highConfidence = v;  return this; }
        public RiskDecisionDTO build()           { return dto; }
    }
}