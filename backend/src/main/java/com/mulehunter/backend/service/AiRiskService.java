package com.mulehunter.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mulehunter.backend.model.AiRiskResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Map;

@Service
public class AiRiskService {

    private final WebClient aiWebClient;

    public AiRiskService(
            @Value("${ai.service.url:http://56.228.10.113:8001}") String aiServiceUrl
    ) {
        System.out.println("🔌 CONNECTING AI TO: " + aiServiceUrl);
        this.aiWebClient = WebClient.builder()
                .baseUrl(aiServiceUrl)
                .build();
    }

    public Mono<AiRiskResult> analyzeTransaction(Long source, Long target, double amount) {
        // Build payload that exactly matches GnnScoreRequest in inference_service.py:
        //   accountId: str
        //   graphFeatures: { suspiciousNeighborCount: int, twoHopFraudDensity: float, connectivityScore: float }
        Map<String, Object> graphFeatures = Map.of(
                "suspiciousNeighborCount", 0,      // int — NOT 0.0 (Pydantic is strict)
                "twoHopFraudDensity",      0.0,
                "connectivityScore",       0.0
        );

        Map<String, Object> payload = Map.of(
                "accountId",     String.valueOf(source),
                "graphFeatures", graphFeatures
        );

        return aiWebClient.post()
                .uri("/v1/gnn/score")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .timeout(Duration.ofSeconds(5))
                .map(this::mapGnnResponse)
                .onErrorResume(e -> {
                    System.err.println("⚠️ AI SERVICE skipped: " + e.getMessage());
                    return Mono.just(new AiRiskResult());
                });
    }

    private AiRiskResult mapGnnResponse(JsonNode res) {
        if (res == null || !res.has("gnnScore")) {
            return new AiRiskResult();
        }

        double gnnScore = res.get("gnnScore").asDouble();

        AiRiskResult result = new AiRiskResult();
        result.setRiskScore(gnnScore);
        result.setSuspectedFraud(gnnScore > 0.5);
        result.setVerdict(res.path("version").asText("GNN-v2"));
        result.setModelVersion(res.path("version").asText("GNN-v2"));
        result.setUnsupervisedScore(res.path("confidence").asDouble(0.0));
        result.setLinkedAccounts(new ArrayList<>());

        System.out.println("🤖 GNN: score=" + String.format("%.4f", gnnScore)
                + "  confidence=" + String.format("%.4f", res.path("confidence").asDouble())
                + "  cluster=" + res.path("fraudClusterId").asInt());

        return result;
    }
}