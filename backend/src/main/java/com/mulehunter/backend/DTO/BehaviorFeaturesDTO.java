package com.mulehunter.backend.DTO;

/**
 * Step 5 — Behavioral Feature Vector sent to ML service.
 */
public class BehaviorFeaturesDTO {

    private double totalIn24h;
    private double totalOut24h;
    private int    txnCount24h;
    private int    uniqueCounterparties7d;
    private double transactionVelocityScore;
    private double burstScore;
    private double avgAmountDeviation;

    public BehaviorFeaturesDTO() {}

    public BehaviorFeaturesDTO(double totalIn24h, double totalOut24h,
                                int txnCount24h, int uniqueCounterparties7d,
                                double transactionVelocityScore,
                                double burstScore, double avgAmountDeviation) {
        this.totalIn24h                = totalIn24h;
        this.totalOut24h               = totalOut24h;
        this.txnCount24h               = txnCount24h;
        this.uniqueCounterparties7d    = uniqueCounterparties7d;
        this.transactionVelocityScore  = transactionVelocityScore;
        this.burstScore                = burstScore;
        this.avgAmountDeviation        = avgAmountDeviation;
    }

    public double getTotalIn24h()                 { return totalIn24h; }
    public double getTotalOut24h()                { return totalOut24h; }
    public int    getTxnCount24h()                { return txnCount24h; }
    public int    getUniqueCounterparties7d()     { return uniqueCounterparties7d; }
    public double getTransactionVelocityScore()   { return transactionVelocityScore; }
    public double getBurstScore()                 { return burstScore; }
    public double getAvgAmountDeviation()         { return avgAmountDeviation; }
}