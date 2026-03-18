package com.mulehunter.backend.repository;

import com.mulehunter.backend.model.ModelPerformanceMetrics;

import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;



import reactor.core.publisher.Mono;

public interface ModelMetricsRepository extends ReactiveMongoRepository<ModelPerformanceMetrics, String> {

    /**
     * Returns the most recently saved evaluation result.
     * Used by StatsService to show current detection accuracy on the dashboard.
     */
    Mono<ModelPerformanceMetrics> findTopByOrderByEvaluatedAtDesc();
}