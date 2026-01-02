package com.mulehunter.backend.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

@Document(collection = "newtransactions")
public class Transaction {

    @Id
    private String id;

    private String sourceAccount;
    private String targetAccount;

    @Field(targetType = FieldType.DECIMAL128)
    private BigDecimal amount;

    private boolean suspectedFraud;
    private Double riskScore;
    private String verdict;

    // ================= GRAPH / AI =================
    private int outDegree;
    private double riskRatio;
    private String populationSize;

    private List<String> linkedAccounts = new ArrayList<>();

    private String unsupervisedModelName;
    private double unsupervisedScore;

    // ================= JA3 =================
    private Boolean ja3Detected;
    private Double ja3Risk;
    private Integer ja3Velocity;
    private Integer ja3Fanout;

    public Transaction() {}

    public static Transaction from(TransactionRequest request) {
        Transaction tx = new Transaction();
        tx.sourceAccount = request.getSourceAccount();
        tx.targetAccount = request.getTargetAccount();
        tx.amount = request.getAmount() == null ? BigDecimal.ZERO : request.getAmount();
        tx.suspectedFraud = false;
        tx.riskScore = 0.0;
        tx.verdict = "PENDING";
        return tx;
    }

    // ================= GETTERS / SETTERS =================

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSourceAccount() { return sourceAccount; }
    public void setSourceAccount(String sourceAccount) { this.sourceAccount = sourceAccount; }

    public String getTargetAccount() { return targetAccount; }
    public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public boolean isSuspectedFraud() { return suspectedFraud; }
    public void setSuspectedFraud(boolean suspectedFraud) { this.suspectedFraud = suspectedFraud; }

    public Double getRiskScore() { return riskScore; }
    public void setRiskScore(Double riskScore) { this.riskScore = riskScore; }

    public String getVerdict() { return verdict; }
    public void setVerdict(String verdict) { this.verdict = verdict; }

    public int getOutDegree() { return outDegree; }
    public void setOutDegree(int outDegree) { this.outDegree = outDegree; }

    public double getRiskRatio() { return riskRatio; }
    public void setRiskRatio(double riskRatio) { this.riskRatio = riskRatio; }

    public String getPopulationSize() { return populationSize; }
    public void setPopulationSize(String populationSize) { this.populationSize = populationSize; }

    public List<String> getLinkedAccounts() { return linkedAccounts; }
    public void setLinkedAccounts(List<String> linkedAccounts) { this.linkedAccounts = linkedAccounts; }

    public String getUnsupervisedModelName() { return unsupervisedModelName; }
    public void setUnsupervisedModelName(String unsupervisedModelName) {
        this.unsupervisedModelName = unsupervisedModelName;
    }

    public double getUnsupervisedScore() { return unsupervisedScore; }
    public void setUnsupervisedScore(double unsupervisedScore) {
        this.unsupervisedScore = unsupervisedScore;
    }

    // ================= JA3 GETTERS =================

    public Boolean getJa3Detected() { return ja3Detected; }
    public void setJa3Detected(Boolean ja3Detected) { this.ja3Detected = ja3Detected; }

    public Double getJa3Risk() { return ja3Risk; }
    public void setJa3Risk(Double ja3Risk) { this.ja3Risk = ja3Risk; }

    public Integer getJa3Velocity() { return ja3Velocity; }
    public void setJa3Velocity(Integer ja3Velocity) { this.ja3Velocity = ja3Velocity; }

    public Integer getJa3Fanout() { return ja3Fanout; }
    public void setJa3Fanout(Integer ja3Fanout) { this.ja3Fanout = ja3Fanout; }
}
