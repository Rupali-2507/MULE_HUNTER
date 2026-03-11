package com.mulehunter.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;

import java.time.Instant;

/**
 * Step 4 — Account Daily Aggregate
 * One document per account. Updated incrementally on every transaction.
 * Avoids heavy re-aggregation queries at scoring time.
 */
@Document(collection = "account_aggregates")
@CompoundIndex(name = "account_idx", def = "{'accountId': 1}", unique = true)
public class AccountAggregate {

    @Id
    private String id;

    @Indexed(unique = true)
    private String accountId;

    // ── 24h rolling window ─────────────────────────────────────────────
    private double totalOut24h   = 0.0;
    private double totalIn24h    = 0.0;
    private int    txnCount24h   = 0;

    // ── 7-day window ───────────────────────────────────────────────────
    private double totalOut7d    = 0.0;
    private double totalIn7d     = 0.0;
    private int    txnCount7d    = 0;
    private int    uniqueCounterparties7d = 0;

    // ── JA3 / Device signals ───────────────────────────────────────────
    private int    ja3ReuseCount    = 0;
    private int    deviceReuseCount = 0;
    private int    ipReuseCount     = 0;

    // ── Timestamps ─────────────────────────────────────────────────────
    private Instant lastUpdated;
    private Instant windowStart24h;
    private Instant windowStart7d;

    public AccountAggregate() {}

    public static AccountAggregate newFor(String accountId) {
        AccountAggregate a = new AccountAggregate();
        a.accountId      = accountId;
        a.lastUpdated    = Instant.now();
        a.windowStart24h = Instant.now();
        a.windowStart7d  = Instant.now();
        return a;
    }

    // Getters & Setters
    public String getId()              { return id; }
    public void   setId(String id)     { this.id = id; }

    public String getAccountId()                   { return accountId; }
    public void   setAccountId(String accountId)   { this.accountId = accountId; }

    public double getTotalOut24h()                 { return totalOut24h; }
    public void   setTotalOut24h(double v)         { this.totalOut24h = v; }

    public double getTotalIn24h()                  { return totalIn24h; }
    public void   setTotalIn24h(double v)          { this.totalIn24h = v; }

    public int  getTxnCount24h()                   { return txnCount24h; }
    public void setTxnCount24h(int v)              { this.txnCount24h = v; }

    public double getTotalOut7d()                  { return totalOut7d; }
    public void   setTotalOut7d(double v)          { this.totalOut7d = v; }

    public double getTotalIn7d()                   { return totalIn7d; }
    public void   setTotalIn7d(double v)           { this.totalIn7d = v; }

    public int  getTxnCount7d()                    { return txnCount7d; }
    public void setTxnCount7d(int v)               { this.txnCount7d = v; }

    public int  getUniqueCounterparties7d()        { return uniqueCounterparties7d; }
    public void setUniqueCounterparties7d(int v)   { this.uniqueCounterparties7d = v; }

    public int  getJa3ReuseCount()                 { return ja3ReuseCount; }
    public void setJa3ReuseCount(int v)            { this.ja3ReuseCount = v; }

    public int  getDeviceReuseCount()              { return deviceReuseCount; }
    public void setDeviceReuseCount(int v)         { this.deviceReuseCount = v; }

    public int  getIpReuseCount()                  { return ipReuseCount; }
    public void setIpReuseCount(int v)             { this.ipReuseCount = v; }

    public Instant getLastUpdated()                    { return lastUpdated; }
    public void    setLastUpdated(Instant lastUpdated) { this.lastUpdated = lastUpdated; }

    public Instant getWindowStart24h()                       { return windowStart24h; }
    public void    setWindowStart24h(Instant windowStart24h) { this.windowStart24h = windowStart24h; }

    public Instant getWindowStart7d()                      { return windowStart7d; }
    public void    setWindowStart7d(Instant windowStart7d) { this.windowStart7d = windowStart7d; }
}