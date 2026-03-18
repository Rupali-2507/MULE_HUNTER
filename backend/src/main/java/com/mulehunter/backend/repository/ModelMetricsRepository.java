package com.mulehunter.backend.repository;

import com.mulehunter.backend.model.ModelPerformanceMetrics;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

public interface ModelMetricsRepository 
        extends ReactiveCrudRepository<ModelPerformanceMetrics, String> {
}