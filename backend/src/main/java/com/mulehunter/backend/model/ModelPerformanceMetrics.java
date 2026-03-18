package com.mulehunter.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "model_performance_metrics")
public class ModelPerformanceMetrics {

    @Id
    private String id;

    private String modelName;
    private String modelVersion;

    private Instant evaluationStart;
    private Instant evaluationEnd;

    private double precision;
    private double recall;
    private double f1Score;
    private double accuracy;

    private int tp;
    private int fp;
    private int tn;
    private int fn;

    private Instant evaluatedAt;

    // ── Constructors ─────────────────────────────────────────────

    public ModelPerformanceMetrics() {}

    public ModelPerformanceMetrics(String modelName, String modelVersion,
                                   Instant evaluationStart, Instant evaluationEnd,
                                   double precision, double recall, double f1Score, double accuracy,
                                   int tp, int fp, int tn, int fn, Instant evaluatedAt) {
        this.modelName = modelName;
        this.modelVersion = modelVersion;
        this.evaluationStart = evaluationStart;
        this.evaluationEnd = evaluationEnd;
        this.precision = precision;
        this.recall = recall;
        this.f1Score = f1Score;
        this.accuracy = accuracy;
        this.tp = tp;
        this.fp = fp;
        this.tn = tn;
        this.fn = fn;
        this.evaluatedAt = evaluatedAt;
    }

    // ── Getters / Setters ───────────────────────────────────────

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
    }

    public Instant getEvaluationStart() {
        return evaluationStart;
    }

    public void setEvaluationStart(Instant evaluationStart) {
        this.evaluationStart = evaluationStart;
    }

    public Instant getEvaluationEnd() {
        return evaluationEnd;
    }

    public void setEvaluationEnd(Instant evaluationEnd) {
        this.evaluationEnd = evaluationEnd;
    }

    public double getPrecision() {
        return precision;
    }

    public void setPrecision(double precision) {
        this.precision = precision;
    }

    public double getRecall() {
        return recall;
    }

    public void setRecall(double recall) {
        this.recall = recall;
    }

    public double getF1Score() {
        return f1Score;
    }

    public void setF1Score(double f1Score) {
        this.f1Score = f1Score;
    }

    public double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(double accuracy) {
        this.accuracy = accuracy;
    }

    public int getTp() {
        return tp;
    }

    public void setTp(int tp) {
        this.tp = tp;
    }

    public int getFp() {
        return fp;
    }

    public void setFp(int fp) {
        this.fp = fp;
    }

    public int getTn() {
        return tn;
    }

    public void setTn(int tn) {
        this.tn = tn;
    }

    public int getFn() {
        return fn;
    }

    public void setFn(int fn) {
        this.fn = fn;
    }

    public Instant getEvaluatedAt() {
        return evaluatedAt;
    }

    public void setEvaluatedAt(Instant evaluatedAt) {
        this.evaluatedAt = evaluatedAt;
    }
}