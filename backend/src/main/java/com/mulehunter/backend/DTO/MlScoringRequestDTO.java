package com.mulehunter.backend.DTO;

/**
 * Step 7 — Structured ML Scoring Request
 * Sent from Spring Boot → AI Engine (Python/FastAPI)
 */
public class MlScoringRequestDTO {

    private String              accountId;
    private String              transactionId;
    private double              transactionAmount;
    private BehaviorFeaturesDTO behaviorFeatures;
    private IdentityFeaturesDTO identityFeatures;
    private GraphFeaturesDTO    graphFeatures;

    public MlScoringRequestDTO() {}

    public MlScoringRequestDTO(String accountId, String transactionId, double transactionAmount,
                                BehaviorFeaturesDTO behaviorFeatures,
                                IdentityFeaturesDTO identityFeatures,
                                GraphFeaturesDTO graphFeatures) {
        this.accountId         = accountId;
        this.transactionId     = transactionId;
        this.transactionAmount = transactionAmount;
        this.behaviorFeatures  = behaviorFeatures;
        this.identityFeatures  = identityFeatures;
        this.graphFeatures     = graphFeatures;
    }

    public String              getAccountId()         { return accountId; }
    public String              getTransactionId()     { return transactionId; }
    public double              getTransactionAmount() { return transactionAmount; }
    public BehaviorFeaturesDTO getBehaviorFeatures()  { return behaviorFeatures; }
    public IdentityFeaturesDTO getIdentityFeatures()  { return identityFeatures; }
    public GraphFeaturesDTO    getGraphFeatures()     { return graphFeatures; }
}