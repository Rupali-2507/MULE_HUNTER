package com.mulehunter.backend.DTO;

public class NodeEnrichedDTO {

  private Long nodeId;
  private Integer inDegree;
  private Integer outDegree;
  private Double totalIncoming;
  private Double totalOutgoing;
  private Double riskRatio;
  private Double txVelocity;
  private Integer accountAgeDays;
  private Double balance;

  // -------- GETTERS --------

  public Long getNodeId() {
    return nodeId;
  }

  public Integer getInDegree() {
    return inDegree;
  }

  public Integer getOutDegree() {
    return outDegree;
  }

  public Double getTotalIncoming() {
    return totalIncoming;
  }

  public Double getTotalOutgoing() {
    return totalOutgoing;
  }

  public Double getRiskRatio() {
    return riskRatio;
  }

  public Double getTxVelocity() {
    return txVelocity;
  }

  public Integer getAccountAgeDays() {
    return accountAgeDays;
  }

  public Double getBalance() {
    return balance;
  }

  // -------- SETTERS --------

  public void setNodeId(Long nodeId) {
    this.nodeId = nodeId;
  }

  public void setInDegree(Integer inDegree) {
    this.inDegree = inDegree;
  }

  public void setOutDegree(Integer outDegree) {
    this.outDegree = outDegree;
  }

  public void setTotalIncoming(Double totalIncoming) {
    this.totalIncoming = totalIncoming;
  }

  public void setTotalOutgoing(Double totalOutgoing) {
    this.totalOutgoing = totalOutgoing;
  }

  public void setRiskRatio(Double riskRatio) {
    this.riskRatio = riskRatio;
  }

  public void setTxVelocity(Double txVelocity) {
    this.txVelocity = txVelocity;
  }

  public void setAccountAgeDays(Integer accountAgeDays) {
    this.accountAgeDays = accountAgeDays;
  }

  public void setBalance(Double balance) {
    this.balance = balance;
  }
}
