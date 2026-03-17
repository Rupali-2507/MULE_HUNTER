package com.mulehunter.backend.model;

import java.util.List;

public class AiRiskResult {

    // ── Core scores ───────────────────────────────────────────────
    private double riskScore;
    private String verdict;
    private boolean suspectedFraud;
    private String modelVersion;
    private double unsupervisedScore;

    // ── Old fields (kept for backward compat) ─────────────────────
    private int outDegree;
    private double riskRatio;
    private String populationSize;
    private List<String> linkedAccounts;

    // ── NEW: scores block ─────────────────────────────────────────
    private double gnnScore;
    private double confidence;
    private String riskLevel;

    // ── NEW: network metrics ──────────────────────────────────────
    private int suspiciousNeighbors;
    private int sharedDevices;
    private int sharedIPs;
    private double centralityScore;
    private boolean transactionLoops;

    // ── NEW: fraud cluster ────────────────────────────────────────
    private int clusterId;
    private int clusterSize;
    private double clusterRiskScore;

    // ── NEW: mule ring detection ──────────────────────────────────
    private boolean isMuleRingMember;
    private int ringId;
    private String ringShape;
    private int ringSize;
    private String role;
    private String hubAccount;
    private List<String> ringAccounts;

    // ── NEW: risk factors & embedding ────────────────────────────
    private List<String> riskFactors;
    private double embeddingNorm;

    // ── Getters / Setters ─────────────────────────────────────────
    public double getRiskScore() { return riskScore; }
    public void setRiskScore(double v) { this.riskScore = v; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String v) { this.verdict = v; }

    public boolean isSuspectedFraud() { return suspectedFraud; }
    public void setSuspectedFraud(boolean v) { this.suspectedFraud = v; }

    public String getModelVersion() { return modelVersion; }
    public void setModelVersion(String v) { this.modelVersion = v; }

    public double getUnsupervisedScore() { return unsupervisedScore; }
    public void setUnsupervisedScore(double v) { this.unsupervisedScore = v; }

    public int getOutDegree() { return outDegree; }
    public void setOutDegree(int v) { this.outDegree = v; }

    public double getRiskRatio() { return riskRatio; }
    public void setRiskRatio(double v) { this.riskRatio = v; }

    public String getPopulationSize() { return populationSize; }
    public void setPopulationSize(String v) { this.populationSize = v; }

    public List<String> getLinkedAccounts() { return linkedAccounts; }
    public void setLinkedAccounts(List<String> v) { this.linkedAccounts = v; }

    public double getGnnScore() { return gnnScore; }
    public void setGnnScore(double v) { this.gnnScore = v; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double v) { this.confidence = v; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String v) { this.riskLevel = v; }

    public int getSuspiciousNeighbors() { return suspiciousNeighbors; }
    public void setSuspiciousNeighbors(int v) { this.suspiciousNeighbors = v; }

    public int getSharedDevices() { return sharedDevices; }
    public void setSharedDevices(int v) { this.sharedDevices = v; }

    public int getSharedIPs() { return sharedIPs; }
    public void setSharedIPs(int v) { this.sharedIPs = v; }

    public double getCentralityScore() { return centralityScore; }
    public void setCentralityScore(double v) { this.centralityScore = v; }

    public boolean isTransactionLoops() { return transactionLoops; }
    public void setTransactionLoops(boolean v) { this.transactionLoops = v; }

    public int getClusterId() { return clusterId; }
    public void setClusterId(int v) { this.clusterId = v; }

    public int getClusterSize() { return clusterSize; }
    public void setClusterSize(int v) { this.clusterSize = v; }

    public double getClusterRiskScore() { return clusterRiskScore; }
    public void setClusterRiskScore(double v) { this.clusterRiskScore = v; }

    public boolean isMuleRingMember() { return isMuleRingMember; }
    public void setMuleRingMember(boolean v) { this.isMuleRingMember = v; }

    public int getRingId() { return ringId; }
    public void setRingId(int v) { this.ringId = v; }

    public String getRingShape() { return ringShape; }
    public void setRingShape(String v) { this.ringShape = v; }

    public int getRingSize() { return ringSize; }
    public void setRingSize(int v) { this.ringSize = v; }

    public String getRole() { return role; }
    public void setRole(String v) { this.role = v; }

    public String getHubAccount() { return hubAccount; }
    public void setHubAccount(String v) { this.hubAccount = v; }

    public List<String> getRingAccounts() { return ringAccounts; }
    public void setRingAccounts(List<String> v) { this.ringAccounts = v; }

    public List<String> getRiskFactors() { return riskFactors; }
    public void setRiskFactors(List<String> v) { this.riskFactors = v; }

    public double getEmbeddingNorm() { return embeddingNorm; }
    public void setEmbeddingNorm(double v) { this.embeddingNorm = v; }
}