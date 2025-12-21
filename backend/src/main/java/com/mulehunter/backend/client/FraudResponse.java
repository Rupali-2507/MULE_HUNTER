package com.mulehunter.backend.client;

public class FraudResponse {

    private int node_id;
    private double risk_score;
    private String verdict;

    public int getNode_id() {
        return node_id;
    }

    public double getRisk_score() {
        return risk_score;
    }

    public String getVerdict() {
        return verdict;
    }

    public boolean isFraud() {
        return risk_score > 0.75;
    }
}
