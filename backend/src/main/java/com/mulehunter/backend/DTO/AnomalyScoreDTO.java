package com.mulehunter.backend.DTO;

public class AnomalyScoreDTO {

  private Long node_id;
  private Double anomaly_score;
  private Integer is_anomalous;
  private String model;
  private String source;

  // -------- getters --------

  public Long getNode_id() {
    return node_id;
  }

  public Double getAnomaly_score() {
    return anomaly_score;
  }

  public Integer getIs_anomalous() {
    return is_anomalous;
  }

  public String getModel() {
    return model;
  }

  public String getSource() {
    return source;
  }

  // -------- setters --------

  public void setNode_id(Long node_id) {
    this.node_id = node_id;
  }

  public void setAnomaly_score(Double anomaly_score) {
    this.anomaly_score = anomaly_score;
  }

  public void setIs_anomalous(Integer is_anomalous) {
    this.is_anomalous = is_anomalous;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public void setSource(String source) {
    this.source = source;
  }
}
