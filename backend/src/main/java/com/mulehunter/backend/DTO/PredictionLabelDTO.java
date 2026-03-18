package com.mulehunter.backend.DTO;

public class PredictionLabelDTO {

    private String modelName;
    private String modelVersion;
    private int predictedLabel;
    private double predictedScore;
    private int actualLabel;

    public PredictionLabelDTO(
        String modelName,
        String modelVersion,
        int predictedLabel,
        double predictedScore,
        int actualLabel
    ){
        this.modelName = modelName;
        this.modelVersion = modelVersion;
        this.predictedLabel = predictedLabel;
        this.predictedScore = predictedScore;
        this.actualLabel = actualLabel;
    }

    public String getModelName(){ return modelName; }
    public String getModelVersion(){ return modelVersion; }
    public int getPredictedLabel(){ return predictedLabel; }
    public double getPredictedScore(){ return predictedScore; }
    public int getActualLabel(){ return actualLabel; }
}