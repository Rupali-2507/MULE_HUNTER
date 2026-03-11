package com.mulehunter.backend.DTO;

/**
 * Step 6 — Graph Context Feature Vector sent to ML service.
 */
public class GraphFeaturesDTO {

    private int    suspiciousNeighborCount;
    private double twoHopFraudDensity;
    private double connectivityScore;
    private String fraudClusterId;
    private int    totalEdges;

    public GraphFeaturesDTO() {}

    public GraphFeaturesDTO(int suspiciousNeighborCount, double twoHopFraudDensity,
                             double connectivityScore, String fraudClusterId, int totalEdges) {
        this.suspiciousNeighborCount = suspiciousNeighborCount;
        this.twoHopFraudDensity      = twoHopFraudDensity;
        this.connectivityScore       = connectivityScore;
        this.fraudClusterId          = fraudClusterId;
        this.totalEdges              = totalEdges;
    }

    public int    getSuspiciousNeighborCount()  { return suspiciousNeighborCount; }
    public double getTwoHopFraudDensity()       { return twoHopFraudDensity; }
    public double getConnectivityScore()        { return connectivityScore; }
    public String getFraudClusterId()           { return fraudClusterId; }
    public int    getTotalEdges()               { return totalEdges; }
}