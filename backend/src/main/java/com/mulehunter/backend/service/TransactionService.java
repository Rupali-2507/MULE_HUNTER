package com.mulehunter.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final NodeEnrichedService nodeEnrichedService;

    private final WebClient aiWebClient;
    private final WebClient visualWebClient;
    private final WebClient securityWebClient;

   


    @Value("${visual.internal-api-key}")
    private String visualInternalApiKey;

    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService,

            @Value("${ai.service.url:http://56.228.10.113:8001}") String aiServiceUrl,
            @Value("${visual.service.url:http://13.61.143.100:8000}") String visualServiceUrl,
            @Value("${security.service.url:http://mule-hunter-security-env.eba-twt3gcts.us-east-1.elasticbeanstalk.com}") String securityServiceUrl
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;

        System.out.println("🔌 CONNECTING AI TO: " + aiServiceUrl);
        System.out.println("🔌 CONNECTING VISUALS TO: " + visualServiceUrl);
        System.out.println("🔐 CONNECTING SECURITY TO: " + securityServiceUrl);

        this.aiWebClient = WebClient.builder()
                .baseUrl(aiServiceUrl)
                .build();

        this.visualWebClient = WebClient.builder()
                .baseUrl(visualServiceUrl)
                .build();

        this.securityWebClient = WebClient.builder()
                .baseUrl(securityServiceUrl)
                .build();
    }

    public Mono<Transaction> createTransaction(
            TransactionRequest request,
            String ja3
    ) {
        Transaction tx = Transaction.from(request);

        Long sourceNodeId;
        Long targetNodeId;
        try {
            sourceNodeId = Long.parseLong(tx.getSourceAccount());
            targetNodeId = Long.parseLong(tx.getTargetAccount());
        } catch (Exception e) {
            return Mono.error(new IllegalArgumentException("Invalid node IDs", e));
        }

        double amount = tx.getAmount().doubleValue();

        return repository.save(tx)
                .flatMap(savedTx ->
                        Mono.when(
                                nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                nodeEnrichedService.handleIncoming(targetNodeId, amount),
                                triggerVisualMlPipeline(savedTx)
                        ).thenReturn(savedTx)
                )
                .flatMap(savedTx ->
                        callAiModel(sourceNodeId, targetNodeId, amount)
                                .flatMap(aiResponse -> applyAiVerdict(savedTx, aiResponse))
                                .defaultIfEmpty(savedTx)
                )
                .flatMap(savedTx ->
                        callJa3Risk(savedTx, ja3)
                                .doOnNext(ja3Result -> {
                                        Object riskObj = ja3Result.get("ja3Risk");
                                        Object velocityObj = ja3Result.get("velocity");
                                        Object fanoutObj = ja3Result.get("fanout");

                                        if (riskObj instanceof Number) {
                                                double risk = ((Number) riskObj).doubleValue();
                                                savedTx.setJa3Risk(risk);
                                                savedTx.setJa3Detected(risk > 0.7); // signal only
                                        }

                                        if (velocityObj instanceof Number) {
                                                savedTx.setJa3Velocity(((Number) velocityObj).intValue());
                                        }

                                        if (fanoutObj instanceof Number) {
                                                savedTx.setJa3Fanout(((Number) fanoutObj).intValue());
                                        }
                                })
                                .thenReturn(savedTx)
                                
                ).flatMap(finalTx -> {
    combineRiskSignals(finalTx);
    return repository.save(finalTx);
});

       }

    /* ------------------------- AI CALL ------------------------- */
    private Mono<JsonNode> callAiModel(Long source, Long target, double amount) {
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
                .onErrorResume(e -> Mono.empty());
    }

    /* ------------------------- MAP RESULTS ------------------------- */
    private Mono<Transaction> applyAiVerdict(Transaction tx, JsonNode aiResponse) {
        if (aiResponse == null || !aiResponse.has("risk_score")) {
            return Mono.just(tx);
        }

        double riskScore = aiResponse.get("risk_score").asDouble();

        tx.setRiskScore(riskScore);
        tx.setVerdict(aiResponse.path("verdict").asText());
        tx.setSuspectedFraud(riskScore > 0.5);

        tx.setOutDegree(aiResponse.path("out_degree").asInt(0));
        tx.setRiskRatio(aiResponse.path("risk_ratio").asDouble(0.0));
        tx.setPopulationSize(aiResponse.path("population_size").asText("Unknown"));
        tx.setUnsupervisedModelName(aiResponse.path("model_version").asText("GraphSAGE"));
        tx.setUnsupervisedScore(aiResponse.path("unsupervised_score").asDouble(riskScore));

        List<String> accounts = new ArrayList<>();
        if (aiResponse.has("linked_accounts")) {
            aiResponse.get("linked_accounts").forEach(n -> accounts.add(n.asText()));
        }
        tx.setLinkedAccounts(accounts);

        return repository.save(tx);
    }

    /* ------------------------- VISUALS CALL ------------------------- */
    private Mono<Void> triggerVisualMlPipeline(Transaction tx) {
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
                .onErrorResume(e -> Mono.empty());
    }

    /* ------------------------- JA3 CALL ------------------------- */
    private Mono<Map> callJa3Risk(Transaction tx, String ja3) {

        if (ja3 == null) return Mono.empty();
         System.out.println("➡️ CALLING JA3 SERVICE with JA3=" + ja3);

        Map<String, Object> payload = Map.of(
                "accountId", tx.getSourceAccount(),
                "txId", tx.getId()
        );

        return securityWebClient.post()
                .uri("/api/security/ja3-risk")
                .header("X-JA3-Fingerprint", ja3)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorResume(e -> {
                        System.err.println("❌ JA3 SERVICE CALL FAILED: " + e.getMessage());
                        return Mono.empty();
                });

    }

    private void combineRiskSignals(Transaction tx) {

    double wGnn = 0.40;
    double wEif = 0.25;
    double wBehavior = 0.20;
    double wSecurity = 0.15;

    double gnnScore = tx.getRiskScore();
    double eifScore = tx.getUnsupervisedScore();
    double ja3Score = tx.getJa3Risk() == null ? 0.0 : tx.getJa3Risk();

    double behaviorScore = 0.0;

    if (tx.getOutDegree() > 20) behaviorScore += 0.4;
    if (tx.getRiskRatio() > 0.9) behaviorScore += 0.3;
    if (tx.getLinkedAccounts() != null && tx.getLinkedAccounts().size() > 10)
        behaviorScore += 0.3;

    behaviorScore = Math.min(behaviorScore, 1.0);

    double finalRisk =
            (wGnn * gnnScore) +
            (wEif * eifScore) +
            (wBehavior * behaviorScore) +
            (wSecurity * ja3Score);

    tx.setRiskScore(finalRisk);
    tx.setSuspectedFraud(finalRisk > 0.6);
}

}
