package com.mulehunter.backend.model;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

@Document(collection = "newtransactions") // ✅ Kept your original collection name
public class Transaction {

    @Id
    private String id;

    private String sourceAccount;
    private String targetAccount;

    @Field(targetType = FieldType.DECIMAL128) // ✅ Kept your original financial formatting
    private BigDecimal amount;

    private boolean suspectedFraud;
    private Double riskScore;
    private String verdict;

    // =================================================================
    // 🛡️ NEW FIELDS ADDED SAFELY (For Muskan's AI Cards)
    // =================================================================
    private int outDegree;
    private double riskRatio;
    private String populationSize;
    
    private boolean ja3Detected;
    private List<String> linkedAccounts = new ArrayList<>(); // Init to avoid NullPointer
    
    private String unsupervisedModelName;
    private double unsupervisedScore;
    // =================================================================

    public Transaction() {
    }

    // ✅ Kept your exact original logic to avoid breaking legacy flows
    public static Transaction from(TransactionRequest request) {
        Transaction tx = new Transaction();
        tx.sourceAccount = request.getSourceAccount();
        tx.targetAccount = request.getTargetAccount();
        
        if (request.getAmount() == null) {
            tx.amount = BigDecimal.ZERO;
        } else {
            tx.amount = request.getAmount();
        }
        
        tx.suspectedFraud = false;
        tx.riskScore = 0.0;
        tx.verdict = "PENDING";
        return tx;
    }

    // --- EXISTING GETTERS/SETTERS (Untouched) ---

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

    // --- NEW GETTERS/SETTERS (Required to fix the "cannot find symbol" error) ---

    public int getOutDegree() { return outDegree; }
    public void setOutDegree(int outDegree) { this.outDegree = outDegree; }

    public double getRiskRatio() { return riskRatio; }
    public void setRiskRatio(double riskRatio) { this.riskRatio = riskRatio; }

    public String getPopulationSize() { return populationSize; }
    public void setPopulationSize(String populationSize) { this.populationSize = populationSize; }

    public boolean isJa3Detected() { return ja3Detected; }
    public void setJa3Detected(boolean ja3Detected) { this.ja3Detected = ja3Detected; }

    public List<String> getLinkedAccounts() { return linkedAccounts; }
    public void setLinkedAccounts(List<String> linkedAccounts) { this.linkedAccounts = linkedAccounts; }

    public String getUnsupervisedModelName() { return unsupervisedModelName; }
    public void setUnsupervisedModelName(String unsupervisedModelName) { this.unsupervisedModelName = unsupervisedModelName; }

    public double getUnsupervisedScore() { return unsupervisedScore; }
    public void setUnsupervisedScore(double unsupervisedScore) { this.unsupervisedScore = unsupervisedScore; }
}