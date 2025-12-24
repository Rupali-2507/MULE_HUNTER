package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;

import com.mulehunter.backend.model.NodeEnriched;
import com.mulehunter.backend.repository.NodeEnrichedRepository;

import reactor.core.publisher.Mono;

@Service
public class NodeEnrichedService {

  private final NodeEnrichedRepository repository;

  public NodeEnrichedService(NodeEnrichedRepository repository) {
    this.repository = repository;
  }

  // Called when this node SENDS money
  public Mono<Void> handleOutgoing(Long nodeId, double amount) {
    return repository.findByNodeId(nodeId)
        .defaultIfEmpty(createEmptyNode(nodeId))
        .flatMap(node -> {
          node.setOutDegree(node.getOutDegree() + 1);
          node.setTotalOutgoing(node.getTotalOutgoing() + amount);
          node.setBalance(node.getBalance() - amount);
          updateRiskRatio(node);
          return repository.save(node);
        })
        .then();
  }

  // Called when this node RECEIVES money
  public Mono<Void> handleIncoming(Long nodeId, double amount) {
    return repository.findByNodeId(nodeId)
        .defaultIfEmpty(createEmptyNode(nodeId))
        .flatMap(node -> {
          node.setInDegree(node.getInDegree() + 1);
          node.setTotalIncoming(node.getTotalIncoming() + amount);
          node.setBalance(node.getBalance() + amount);
          updateRiskRatio(node);
          return repository.save(node);
        })
        .then();
  }

  // ------------------ helpers ------------------

  private NodeEnriched createEmptyNode(Long nodeId) {
    NodeEnriched node = new NodeEnriched();
    node.setNodeId(nodeId);
    node.setInDegree(0);
    node.setOutDegree(0);
    node.setTotalIncoming(0.0);
    node.setTotalOutgoing(0.0);
    node.setBalance(0.0);
    node.setRiskRatio(0.0);
    node.setTxVelocity(1.0);
    node.setAccountAgeDays(0);
    return node;
  }

  private void updateRiskRatio(NodeEnriched node) {
    double incoming = node.getTotalIncoming() + 1;
    double outgoing = node.getTotalOutgoing() + 1;
    node.setRiskRatio(outgoing / incoming);
  }
}
