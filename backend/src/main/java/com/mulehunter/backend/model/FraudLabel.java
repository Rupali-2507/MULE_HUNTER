package com.mulehunter.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "fraud_labels")
public class FraudLabel {

    @Id
    private String id;

    private String transactionId;
    private int actualLabel; // 1 = fraud, 0 = safe
    private Instant confirmedAt;

    // ── Constructors ─────────────────────────────────────────────

    public FraudLabel() {}

    public FraudLabel(String transactionId, int actualLabel, Instant confirmedAt) {
        this.transactionId = transactionId;
        this.actualLabel = actualLabel;
        this.confirmedAt = confirmedAt;
    }

    // ── Getters / Setters ───────────────────────────────────────

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public int getActualLabel() {
        return actualLabel;
    }

    public void setActualLabel(int actualLabel) {
        this.actualLabel = actualLabel;
    }

    public Instant getConfirmedAt() {
        return confirmedAt;
    }

    public void setConfirmedAt(Instant confirmedAt) {
        this.confirmedAt = confirmedAt;
    }
}