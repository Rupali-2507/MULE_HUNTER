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

        Map<String, Object> graphFeatures = Map.of(
        "suspiciousNeighborCount", 0,
        "twoHopFraudDensity", 0.0,
        "connectivityScore", 0.0
        );
        Map<String, Object> payload = Map.of(
                "accountId", String.valueOf(source),
                "graphFeatures", graphFeatures
        );

        return aiWebClient.post()
        .uri("/v1/gnn/score")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(this::mapAiResponse)
                .onErrorResume(e -> {
                    System.err.println("❌ AI SERVICE ERROR: " + e.getMessage());
                    return Mono.empty();
                });
    }

    private AiRiskResult mapAiResponse(JsonNode r) {
        if (r == null) return new AiRiskResult();

        AiRiskResult result = new AiRiskResult();

        // ── Core risk score ───────────────────────────────────────
        // New GNN response uses scores.gnnScore, old uses risk_score
        double gnnScore = 0.0;
        if (r.has("scores") && r.get("scores").has("gnnScore")) {
            gnnScore = r.get("scores").get("gnnScore").asDouble();
        } else if (r.has("gnnScore")) {
            gnnScore = r.get("gnnScore").asDouble();
        } else if (r.has("risk_score")) {
            gnnScore = r.get("risk_score").asDouble();
        }
        result.setGnnScore(gnnScore);
        result.setRiskScore(gnnScore);
        result.setSuspectedFraud(gnnScore > 0.5);

        // ── Scores block ──────────────────────────────────────────
        if (r.has("scores")) {
            JsonNode scores = r.get("scores");
            result.setConfidence(scores.path("confidence").asDouble(0.0));
            result.setRiskLevel(scores.path("riskLevel").asText("UNKNOWN"));
        } else {
            result.setConfidence(r.path("confidence").asDouble(0.0));
        }

        // ── Model info ────────────────────────────────────────────
        result.setModelVersion(r.path("version").asText(
                r.path("model_version").asText("GNN")));
        result.setVerdict(r.path("verdict").asText(""));

        // ── Network metrics ───────────────────────────────────────
        if (r.has("networkMetrics")) {
            JsonNode nm = r.get("networkMetrics");
            result.setSuspiciousNeighbors(nm.path("suspiciousNeighbors").asInt(0));
            result.setSharedDevices(nm.path("sharedDevices").asInt(0));
            result.setSharedIPs(nm.path("sharedIPs").asInt(0));
            result.setCentralityScore(nm.path("centralityScore").asDouble(0.0));
            result.setTransactionLoops(nm.path("transactionLoops").asBoolean(false));
        }

        // ── Fraud cluster ─────────────────────────────────────────
        if (r.has("fraudCluster")) {
            JsonNode fc = r.get("fraudCluster");
            result.setClusterId(fc.path("clusterId").asInt(0));
            result.setClusterSize(fc.path("clusterSize").asInt(0));
            result.setClusterRiskScore(fc.path("clusterRiskScore").asDouble(0.0));
        } else {
            result.setClusterId(r.path("fraudClusterId").asInt(0));
        }

        // ── Mule ring detection ───────────────────────────────────
        if (r.has("muleRingDetection")) {
            JsonNode mrd = r.get("muleRingDetection");
            result.setMuleRingMember(mrd.path("isMuleRingMember").asBoolean(false));
            result.setRingId(mrd.path("ringId").asInt(0));
            result.setRingShape(mrd.path("ringShape").asText("UNKNOWN"));
            result.setRingSize(mrd.path("ringSize").asInt(0));
            result.setRole(mrd.path("role").asText("UNKNOWN"));
            result.setHubAccount(mrd.path("hubAccount").asText(""));

            List<String> ringAccounts = new ArrayList<>();
            if (mrd.has("ringAccounts")) {
                mrd.get("ringAccounts").forEach(n -> ringAccounts.add(n.asText()));
            }
            result.setRingAccounts(ringAccounts);
        }

        // ── Risk factors ──────────────────────────────────────────
        List<String> riskFactors = new ArrayList<>();
        if (r.has("riskFactors")) {
            r.get("riskFactors").forEach(n -> riskFactors.add(n.asText()));
        }
        result.setRiskFactors(riskFactors);

        // ── Embedding ─────────────────────────────────────────────
        if (r.has("embedding")) {
            result.setEmbeddingNorm(r.get("embedding").path("embeddingNorm").asDouble(0.0));
        } else {
            result.setEmbeddingNorm(r.path("embeddingNorm").asDouble(0.0));
        }

        // ── Old fields (backward compat) ──────────────────────────
        result.setOutDegree(r.path("out_degree").asInt(0));
        result.setRiskRatio(r.path("risk_ratio").asDouble(0.0));
        result.setPopulationSize(r.path("population_size").asText("Unknown"));
        result.setUnsupervisedScore(r.path("unsupervised_score").asDouble(gnnScore));

        List<String> linked = new ArrayList<>();
        if (r.has("linked_accounts")) {
            r.get("linked_accounts").forEach(n -> linked.add(n.asText()));
        }
        result.setLinkedAccounts(linked);

        System.out.printf("🤖 AI RESULT → gnn=%.4f conf=%.4f riskLevel=%s muleRing=%b suspNeighbors=%d riskFactors=%d%n",
                gnnScore,
                result.getConfidence(),
                result.getRiskLevel(),
                result.isMuleRingMember(),
                result.getSuspiciousNeighbors(),
                riskFactors.size());

        return result;
    }
}