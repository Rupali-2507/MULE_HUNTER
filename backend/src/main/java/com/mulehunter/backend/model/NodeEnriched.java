package com.mulehunter.backend.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "nodes_enriched")
public class NodeEnriched {

  @Id
  private String id;

  private Long nodeId;
  private Integer inDegree;
  private Integer outDegree;
  private Double totalIncoming;
  private Double totalOutgoing;
  private Double riskRatio;
  private Double txVelocity;
  private Integer accountAgeDays;
  private Double balance;

  // ---------- GETTERS & SETTERS ----------

  public Long getNodeId() {
    return nodeId;
  }

  public void setNodeId(Long nodeId) {
    this.nodeId = nodeId;
  }

  public Integer getInDegree() {
    return inDegree;
  }

  public void setInDegree(Integer inDegree) {
    this.inDegree = inDegree;
  }

  public Integer getOutDegree() {
    return outDegree;
  }

  public void setOutDegree(Integer outDegree) {
    this.outDegree = outDegree;
  }

  public Double getTotalIncoming() {
    return totalIncoming;
  }

  public void setTotalIncoming(Double totalIncoming) {
    this.totalIncoming = totalIncoming;
  }

  public Double getTotalOutgoing() {
    return totalOutgoing;
  }

  public void setTotalOutgoing(Double totalOutgoing) {
    this.totalOutgoing = totalOutgoing;
  }

  public Double getRiskRatio() {
    return riskRatio;
  }

  public void setRiskRatio(Double riskRatio) {
    this.riskRatio = riskRatio;
  }

  public Double getTxVelocity() {
    return txVelocity;
  }

  public void setTxVelocity(Double txVelocity) {
    this.txVelocity = txVelocity;
  }

  public Integer getAccountAgeDays() {
    return accountAgeDays;
  }

  public void setAccountAgeDays(Integer accountAgeDays) {
    this.accountAgeDays = accountAgeDays;
  }

  public Double getBalance() {
    return balance;
  }

  public void setBalance(Double balance) {
    this.balance = balance;
  }
}
