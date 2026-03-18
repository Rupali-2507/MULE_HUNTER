package com.mulehunter.backend.controller;

import com.mulehunter.backend.DTO.MetricsResponse;
import com.mulehunter.backend.DTO.StatsResponse;
import com.mulehunter.backend.service.ModelEvaluationService;
import com.mulehunter.backend.service.StatsService;

import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/admin")
public class AdminEvaluationController {

    private final ModelEvaluationService evaluationService;
    private final StatsService statsService;

    public AdminEvaluationController(
            ModelEvaluationService evaluationService,
            StatsService statsService
    ) {
        this.evaluationService = evaluationService;
        this.statsService      = statsService;
    }

    /**
     * GET /api/admin/evaluate-models
     * Evaluates GNN + EIF + Combined model performance against node ground truth.
     */
    @GetMapping("/evaluate-models")
    public Mono<MetricsResponse> evaluateModels() {
        return evaluationService.evaluateModels();
    }

    /**
     * GET /api/admin/stats
     * Returns all KPIs for the Network Performance dashboard:
     *   - Throughput TPS
     *   - Avg Detection Latency
     *   - Mule Accounts Blocked
     *   - System Scalability
     *   - Detection Accuracy + FPR
     *   - Enforcement Distribution (%)
     *   - Value Intercepted (₹ Crores)
     *   - Live Events feed
     */
    @GetMapping("/stats")
    public Mono<StatsResponse> getStats() {
        return statsService.getStats();
    }
}