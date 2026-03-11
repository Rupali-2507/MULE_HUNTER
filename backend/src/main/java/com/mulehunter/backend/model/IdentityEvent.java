package com.mulehunter.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

/**
 * Step 2 — Identity Event (Audit Layer)
 * Written once per transaction, never updated.
 * Used for: auditability, replay, model retraining.
 */
@Document(collection = "identity_events")
public class IdentityEvent {

    @Id
    private String id;

    @Indexed
    private String accountId;

    private String transactionId;
    private String ja3;
    private String deviceHash;
    private String ip;
    private String geo;
    private Instant timestamp;

    public IdentityEvent() {}

    public static IdentityEvent from(String accountId, String transactionId,
                                     String ja3, String deviceHash,
                                     String ip, String geo) {
        IdentityEvent e = new IdentityEvent();
        e.accountId     = accountId;
        e.transactionId = transactionId;
        e.ja3           = ja3;
        e.deviceHash    = deviceHash;
        e.ip            = ip;
        e.geo           = geo;
        e.timestamp     = Instant.now();
        return e;
    }

    // Getters & Setters
    public String getId()            { return id; }
    public void setId(String id)     { this.id = id; }

    public String getAccountId()               { return accountId; }
    public void setAccountId(String accountId) { this.accountId = accountId; }

    public String getTransactionId()                     { return transactionId; }
    public void setTransactionId(String transactionId)   { this.transactionId = transactionId; }

    public String getJa3()           { return ja3; }
    public void setJa3(String ja3)   { this.ja3 = ja3; }

    public String getDeviceHash()                  { return deviceHash; }
    public void setDeviceHash(String deviceHash)   { this.deviceHash = deviceHash; }

    public String getIp()            { return ip; }
    public void setIp(String ip)     { this.ip = ip; }

    public String getGeo()           { return geo; }
    public void setGeo(String geo)   { this.geo = geo; }

    public Instant getTimestamp()                { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}