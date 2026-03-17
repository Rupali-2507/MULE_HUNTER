package com.mulehunter.backend.scheduler;

import java.time.Instant;

import com.mulehunter.backend.service.ModelEvaluationService;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class ModelEvaluationScheduler {

    private final ModelEvaluationService evaluationService;

    public ModelEvaluationScheduler(ModelEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @Scheduled(cron = "0 0 2 * * ?")
    public void runEvaluation() {
        Instant end = Instant.now();
        Instant start = end.minusSeconds(7 * 24 * 3600);

        evaluationService.evaluateModels(start, end).subscribe();
}
}