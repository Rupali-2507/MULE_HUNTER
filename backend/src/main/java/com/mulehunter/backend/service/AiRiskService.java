package com.mulehunter.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mulehunter.backend.model.AiRiskResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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

        Map<String, Object> payload = Map.of(
                "source_id", source,
                "target_id", target,
                "amount", amount,
                "timestamp", Instant.now().toString()
        );

        return aiWebClient.post()
                .uri("/analyze-transaction")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(this::mapAiResponse)
                .onErrorResume(e -> Mono.empty());
    }

    private AiRiskResult mapAiResponse(JsonNode aiResponse) {

        if (aiResponse == null || !aiResponse.has("risk_score")) {
            return null;
        }

        double riskScore = aiResponse.get("risk_score").asDouble();

        AiRiskResult result = new AiRiskResult();

        result.setRiskScore(riskScore);
        result.setVerdict(aiResponse.path("verdict").asText());
        result.setSuspectedFraud(riskScore > 0.5);

        result.setOutDegree(aiResponse.path("out_degree").asInt(0));
        result.setRiskRatio(aiResponse.path("risk_ratio").asDouble(0.0));
        result.setPopulationSize(aiResponse.path("population_size").asText("Unknown"));
        result.setModelVersion(aiResponse.path("model_version").asText("GraphSAGE"));
        result.setUnsupervisedScore(aiResponse.path("unsupervised_score").asDouble(riskScore));

        List<String> accounts = new ArrayList<>();

        if (aiResponse.has("linked_accounts")) {
            aiResponse.get("linked_accounts").forEach(n -> accounts.add(n.asText()));
        }

        result.setLinkedAccounts(accounts);

        return result;
    }
}