package com.mulehunter.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mulehunter.backend.DTO.MetricsResponse;
import com.mulehunter.backend.model.AiRiskResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;



@Service
public class AiRiskService {

    private final WebClient aiWebClient;
    private final EifService eifService;

    public AiRiskService(
            @Value("${ai.service.url:http://56.228.10.113:8001}") String aiServiceUrl,
            EifService eifService
    ) {
        System.out.println("🔌 CONNECTING AI TO: " + aiServiceUrl);
        this.aiWebClient = WebClient.builder().baseUrl(aiServiceUrl).build();
        this.eifService  = eifService;
    }

    public Mono<AiRiskResult> analyzeTransaction(
            Long source, Long target, double amount,
            int suspiciousNeighborCount,
            double twoHopFraudDensity,
            double connectivityScore) {

        // ── FIX: Use "sourceAccountId" (required by FastAPI GnnScoreRequest schema)
        //         Old code used "accountId" which is not in the schema → 422 error
        //         Also pass targetAccountId and transactionAmount for better scoring
        Map<String, Object> graphFeatures = Map.of(
                "suspiciousNeighborCount", suspiciousNeighborCount,
                "twoHopFraudDensity",      twoHopFraudDensity,
                "connectivityScore",        connectivityScore
        );
        Map<String, Object> payload = Map.of(
                "sourceAccountId",   String.valueOf(source),
                "targetAccountId",   String.valueOf(target),
                "transactionAmount", amount,
                "graphFeatures",     graphFeatures
        );

        System.out.printf("🤖 AI REQUEST → sourceAccountId=%s targetAccountId=%s amount=%.2f%n",
                source, target, amount);

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
        // Response shape from /v1/gnn/score (inference_service.py v3.1):
        //   { gnnScore, confidence, scores: { gnnScore, confidence, riskLevel }, ... }
        //
        // FIX: was only checking nested path; now checks flat mirrors first
        // because GnnScoreResponse exposes both flat mirrors AND nested blocks.
        double gnnScore = 0.0;
        if (r.has("gnnScore") && !r.get("gnnScore").isNull()) {
            // Flat mirror field (top-level) — most reliable
            gnnScore = r.get("gnnScore").asDouble();
        } else if (r.has("scores") && r.get("scores").has("gnnScore")) {
            gnnScore = r.get("scores").get("gnnScore").asDouble();
        } else if (r.has("risk_score")) {
            gnnScore = r.get("risk_score").asDouble();
        }
        result.setGnnScore(gnnScore);
        result.setRiskScore(gnnScore);
        result.setSuspectedFraud(gnnScore > 0.5);

        // ── Confidence ────────────────────────────────────────────
        // FIX: "confidence" is inside the "scores" block in the response,
        //      but also exposed as a flat top-level mirror field.
        //      Old code: r.path("confidence") which misses it when it's nested.
        double confidence = 0.0;
        if (r.has("confidence") && !r.get("confidence").isNull()) {
            // Flat mirror
            confidence = r.get("confidence").asDouble();
        } else if (r.has("scores") && r.get("scores").has("confidence")) {
            confidence = r.get("scores").get("confidence").asDouble();
        }
        result.setConfidence(confidence);

        // ── Risk level ────────────────────────────────────────────
        // FIX: riskLevel lives inside scores{} block; old code only partially handled it
        String riskLevel = "UNKNOWN";
        if (r.has("scores") && r.get("scores").has("riskLevel")) {
            riskLevel = r.get("scores").get("riskLevel").asText("UNKNOWN");
        } else if (r.has("riskLevel") && !r.get("riskLevel").isNull()) {
            riskLevel = r.get("riskLevel").asText("UNKNOWN");
        }
        result.setRiskLevel(riskLevel);

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
            // flat mirror
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
        // flat mirror: embeddingNorm
        double embNorm = 0.0;
        if (r.has("embeddingNorm") && !r.get("embeddingNorm").isNull()) {
            embNorm = r.get("embeddingNorm").asDouble(0.0);
        } else if (r.has("embedding")) {
            embNorm = r.get("embedding").path("embeddingNorm").asDouble(0.0);
        }
        result.setEmbeddingNorm(embNorm);

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

        System.out.printf(
            "🤖 AI RESULT → gnn=%.4f conf=%.4f riskLevel=%s muleRing=%b suspNeighbors=%d riskFactors=%d%n",
            gnnScore,
            confidence,
            riskLevel,
            result.isMuleRingMember(),
            result.getSuspiciousNeighbors(),
            riskFactors.size());

        return result;
    }

    /**
     * Delegates EIF scoring to EifService — the sole owner of the EIF HTTP call.
     */
    public Mono<Map<String, Object>> scoreEif(
            double velocityScore,
            double burstScore,
            double suspiciousNeighborCount,
            double ipReuseCount,
            double ja3ReuseCount,
            double communityFraudRate,
            double ringMembership,
            double networkRiskScore) {

        return eifService.score(java.util.List.of(
                velocityScore,
                burstScore,
                suspiciousNeighborCount,
                ipReuseCount,
                ja3ReuseCount,
                communityFraudRate,
                ringMembership,
                networkRiskScore
        ));
    }

    public Mono<MetricsResponse.OfflineMetrics> getGnnMetrics() {
        return aiWebClient.get()
                .uri("/metrics")
                .retrieve()
                .bodyToMono(JsonNode.class)
                .map(this::mapGnnMetrics)
                .timeout(java.time.Duration.ofSeconds(5))
                .onErrorResume(e -> {
                    System.err.println("⚠️ GNN metrics skipped: " + e.getMessage());
                    return Mono.empty();
                });
    }

    public Mono<MetricsResponse.OfflineMetrics> getEifMetrics() {
        return eifService.getMetrics();
    }

    private MetricsResponse.OfflineMetrics mapGnnMetrics(JsonNode r) {
        MetricsResponse.OfflineMetrics m = new MetricsResponse.OfflineMetrics();
        if (r.has("test")) {
            JsonNode test = r.get("test");
            m.accuracy  = test.path("accuracy").asDouble(0.0);
            m.precision = test.path("precision").asDouble(0.0);
            m.recall    = test.path("recall").asDouble(0.0);
            m.f1        = test.path("f1").asDouble(0.0);
            m.auc       = test.path("auc_roc").asDouble(0.0);
            m.threshold = test.path("threshold_used").asDouble(0.5);
        }
        return m;
    }
}