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

    @Value("${visual.internal-api-key}")
    private String visualInternalApiKey;

    //  DYNAMIC CONFIGURATION (Works for Docker AND Local)
    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService,
            
            // Inject URL from environment/properties. Default to localhost for teammates.
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl,
            @Value("${visual.service.url:http://localhost:8000}") String visualServiceUrl
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        
        System.out.println("🔌 CONNECTING AI TO: " + aiServiceUrl);
        System.out.println("🔌 CONNECTING VISUALS TO: " + visualServiceUrl);

        // 1. Client for AI
        this.aiWebClient = WebClient.builder()
                .baseUrl(aiServiceUrl) 
                .build();

        // 2. Client for Visuals
        this.visualWebClient = WebClient.builder()
                .baseUrl(visualServiceUrl) 
                .build();
    }

    public Mono<Transaction> createTransaction(TransactionRequest request) {
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
                // PARALLEL EXECUTION
                .flatMap(savedTx ->
                        Mono.when(
                                nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                nodeEnrichedService.handleIncoming(targetNodeId, amount),
                                triggerVisualMlPipeline(savedTx) 
                        ).thenReturn(savedTx)
                )
                // AI CALL
                .flatMap(savedTx ->
                        callAiModel(sourceNodeId, targetNodeId, amount)
                                .flatMap(aiResponse -> applyAiVerdict(savedTx, aiResponse))
                                .defaultIfEmpty(savedTx)
                );
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
                .onErrorResume(e -> {
                    System.err.println("❌ AI FAILED: " + e.getMessage());
                    return Mono.empty();
                });
    }

    /* ------------------------- MAP RESULTS ------------------------- */
    private Mono<Transaction> applyAiVerdict(Transaction tx, JsonNode aiResponse) {
        if (aiResponse == null || !aiResponse.has("risk_score")) return Mono.just(tx);

        double riskScore = aiResponse.get("risk_score").asDouble();
        String verdict = aiResponse.get("verdict").asText();

        tx.setRiskScore(riskScore);
        tx.setVerdict(verdict);
        tx.setSuspectedFraud(riskScore > 0.5);

        tx.setOutDegree(aiResponse.path("out_degree").asInt(0));
        tx.setRiskRatio(aiResponse.path("risk_ratio").asDouble(0.0));
        tx.setPopulationSize(aiResponse.path("population_size").asText("Unknown"));
        tx.setJa3Detected(aiResponse.path("ja3_detected").asBoolean(false));
        tx.setUnsupervisedModelName(aiResponse.path("model_version").asText("GraphSAGE"));
        tx.setUnsupervisedScore(aiResponse.path("unsupervised_score").asDouble(riskScore));

        List<String> accounts = new ArrayList<>();
        if (aiResponse.has("linked_accounts") && aiResponse.get("linked_accounts").isArray()) {
            aiResponse.get("linked_accounts").forEach(node -> accounts.add(node.asText()));
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
                .onErrorResume(e -> {
                    System.err.println("⚠️ Visual Trigger Warning: " + e.getMessage());
                    return Mono.empty();
                });
    }
}