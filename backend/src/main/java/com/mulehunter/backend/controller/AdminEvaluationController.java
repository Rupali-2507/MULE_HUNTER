package com.mulehunter.backend.controller;

import com.mulehunter.backend.service.ModelEvaluationService;
import org.springframework.web.bind.annotation.*;

import reactor.core.publisher.Mono;

import java.time.Instant;

@RestController
@RequestMapping("/api/admin")
public class AdminEvaluationController {

    private final ModelEvaluationService evaluationService;

    public AdminEvaluationController(ModelEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @PostMapping("/evaluate-models")
    public Mono<String> evaluateModels() {

        Instant end = Instant.now();
        Instant start = end.minusSeconds(7 * 24 * 3600);

        return evaluationService.evaluateModels(start, end)
                .thenReturn("Model evaluation completed");
    }
}