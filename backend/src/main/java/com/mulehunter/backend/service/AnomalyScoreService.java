package com.mulehunter.backend.service;

import java.time.Instant;
import java.util.List;

import org.springframework.stereotype.Service;

import com.mulehunter.backend.DTO.AnomalyScoreDTO;
import com.mulehunter.backend.model.AnomalyScore;
import com.mulehunter.backend.repository.AnomalyScoreRepository;

import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Service
public class AnomalyScoreService {

  private final AnomalyScoreRepository repository;

  public AnomalyScoreService(AnomalyScoreRepository repository) {
    this.repository = repository;
  }

  public Mono<Void> saveBatch(List<AnomalyScoreDTO> batch) {

    return Flux.fromIterable(batch)
        .flatMap(dto -> {

          AnomalyScore score = new AnomalyScore();
          score.setNodeId(dto.getNode_id());
          score.setAnomalyScore(dto.getAnomaly_score());
          score.setIsAnomalous(dto.getIs_anomalous());
          score.setModel(dto.getModel());
          score.setSource(dto.getSource());
          score.setUpdatedAt(Instant.now());

          return repository.save(score);
        })
        .then();
  }
}
