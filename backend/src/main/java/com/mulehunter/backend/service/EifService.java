package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.EifResponse;
import com.mulehunter.backend.DTO.MetricsResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * EIF scoring service — sole owner of the HTTP call to the EIF Python endpoint.
 * AiRiskService delegates to this class; it does NOT make EIF calls itself.
 *
 * Returns Map<String, Object> with keys: score, confidence, explanation, topFactors
 * — the exact shape TransactionService.createTransaction() expects.
 */
@Service
public class EifService {

    private final WebClient webClient;

    public EifService(
            @Value("${eif.service.url:http://localhost:8000}") String eifServiceUrl
    ) {
        System.out.println("🔬 EIF SERVICE URL: " + eifServiceUrl);
        this.webClient = WebClient.builder()
                .baseUrl(eifServiceUrl)
                .build();
    }

    /**
     * Calls /v1/eif/score with the 6-feature vector and returns a
     * Map<String, Object> containing score, confidence, explanation, topFactors.
     *
     * Feature order MUST match train_eif.py RAW_FEATURES exactly:
     * [velocity_score, burst_score, suspicious_neighbor_count,
     *  ja3_reuse_count, device_reuse_count, ip_reuse_count]
     */
    public Mono<Map<String, Object>> score(List<Double> features) {

        Map<String, Object> body = Map.of("features", features);

        return webClient.post()
                .uri("/v1/eif/score")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(EifResponse.class)
                .map(r -> {
                    Map<String, Object> result = new LinkedHashMap<>();
                    result.put("score",       r.getScore());
                    result.put("confidence",  r.getConfidence());
                    result.put("explanation", r.getExplanation() != null ? r.getExplanation() : "");
                    result.put("topFactors",  r.getTopFactors()  != null ? r.getTopFactors()  : Map.of());
                    System.out.printf("🔬 EIF RESULT → score=%.4f | %s%n",
                            r.getScore(), r.getExplanation());
                    return result;
                })
                .timeout(java.time.Duration.ofSeconds(5))
                .onErrorResume(e -> {
                    System.err.println("⚠️ EIF skipped: " + e.getMessage());
                    return Mono.just(Map.of(
                            "score",       0.0,
                            "confidence",  0.0,
                            "explanation", "",
                            "topFactors",  Map.of()
                    ));
                });
    }

    public Mono<MetricsResponse.OfflineMetrics> getMetrics() {
        return webClient.get()
                .uri("/v1/eif/metrics")
                .retrieve()
                .bodyToMono(MetricsResponse.OfflineMetrics.class)
                .timeout(java.time.Duration.ofSeconds(5))
                .onErrorResume(e -> {
                    System.err.println("⚠️ EIF metrics skipped: " + e.getMessage());
                    return Mono.empty();
                });
    }
}