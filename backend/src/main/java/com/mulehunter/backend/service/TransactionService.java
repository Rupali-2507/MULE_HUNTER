package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.BehaviorFeaturesDTO;
import com.mulehunter.backend.DTO.GraphFeaturesDTO;
import com.mulehunter.backend.model.AiRiskResult;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.LinkedHashMap;
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
        this.repository               = repository;
        this.nodeEnrichedService      = nodeEnrichedService;
        this.visualAnalyticsService   = visualAnalyticsService;
        this.ja3SecurityService       = ja3SecurityService;
        this.aiRiskService            = aiRiskService;
        this.validationService        = validationService;
        this.identityCollectorService = identityCollectorService;
        this.behaviorFeatureService   = behaviorFeatureService;
        this.graphFeatureService      = graphFeatureService;
        this.aggregateUpdateService   = aggregateUpdateService;
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
                        return Mono.error(new IllegalArgumentException(
                                "sourceAccount and targetAccount must be numeric node IDs. Got: "
                                + tx.getSourceAccount() + " / " + tx.getTargetAccount(), e));
                    }

                    double amount     = tx.getAmount().doubleValue();
                    String sourceAcc  = tx.getSourceAccount();
                    String targetAcc  = tx.getTargetAccount();

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
                                        GraphFeaturesDTO    graph    = features.getT2();

                                        System.out.printf(
                                                "📦 ML PAYLOAD: account=%s velocity=%.3f burst=%.3f suspiciousNeighbors=%d%n",
                                                sourceAcc,
                                                behavior.getTransactionVelocityScore(),
                                                behavior.getBurstScore(),
                                                graph.getSuspiciousNeighborCount());

                                        // Step 7 — AI (GNN) + JA3 in parallel
                                        return Mono.zip(
                                                aiRiskService.analyzeTransaction(
                                                        sourceNodeId, targetNodeId, amount,
                                                        graph.getSuspiciousNeighborCount(),
                                                        graph.getTwoHopFraudDensity(),
                                                        graph.getConnectivityScore(),
                                                        savedTx.getJa3ReuseCount() == null ? 0 : savedTx.getJa3ReuseCount(),
                                                        savedTx.getDeviceReuseCount() == null ? 0 : savedTx.getDeviceReuseCount(),
                                                        savedTx.getIpReuseCount() == null ? 0 : savedTx.getIpReuseCount(),
                                                        behavior.getTransactionVelocityScore(),
                                                        behavior.getBurstScore())
                                                        .defaultIfEmpty(new AiRiskResult()),

                                                ja3SecurityService.callJa3Risk(savedTx, ja3)
                                                        .defaultIfEmpty(Map.of())

                                        ).flatMap(results -> {

                                            AiRiskResult        ai     = results.getT1();
                                            Map<String, Object> ja3Map = results.getT2();

                                            // Step 8 — EIF requires AI features, execute sequentially
                                            return aiRiskService.scoreEif(
                                                    behavior.getTransactionVelocityScore(),
                                                    behavior.getBurstScore(),
                                                    (double) graph.getSuspiciousNeighborCount(),
                                                    savedTx.getIpReuseCount()  == null ? 0.0 : savedTx.getIpReuseCount().doubleValue(),
                                                    savedTx.getJa3ReuseCount() == null ? 0.0 : savedTx.getJa3ReuseCount().doubleValue(),
                                                    ai.getClusterRiskScore(),
                                                    ai.isMuleRingMember() ? 1.0 : 0.0,
                                                    ai.getCentralityScore()
                                            ).map(eifMap -> {

                                            // ── EIF scores ───────────────────────────────────
                                            double eifScore = toDouble(eifMap.get("score"));
                                            double eifConf  = toDouble(eifMap.get("confidence"));
                                            savedTx.setUnsupervisedScore(Math.min(1.0, Math.max(0.0, eifScore)));
                                            savedTx.setEifConfidence(eifConf);
                                            savedTx.setEifExplanation(
                                                    eifMap.getOrDefault("explanation", "") instanceof String s ? s : "");

                                            // FIX: safe cast — EIF topFactors values come from
                                            // Jackson as Double (JSON float) or Integer (JSON int 0).
                                            // We normalise to Map<String,Double> here instead of
                                            // blindly casting, which would cause ClassCastException
                                            // when a zero value is deserialised as Integer.
                                            Object rawFactors = eifMap.get("topFactors");
                                            Map<String, Double> eifTopFactors = new LinkedHashMap<>();
                                            if (rawFactors instanceof Map<?, ?> fm) {
                                                fm.forEach((k, v) -> {
                                                    if (k instanceof String ks && v instanceof Number nv) {
                                                        eifTopFactors.put(ks, nv.doubleValue());
                                                    }
                                                });
                                            }
                                            savedTx.setEifTopFactors(eifTopFactors);

                                            // ── GNN scores ───────────────────────────────────
                                            savedTx.setGnnScore(ai.getGnnScore());
                                            savedTx.setGnnConfidence(ai.getConfidence());
                                            savedTx.setRiskLevel(ai.getRiskLevel());
                                            savedTx.setVerdict(ai.getVerdict());
                                            savedTx.setSuspectedFraud(ai.isSuspectedFraud());

                                            savedTx.setSuspiciousNeighbors(ai.getSuspiciousNeighbors());
                                            savedTx.setSharedDevices(ai.getSharedDevices());
                                            savedTx.setSharedIPs(ai.getSharedIPs());

                                            savedTx.setClusterId(ai.getClusterId());
                                            savedTx.setClusterSize(ai.getClusterSize());

                                            savedTx.setMuleRingMember(ai.isMuleRingMember());
                                            savedTx.setRingShape(ai.getRingShape());
                                            savedTx.setRingSize(ai.getRingSize());
                                            savedTx.setRole(ai.getRole());
                                            savedTx.setHubAccount(ai.getHubAccount());
                                            savedTx.setRingAccounts(ai.getRingAccounts());

                                            savedTx.setRiskFactors(ai.getRiskFactors());
                                            savedTx.setEmbeddingNorm(ai.getEmbeddingNorm());

                                            // ── JA3 scores ───────────────────────────────────
                                            if (ja3Map.get("ja3Risk") instanceof Number n) {
                                                savedTx.setJa3Risk(n.doubleValue());
                                                savedTx.setJa3Detected(n.doubleValue() > 0.7);
                                            }
                                            if (ja3Map.get("velocity") instanceof Number n)
                                                savedTx.setJa3Velocity(n.intValue());
                                            if (ja3Map.get("fanout") instanceof Number n)
                                                savedTx.setJa3Fanout(n.intValue());

                                            // ── Risk fusion ───────────────────────────────────
                                            combineRiskSignals(savedTx, behavior, graph, ai);

                                            // ── Build nested response maps ────────────────────
                                            // These are stored on Transaction so the controller
                                            // can return them directly without re-assembling.
                                            Map<String, Object> scores = new LinkedHashMap<>();
                                            scores.put("gnn",            savedTx.getGnnScore());
                                            scores.put("eif",            savedTx.getUnsupervisedScore());
                                            scores.put("behavior",       savedTx.getBehaviorScore());
                                            scores.put("graph",          savedTx.getGraphScore());
                                            scores.put("ja3",            savedTx.getJa3Risk());
                                            scores.put("confidence",     savedTx.getGnnConfidence());
                                            scores.put("eifConfidence",  savedTx.getEifConfidence());
                                            scores.put("eifExplanation", savedTx.getEifExplanation());
                                            scores.put("eifTopFactors",  savedTx.getEifTopFactors());
                                            savedTx.setModelScores(scores);

                                            Map<String, Object> network = new LinkedHashMap<>();
                                            network.put("suspiciousNeighbors", savedTx.getSuspiciousNeighbors());
                                            network.put("sharedDevices",       savedTx.getSharedDevices());
                                            network.put("sharedIPs",           savedTx.getSharedIPs());
                                            network.put("centralityScore",     ai.getCentralityScore());
                                            network.put("transactionLoops",    ai.isTransactionLoops());
                                            savedTx.setNetworkMetrics(network);

                                            Map<String, Object> cluster = new LinkedHashMap<>();
                                            cluster.put("clusterId",        savedTx.getClusterId());
                                            cluster.put("clusterSize",      savedTx.getClusterSize());
                                            cluster.put("clusterRiskScore", ai.getClusterRiskScore());
                                            savedTx.setFraudCluster(cluster);

                                            Map<String, Object> ring = new LinkedHashMap<>();
                                            ring.put("isMuleRingMember", savedTx.getMuleRingMember());
                                            ring.put("ringShape",        savedTx.getRingShape());
                                            ring.put("ringSize",         savedTx.getRingSize());
                                            ring.put("role",             savedTx.getRole());
                                            ring.put("hubAccount",       savedTx.getHubAccount());
                                            ring.put("ringAccounts",     savedTx.getRingAccounts());
                                            savedTx.setMuleRingDetection(ring);

                                            Map<String, Object> ja3Sec = new LinkedHashMap<>();
                                            ja3Sec.put("ja3Risk",     savedTx.getJa3Risk());
                                            ja3Sec.put("ja3Detected", savedTx.getJa3Detected());
                                            ja3Sec.put("velocity",    savedTx.getJa3Velocity());
                                            ja3Sec.put("fanout",      savedTx.getJa3Fanout());
                                            ja3Sec.put("isNewDevice", savedTx.getIsNewDevice());
                                            ja3Sec.put("isNewJa3",    savedTx.getIsNewJa3());
                                            savedTx.setJa3Security(ja3Sec);

                                            return savedTx;
                                            });
                                        });
                                    })
                            )

                            .flatMap(repository::save);
                }));
    }

    // ── Risk fusion ───────────────────────────────────────────────────────────

    private void combineRiskSignals(Transaction tx,
                                    BehaviorFeaturesDTO behavior,
                                    GraphFeaturesDTO graph,
                                    AiRiskResult ai) {

        double gnn = tx.getGnnScore()          == null ? 0.0 : tx.getGnnScore();
        double eif = tx.getUnsupervisedScore()  == null ? 0.0 : tx.getUnsupervisedScore();
        double ja3 = tx.getJa3Risk()            == null ? 0.0 : tx.getJa3Risk();

        double behaviorScore = Math.min(
                behavior.getTransactionVelocityScore() * 0.3 +
                behavior.getBurstScore()               * 0.5 +
                behavior.getAvgAmountDeviation()       * 0.2,
                1.0);

        double graphScore = Math.min(
                graph.getConnectivityScore()    * 0.6 +
                graph.getTwoHopFraudDensity()   * 0.4,
                1.0);

        // Weighted fusion: GNN=40%, EIF=20%, Behavior=25%, Graph=10%, JA3=5%
        double finalRisk = Math.min(
                0.40 * gnn +
                0.20 * eif +
                0.25 * behaviorScore +
                0.10 * graphScore +
                0.05 * ja3,
                1.0);

        tx.setRiskScore(finalRisk);
        tx.setBehaviorScore(behaviorScore);
        tx.setGraphScore(graphScore);
        tx.setSuspectedFraud(finalRisk >= 0.45);

        tx.setDecision(
                finalRisk >= 0.75 ? "BLOCK"  :
                finalRisk >= 0.45 ? "REVIEW" :
                                    "APPROVE");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Safely converts any Number-compatible Object to double.
     * Handles Integer, Double, Long, Float without ClassCastException.
     */
    private static double toDouble(Object o) {
        if (o instanceof Number n) return n.doubleValue();
        return 0.0;
    }
}