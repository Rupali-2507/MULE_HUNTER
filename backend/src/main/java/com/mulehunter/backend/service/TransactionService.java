package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.BehaviorFeaturesDTO;
import com.mulehunter.backend.DTO.GraphFeaturesDTO;
import com.mulehunter.backend.model.AiRiskResult;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final NodeEnrichedService nodeEnrichedService;
    private final VisualAnalyticsService visualAnalyticsService;
    private final Ja3SecurityService ja3SecurityService;
    private final AiRiskService aiRiskService;
    private final TransactionValidationService validationService;
    private final IdentityCollectorService identityCollectorService;
    private final BehaviorFeatureService behaviorFeatureService;
    private final GraphFeatureService graphFeatureService;
    private final AggregateUpdateService aggregateUpdateService;

    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService,
            VisualAnalyticsService visualAnalyticsService,
            Ja3SecurityService ja3SecurityService,
            AiRiskService aiRiskService,
            TransactionValidationService validationService,
            IdentityCollectorService identityCollectorService,
            BehaviorFeatureService behaviorFeatureService,
            GraphFeatureService graphFeatureService,
            AggregateUpdateService aggregateUpdateService
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        this.visualAnalyticsService = visualAnalyticsService;
        this.ja3SecurityService = ja3SecurityService;
        this.aiRiskService = aiRiskService;
        this.validationService = validationService;
        this.identityCollectorService = identityCollectorService;
        this.behaviorFeatureService = behaviorFeatureService;
        this.graphFeatureService = graphFeatureService;
        this.aggregateUpdateService = aggregateUpdateService;
    }

    public Mono<Transaction> createTransaction(TransactionRequest request, String ja3) {

        return validationService.validate(request)
                .then(Mono.defer(() -> {

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
                    String sourceAcc = tx.getSourceAccount();
                    String targetAcc = tx.getTargetAccount();

                    return repository.save(tx)

                            // Step 3 — Identity forensics
                            .flatMap(savedTx ->
                                    identityCollectorService.collect(
                                            savedTx, ja3,
                                            "device-" + savedTx.getSourceAccount(),
                                            "127.0.0.1"
                                    )
                            )

                            // Step 4 — Update aggregates + visual + node enrichment (parallel)
                            .flatMap(savedTx ->
                                    Mono.when(
                                            aggregateUpdateService.update(
                                                    sourceAcc, targetAcc, amount,
                                                    savedTx.getTransactionId(),
                                                    ja3,
                                                    "device-" + sourceAcc,
                                                    "127.0.0.1"
                                            ),
                                            nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                            nodeEnrichedService.handleIncoming(targetNodeId, amount),
                                            visualAnalyticsService.triggerVisualMlPipeline(savedTx)
                                    ).thenReturn(savedTx)
                            )

                            // Steps 5+6 — Behavioral + Graph features (parallel)
                            .flatMap(savedTx ->
                                    Mono.zip(
                                            behaviorFeatureService.compute(sourceAcc, amount),
                                            graphFeatureService.compute(sourceAcc)
                                    ).flatMap(features -> {

                                        BehaviorFeaturesDTO behavior = features.getT1();
                                        GraphFeaturesDTO graph = features.getT2();

                                        System.out.printf("📦 ML PAYLOAD: account=%s velocity=%.1f burst=%.1f suspiciousNeighbors=%d%n",
                                                sourceAcc,
                                                behavior.getTransactionVelocityScore(),
                                                behavior.getBurstScore(),
                                                graph.getSuspiciousNeighborCount());

                                        // Step 7 — AI + JA3 in parallel
                                        return Mono.zip(
                                                aiRiskService.analyzeTransaction(sourceNodeId, targetNodeId, amount)
                                                        .defaultIfEmpty(new AiRiskResult()),
                                                ja3SecurityService.callJa3Risk(savedTx, ja3)
                                                        .defaultIfEmpty(Map.of()),
                                                aiRiskService.scoreEif(
                                                        behavior.getTotalIn24h(),
                                                        behavior.getTotalOut24h(),
                                                        behavior.getTransactionVelocityScore(),
                                                        behavior.getBurstScore(),
                                                        behavior.getUniqueCounterparties7d(),
                                                        behavior.getAvgAmountDeviation()
                                                )
                                        ).map(results -> {
                                        AiRiskResult aiResult = results.getT1();
                                        Map ja3Result = results.getT2();
                                        Map<String, Object> eifResult = results.getT3();
                                        double eifScore = eifResult.get("score") instanceof Number n ? n.doubleValue() : 0.0;
                                        String eifExplanation = (String) eifResult.getOrDefault("explanation", "");
                                        savedTx.setUnsupervisedScore(eifScore);
                                        savedTx.setEifExplanation(eifExplanation);
                                        savedTx.setEifTopFactors((Map<String, Double>) eifResult.getOrDefault("topFactors", Map.of()));

                                            // Store AI results
                                            savedTx.setRiskScore(aiResult.getGnnScore());
                                            savedTx.setVerdict(aiResult.getVerdict());
                                            savedTx.setSuspectedFraud(aiResult.isSuspectedFraud());
                                            savedTx.setUnsupervisedModelName(aiResult.getModelVersion());
                                            // EIF score set from real EIF service above
                                            savedTx.setLinkedAccounts(aiResult.getLinkedAccounts());
                                            savedTx.setOutDegree(aiResult.getOutDegree());
                                            savedTx.setRiskRatio(aiResult.getRiskRatio());

                                            // Store NEW rich GNN fields on transaction
                                            savedTx.setGnnScore(aiResult.getGnnScore());
                                            savedTx.setGnnConfidence(aiResult.getConfidence());
                                            savedTx.setRiskLevel(aiResult.getRiskLevel());
                                            savedTx.setSuspiciousNeighbors(aiResult.getSuspiciousNeighbors());
                                            savedTx.setSharedDevices(aiResult.getSharedDevices());
                                            savedTx.setSharedIPs(aiResult.getSharedIPs());
                                            savedTx.setClusterId(aiResult.getClusterId());
                                            savedTx.setClusterSize(aiResult.getClusterSize());
                                            savedTx.setMuleRingMember(aiResult.isMuleRingMember());
                                            savedTx.setRingShape(aiResult.getRingShape());
                                            savedTx.setRingSize(aiResult.getRingSize());
                                            savedTx.setRole(aiResult.getRole());
                                            savedTx.setHubAccount(aiResult.getHubAccount());
                                            savedTx.setRingAccounts(aiResult.getRingAccounts());
                                            savedTx.setRiskFactors(aiResult.getRiskFactors());
                                            savedTx.setEmbeddingNorm(aiResult.getEmbeddingNorm());

                                            // Store JA3 results
                                            Object riskObj     = ja3Result.get("ja3Risk");
                                            Object velocityObj = ja3Result.get("velocity");
                                            Object fanoutObj   = ja3Result.get("fanout");
                                            if (riskObj instanceof Number n) {
                                                savedTx.setJa3Risk(n.doubleValue());
                                                savedTx.setJa3Detected(n.doubleValue() > 0.7);
                                            }
                                            if (velocityObj instanceof Number n) savedTx.setJa3Velocity(n.intValue());
                                            if (fanoutObj   instanceof Number n) savedTx.setJa3Fanout(n.intValue());

                                            // Combine all signals
                                            combineRiskSignals(savedTx, behavior, graph, aiResult);

                                            return savedTx;
                                        });
                                    })
                            )

                            .flatMap(repository::save);
                }));
    }

    private void combineRiskSignals(Transaction tx,
                                    BehaviorFeaturesDTO behavior,
                                    GraphFeaturesDTO graph,
                                    AiRiskResult aiResult) {

        double gnnScore = tx.getGnnScore() == null ? 0.0 : tx.getGnnScore();
        double eifScore = tx.getUnsupervisedScore() == null ? 0.0 : tx.getUnsupervisedScore();
        double ja3Score = tx.getJa3Risk() == null ? 0.0 : tx.getJa3Risk();

        double velocity = behavior.getTransactionVelocityScore();
        double burst    = behavior.getBurstScore();
        double behaviorScore = Math.min(
                velocity * 0.3 + burst * 0.5 + behavior.getAvgAmountDeviation() * 0.2,
                1.0);

        double graphScore = Math.min(
                graph.getConnectivityScore() * 0.6 + graph.getTwoHopFraudDensity() * 0.4,
                1.0);

        // JA3 combined signal
        int ja3Velocity = tx.getJa3Velocity() == null ? 0 : tx.getJa3Velocity();
        int ja3Fanout   = tx.getJa3Fanout()   == null ? 0 : tx.getJa3Fanout();
        double ja3VBoost = ja3Velocity > 50 ? 0.2 : ja3Velocity > 20 ? 0.1 : 0.0;
        double ja3FBoost = ja3Fanout   > 20 ? 0.2 : ja3Fanout   > 10 ? 0.1 : 0.0;
        double ja3Combined = Math.min(ja3Score + ja3VBoost + ja3FBoost, 1.0);

        // Mule ring boost — if GNN detects ring membership, increase risk
        double ringBoost = aiResult.isMuleRingMember() ? 0.15 : 0.0;

        double raw = 0.35 * gnnScore
                   + 0.10 * eifScore
                   + 0.25 * behaviorScore
                   + 0.15 * graphScore
                   + 0.10 * ja3Combined
                   + ringBoost;

        double finalRisk = Math.round(Math.min(raw, 1.0) * 10_000.0) / 10_000.0;

        System.out.printf("🔢 RISK COMBINE: gnn=%.4f eif=%.4f behavior=%.2f graph=%.2f ja3=%.2f ring=%b → FINAL=%.4f%n",
                gnnScore, eifScore, behaviorScore, graphScore, ja3Combined,
                aiResult.isMuleRingMember(), finalRisk);

        tx.setRiskScore(finalRisk);
        tx.setGnnScore(gnnScore);
        tx.setBehaviorScore(behaviorScore);
        tx.setGraphScore(graphScore);
        tx.setVelocityScore(velocity);
        tx.setBurstScore(burst);
        tx.setSuspectedFraud(finalRisk >= 0.45);

        // Decision
        String decision;
        if (finalRisk >= 0.75)      decision = "BLOCK";
        else if (finalRisk >= 0.45) decision = "REVIEW";
        else                         decision = "APPROVE";
        tx.setDecision(decision);

        System.out.printf("🛡️  DECISION = %s | score=%.4f%n", decision, finalRisk);
    }
}