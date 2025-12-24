package com.mulehunter.backend.model;

import java.time.Instant;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "anomaly_scores")
public class AnomalyScore {

  @Id
  private String id;

  @Indexed(unique = true)
  private Long nodeId;

  private Double anomalyScore;
  private Integer isAnomalous;
  private String model;
  private String source;
  private Instant updatedAt = Instant.now();

  // -------- getters --------

  public String getId() {
    return id;
  }

  public Long getNodeId() {
    return nodeId;
  }

  public Double getAnomalyScore() {
    return anomalyScore;
  }

  public Integer getIsAnomalous() {
    return isAnomalous;
  }

  public String getModel() {
    return model;
  }

  public String getSource() {
    return source;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  // -------- setters --------

  public void setId(String id) {
    this.id = id;
  }

  public void setNodeId(Long nodeId) {
    this.nodeId = nodeId;
  }

  public void setAnomalyScore(Double anomalyScore) {
    this.anomalyScore = anomalyScore;
  }

  public void setIsAnomalous(Integer isAnomalous) {
    this.isAnomalous = isAnomalous;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public void setSource(String source) {
    this.source = source;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}
