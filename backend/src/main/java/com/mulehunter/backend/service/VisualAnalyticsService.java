package com.mulehunter.backend.service;

import com.mulehunter.backend.model.Transaction;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class VisualAnalyticsService {

    private final WebClient visualWebClient;

    @Value("${visual.internal-api-key}")
    private String visualInternalApiKey;

    public VisualAnalyticsService(
            @Value("${visual.service.url:http://13.61.143.100:8000}") String visualServiceUrl
    ) {

        System.out.println("🔌 CONNECTING VISUALS TO: " + visualServiceUrl);

        this.visualWebClient = WebClient.builder()
                .baseUrl(visualServiceUrl)
                .build();
    }

    public Mono<Void> triggerVisualMlPipeline(Transaction tx) {

        Map<String, Object> payload = Map.of(
                "trigger", "TRANSACTION_EVENT",
                "transactionId", tx.getId(),
                "nodes", List.of(
                        Map.of("nodeId", Long.parseLong(tx.getSourceAccount()), "role", "SOURCE"),
                        Map.of("nodeId", Long.parseLong(tx.getTargetAccount()), "role", "TARGET")
                )
        );

        return visualWebClient.post()
                .uri("/visual-analytics/api/visual/reanalyze/nodes")
                .header("X-INTERNAL-API-KEY", visualInternalApiKey)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Void.class)
                .timeout(java.time.Duration.ofSeconds(3))
                .onErrorResume(e -> {
                System.err.println("⚠️ VISUAL SERVICE skipped: " + e.getMessage());
                return Mono.empty();
                });
                }
                }