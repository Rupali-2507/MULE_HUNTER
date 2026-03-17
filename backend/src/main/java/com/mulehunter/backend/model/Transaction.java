package com.mulehunter.backend.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.index.Indexed;

@Document(collection = "newtransactions")
public class Transaction {

    @Id
    private String id;

    @Indexed(unique = true)
    private String transactionId;

    private String sourceAccount;
    private String targetAccount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;

    private Instant timestamp;
    private String status;
    private String decision;   // APPROVE / REVIEW / BLOCK

    private boolean suspectedFraud;
    private Double riskScore;
    private String verdict;

    // ── OLD graph/AI fields (kept) ────────────────────────────────
    private int outDegree;
    private Double riskRatio;
    private Integer populationSize;
    private List<String> linkedAccounts = new ArrayList<>();
    private String unsupervisedModelName;
    private Double unsupervisedScore;

    // ── NEW GNN rich fields ───────────────────────────────────────
    private Double gnnScore;
    private Double gnnConfidence;
    private String riskLevel;

    // network metrics
    private Integer suspiciousNeighbors;
    private Integer sharedDevices;
    private Integer sharedIPs;
    private Double centralityScore;
    private Boolean transactionLoops;

    // fraud cluster
    private Integer clusterId;
    private Integer clusterSize;
    private Double clusterRiskScore;

    // mule ring
    private Boolean muleRingMember;
    private Integer ringId;
    private String ringShape;
    private Integer ringSize;
    private String role;
    private String hubAccount;
    private List<String> ringAccounts = new ArrayList<>();

    // risk factors & embedding
    private List<String> riskFactors = new ArrayList<>();
    private Double embeddingNorm;

    // ── Risk combine component scores ─────────────────────────────
    private Double behaviorScore;
    private Double graphScore;
    private Double velocityScore;
    private Double burstScore;

    // ── JA3 fields ────────────────────────────────────────────────
    private Boolean ja3Detected;
    private Double ja3Risk;
    private Integer ja3Velocity;
    private Integer ja3Fanout;
    private String deviceHash;
    private String ipAddress;
    private Integer ja3ReuseCount;
    private Integer deviceReuseCount;
    private Integer ipReuseCount;
    private Boolean isNewDevice;
    private Boolean isNewJa3;

    public Transaction() {}

    public static Transaction from(TransactionRequest request) {
        Transaction tx = new Transaction();
        tx.transactionId = request.getTransactionId();
        tx.sourceAccount = request.getSourceAccount();
        tx.targetAccount = request.getTargetAccount();
        tx.amount = request.getAmount() == null ? BigDecimal.ZERO : request.getAmount();
        tx.timestamp = request.getTimestamp();
        tx.status = "PENDING_RISK";
        tx.decision = "PENDING";
        tx.suspectedFraud = false;
        tx.riskScore = 0.0;
        tx.verdict = "PENDING";
        return tx;
    }

    // ── Getters / Setters ─────────────────────────────────────────

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTransactionId() { return transactionId; }
    public void setTransactionId(String v) { this.transactionId = v; }

    public String getSourceAccount() { return sourceAccount; }
    public void setSourceAccount(String v) { this.sourceAccount = v; }

    public String getTargetAccount() { return targetAccount; }
    public void setTargetAccount(String v) { this.targetAccount = v; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal v) { this.amount = v; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant v) { this.timestamp = v; }

    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }

    public String getDecision() { return decision; }
    public void setDecision(String v) { this.decision = v; }

    public boolean isSuspectedFraud() { return suspectedFraud; }
    public void setSuspectedFraud(boolean v) { this.suspectedFraud = v; }

    public Double getRiskScore() { return riskScore; }
    public void setRiskScore(Double v) { this.riskScore = v; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String v) { this.verdict = v; }

    public int getOutDegree() { return outDegree; }
    public void setOutDegree(int v) { this.outDegree = v; }

    public Double getRiskRatio() { return riskRatio; }
    public void setRiskRatio(Double v) { this.riskRatio = v; }

    public Integer getPopulationSize() { return populationSize; }
    public void setPopulationSize(Integer v) { this.populationSize = v; }

    public List<String> getLinkedAccounts() { return linkedAccounts; }
    public void setLinkedAccounts(List<String> v) { this.linkedAccounts = v; }

    public String getUnsupervisedModelName() { return unsupervisedModelName; }
    public void setUnsupervisedModelName(String v) { this.unsupervisedModelName = v; }

    public Double getUnsupervisedScore() { return unsupervisedScore; }
    public void setUnsupervisedScore(double v) { this.unsupervisedScore = v; }

    public Double getGnnScore() { return gnnScore; }
    public void setGnnScore(Double v) { this.gnnScore = v; }

    public Double getGnnConfidence() { return gnnConfidence; }
    public void setGnnConfidence(Double v) { this.gnnConfidence = v; }

    public String getRiskLevel() { return riskLevel; }
    public void setRiskLevel(String v) { this.riskLevel = v; }

    public Integer getSuspiciousNeighbors() { return suspiciousNeighbors; }
    public void setSuspiciousNeighbors(Integer v) { this.suspiciousNeighbors = v; }

    public Integer getSharedDevices() { return sharedDevices; }
    public void setSharedDevices(Integer v) { this.sharedDevices = v; }

    public Integer getSharedIPs() { return sharedIPs; }
    public void setSharedIPs(Integer v) { this.sharedIPs = v; }

    public Double getCentralityScore() { return centralityScore; }
    public void setCentralityScore(Double v) { this.centralityScore = v; }

    public Boolean getTransactionLoops() { return transactionLoops; }
    public void setTransactionLoops(Boolean v) { this.transactionLoops = v; }

    public Integer getClusterId() { return clusterId; }
    public void setClusterId(Integer v) { this.clusterId = v; }

    public Integer getClusterSize() { return clusterSize; }
    public void setClusterSize(Integer v) { this.clusterSize = v; }

    public Double getClusterRiskScore() { return clusterRiskScore; }
    public void setClusterRiskScore(Double v) { this.clusterRiskScore = v; }

    public Boolean getMuleRingMember() { return muleRingMember; }
    public void setMuleRingMember(Boolean v) { this.muleRingMember = v; }

    public Integer getRingId() { return ringId; }
    public void setRingId(Integer v) { this.ringId = v; }

    public String getRingShape() { return ringShape; }
    public void setRingShape(String v) { this.ringShape = v; }

    public Integer getRingSize() { return ringSize; }
    public void setRingSize(Integer v) { this.ringSize = v; }

    public String getRole() { return role; }
    public void setRole(String v) { this.role = v; }

    public String getHubAccount() { return hubAccount; }
    public void setHubAccount(String v) { this.hubAccount = v; }

    public List<String> getRingAccounts() { return ringAccounts; }
    public void setRingAccounts(List<String> v) { this.ringAccounts = v; }

    public List<String> getRiskFactors() { return riskFactors; }
    public void setRiskFactors(List<String> v) { this.riskFactors = v; }

    public Double getEmbeddingNorm() { return embeddingNorm; }
    public void setEmbeddingNorm(Double v) { this.embeddingNorm = v; }

    public Double getBehaviorScore() { return behaviorScore; }
    public void setBehaviorScore(Double v) { this.behaviorScore = v; }

    public Double getGraphScore() { return graphScore; }
    public void setGraphScore(Double v) { this.graphScore = v; }

    public Double getVelocityScore() { return velocityScore; }
    public void setVelocityScore(Double v) { this.velocityScore = v; }

    public Double getBurstScore() { return burstScore; }
    public void setBurstScore(Double v) { this.burstScore = v; }

    public Boolean getJa3Detected() { return ja3Detected; }
    public void setJa3Detected(Boolean v) { this.ja3Detected = v; }

    public Double getJa3Risk() { return ja3Risk; }
    public void setJa3Risk(Double v) { this.ja3Risk = v; }

    public Integer getJa3Velocity() { return ja3Velocity; }
    public void setJa3Velocity(Integer v) { this.ja3Velocity = v; }

    public Integer getJa3Fanout() { return ja3Fanout; }
    public void setJa3Fanout(Integer v) { this.ja3Fanout = v; }

    public String getDeviceHash() { return deviceHash; }
    public void setDeviceHash(String v) { this.deviceHash = v; }

    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String v) { this.ipAddress = v; }

    public Integer getJa3ReuseCount() { return ja3ReuseCount; }
    public void setJa3ReuseCount(Integer v) { this.ja3ReuseCount = v; }

    public Integer getDeviceReuseCount() { return deviceReuseCount; }
    public void setDeviceReuseCount(Integer v) { this.deviceReuseCount = v; }

    public Integer getIpReuseCount() { return ipReuseCount; }
    public void setIpReuseCount(Integer v) { this.ipReuseCount = v; }

    public Boolean getIsNewDevice() { return isNewDevice; }
    public void setIsNewDevice(Boolean v) { this.isNewDevice = v; }

    public Boolean getIsNewJa3() { return isNewJa3; }
    public void setIsNewJa3(Boolean v) { this.isNewJa3 = v; }
}