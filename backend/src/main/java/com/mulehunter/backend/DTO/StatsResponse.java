package com.mulehunter.backend.DTO;

import java.util.List;

/**
 * Response DTO for GET /api/admin/stats
 * Powers the Network Performance KPIs dashboard.
 */
public class StatsResponse {

    // ── Top KPI cards ─────────────────────────────────────────────
    public double throughputTps;         // transactions / 86400 (min 1 for display)
    public double avgDetectionLatencyMs;     // avg ms to score a transaction
    public long   muleAccountsBlocked;       // BLOCK decisions + suspectedFraud=true
    public long   muleAccountsBlockedToday;  // same, filtered to today UTC
    public double systemScalabilityTxDay;    // 25,000,000 peak capacity

    // ── Detection Accuracy ────────────────────────────────────────
    public double detectionAccuracy;    // GNN precision from latest evaluate-models run
    public double falsePositiveRate;    // FPR from latest evaluate-models run
    public double targetVariance;       // constant: 0.005 (<0.5%)

    // ── Enforcement Distribution ──────────────────────────────────
    public double accountsFrozenPct;    // % BLOCK of total flagged
    public double flaggedForReviewPct;  // % REVIEW of total flagged
    public double policeReferralsPct;   // % riskScore >= 0.90

    // ── Operational Summary ───────────────────────────────────────
    public double valueInterceptedCrores; // sum(amount of BLOCK txs) / 1Cr
    public long   totalTransactions;      // raw tx count (use for display, e.g. "4,970")
    public long   millionsOfTransactions; // totalTx / 1_000_000  (0 until you hit 1M)
    public double maxScalabilityMDay;     // 25.0 (M/day)

    // ── Live Activity (3 events) ──────────────────────────────────
    public List<LiveEvent> liveEvents;

    public static class LiveEvent {
        public String time;       // "HH:mm:ss" UTC
        public String message;
        public String accountId;  // "ID_12395"
        public String severity;   // CRITICAL / HIGH / STABLE

        public LiveEvent(String time, String message, String accountId, String severity) {
            this.time      = time;
            this.message   = message;
            this.accountId = accountId;
            this.severity  = severity;
        }
    }
}