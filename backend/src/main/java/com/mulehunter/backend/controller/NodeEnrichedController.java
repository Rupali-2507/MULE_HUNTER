package com.mulehunter.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.DTO.NodeEnrichedDTO;
import com.mulehunter.backend.model.NodeEnriched;
import com.mulehunter.backend.repository.NodeEnrichedRepository;

import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/backend/api/nodes")
public class NodeEnrichedController {

  private final NodeEnrichedRepository repository;

  public NodeEnrichedController(NodeEnrichedRepository repository) {
    this.repository = repository;
  }

  @GetMapping("/enriched")
  public Flux<NodeEnrichedDTO> getAllEnrichedNodes() {
    return repository.findAll()
        .map(this::toDTO);
  }

  private NodeEnrichedDTO toDTO(NodeEnriched node) {
    NodeEnrichedDTO dto = new NodeEnrichedDTO();
    dto.setNodeId(node.getNodeId());
    dto.setInDegree(node.getInDegree());
    dto.setOutDegree(node.getOutDegree());
    dto.setTotalIncoming(node.getTotalIncoming());
    dto.setTotalOutgoing(node.getTotalOutgoing());
    dto.setRiskRatio(node.getRiskRatio());
    dto.setTxVelocity(node.getTxVelocity());
    dto.setAccountAgeDays(node.getAccountAgeDays());
    dto.setBalance(node.getBalance());
    return dto;
  }
}
