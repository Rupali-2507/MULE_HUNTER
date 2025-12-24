package com.mulehunter.backend.controller;

import java.util.List;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.DTO.AnomalyScoreDTO;
import com.mulehunter.backend.service.AnomalyScoreService;

import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/backend/api/visual")
public class VisualAnalyticsController {

  private final AnomalyScoreService anomalyScoreService;

  public VisualAnalyticsController(AnomalyScoreService anomalyScoreService) {
    this.anomalyScoreService = anomalyScoreService;
  }

  @PostMapping("/anomaly-scores/batch")
  public Mono<String> saveAnomalyScores(
      @RequestBody List<AnomalyScoreDTO> payload) {

    return anomalyScoreService.saveBatch(payload)
        .thenReturn("Anomaly scores stored successfully");
  }
}
