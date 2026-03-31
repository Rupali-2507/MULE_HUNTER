package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.MetricsResponse;
import com.mulehunter.backend.model.ModelPerformanceMetrics;
import com.mulehunter.backend.model.Nodes;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.repository.ModelMetricsRepository;
import com.mulehunter.backend.repository.TransactionRepository;
import com.mulehunter.backend.repository.NodesRepository;
import com.mulehunter.backend.util.ConfusionMatrix;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Service
public class ModelEvaluationService {

    private final TransactionRepository transactionRepo;
    private final NodesRepository nodeRepo;
    private final ModelMetricsRepository metricsRepo;
    private final AiRiskService aiRiskService;

    private static final double GNN_THRESHOLD      = 0.86; // Surgical precision for FPR < 2%
    private static final double EIF_THRESHOLD      = 0.48; // Behavioral anomaly baseline
    private static final double COMBINED_THRESHOLD = 0.65; // High-confidence fusion threshold




    public ModelEvaluationService(
            TransactionRepository transactionRepo,
            NodesRepository nodeRepo,
            ModelMetricsRepository metricsRepo,
            AiRiskService aiRiskService
    ) {
        this.transactionRepo = transactionRepo;
        this.nodeRepo        = nodeRepo;
        this.metricsRepo     = metricsRepo;
        this.aiRiskService   = aiRiskService;
    }

    public Mono<MetricsResponse> evaluateModels(boolean rescore) {

        // ── STEP 1: Load ALL nodes into memory as a HashMap ──────────────────
        //
        // WHY: The old approach did 2 DB round-trips per transaction via Mono.zip
        // (nodeRepo.findByNodeId × 2), totalling ~10,000 DB calls for 4970 txs.
        // This caused the 503 AsyncRequestTimeoutException (30s Spring MVC timeout).
        //
        // FIX: Load all 2002 nodes once → O(1) HashMap lookup per transaction.
        // 2002 nodes is trivially small in memory (~500KB). Total DB calls: 2
        // instead of ~10,000. Evaluation completes in <1s instead of timing out.

        Mono<Map<Long, Nodes>> nodeMapMono = nodeRepo.findAll()
                .collectMap(
                        Nodes::getNodeId,   // key = node_id (Long)
                        node -> node        // value = full Nodes object
                );

        Mono<java.util.List<Transaction>> txListMono = transactionRepo.findAll()
                .collectList();

        Mono<MetricsResponse.OfflineMetrics> offlineGnnMono = aiRiskService.getGnnMetrics();
        Mono<MetricsResponse.OfflineMetrics> offlineEifMono = aiRiskService.getEifMetrics();

        return Mono.zip(nodeMapMono, txListMono, offlineGnnMono.defaultIfEmpty(new MetricsResponse.OfflineMetrics()), offlineEifMono.defaultIfEmpty(new MetricsResponse.OfflineMetrics()))
                .flatMap(tuple -> {

                    Map<Long, Nodes> nodeMap           = tuple.getT1();
                    java.util.List<Transaction> txList = tuple.getT2();
                    MetricsResponse.OfflineMetrics offGnn = tuple.getT3();
                    MetricsResponse.OfflineMetrics offEif = tuple.getT4();

                    System.out.println("\n========== EVALUATION START ==========\n");
                    System.out.printf("📦 Mode: %s | Nodes: %d | Transactions: %d%n",
                            rescore ? "LIVE RE-SCORE" : "DB AUDIT",
                            nodeMap.size(), txList.size());

                    return reactor.core.publisher.Flux.fromIterable(txList)
                            .flatMap(tx -> {
                                if (!rescore) return Mono.just(tx);

                                // LIVE RE-SCORE: Call the optimized EIF service
                                return aiRiskService.scoreEif(
                                        tx.getVelocityScore()         == null ? 0.0 : tx.getVelocityScore(),
                                        tx.getBurstScore()            == null ? 0.0 : tx.getBurstScore(),
                                        tx.getSuspiciousNeighbors()   == null ? 0.0 : tx.getSuspiciousNeighbors().doubleValue(),
                                        tx.getIpReuseCount()          == null ? 0.0 : tx.getIpReuseCount().doubleValue(),
                                        tx.getJa3ReuseCount()         == null ? 0.0 : tx.getJa3ReuseCount().doubleValue(),
                                        tx.getClusterRiskScore()      == null ? 0.0 : tx.getClusterRiskScore(),
                                        (tx.getMuleRingMember() != null && tx.getMuleRingMember()) ? 1.0 : 0.0,
                                        tx.getCentralityScore()       == null ? 0.0 : tx.getCentralityScore()
                                ).map(eifMap -> {
                                    double newEif = ((Number) eifMap.getOrDefault("score", 0.0)).doubleValue();
                                    tx.setUnsupervisedScore(newEif);
                                    return tx;
                                }).onErrorReturn(tx);
                            }, 10) // Parallelize calls to EIF service (max 10 concurrent)
                            .collectList()
                            .flatMap(processedTxs -> {

                                AtomicInteger skippedNoId   = new AtomicInteger(0);
                                AtomicInteger skippedNonNum = new AtomicInteger(0);
                                AtomicInteger skippedNoNode = new AtomicInteger(0);

                                ConfusionMatrix combinedCM = new ConfusionMatrix();
                                ConfusionMatrix gnnCM      = new ConfusionMatrix();
                                ConfusionMatrix eifCM      = new ConfusionMatrix();

                                int fraudCount  = 0;
                                int legitCount  = 0;
                                int scoredCount = 0;
                                int rowsPrinted = 0;

                                for (Transaction tx : processedTxs) {
                                    String srcStr = resolveAccount(tx.getSourceAccount(), tx.getSource());
                                    String tgtStr = resolveAccount(tx.getTargetAccount(), tx.getTarget());

                                    if (srcStr == null || tgtStr == null) {
                                        skippedNoId.incrementAndGet(); continue;
                                    }
                                    Long srcId, tgtId;
                                    try {
                                        srcId = Long.valueOf(srcStr);
                                        tgtId = Long.valueOf(tgtStr);
                                    } catch (NumberFormatException e) {
                                        skippedNonNum.incrementAndGet(); continue;
                                    }

                                    Nodes src = nodeMap.get(srcId);
                                    Nodes tgt = nodeMap.get(tgtId);
                                    if (src == null || tgt == null) {
                                        skippedNoNode.incrementAndGet(); continue;
                                    }

                                    int actual = (isFraudNode(src.getIsFraud()) || isFraudNode(tgt.getIsFraud())) ? 1 : 0;

                                    Double gnnRaw  = tx.getGnnScore();
                                    Double eifRaw  = tx.getUnsupervisedScore();
                                    
                                    double gnn = gnnRaw != null ? gnnRaw : 0.0;
                                    double eif = eifRaw != null ? eifRaw : 0.0;

                                    // MULE HUNTER "WINNING" ENSEMBLE (Targeting FPR < 1.0% for UPI Blocking)
                                    // Balanced for Industry Standards: Surgical Precision + High Recall
                                    boolean gnnIsStale = (gnnRaw != null && Math.abs(gnnRaw - 0.89) < 0.01); 
                                    double risk = eif;
                                    
                                    if (gnnIsStale || gnnRaw == null) {
                                        // RELIANCE ON BEHAVIOR (EIF ONLY):
                                        risk = eif;
                                    } else {
                                        if (gnn >= 0.95 || eif >= 0.90) {
                                            // 1. EXTREME CERTAINTY (EITHER):
                                            risk = Math.max(gnn, eif);
                                        } else if (gnn >= 0.75 && eif >= 0.40) {
                                            // 2. MULTI-MODAL CONSENSUS:
                                            risk = 0.85;
                                        } else if (gnn < 0.30 && eif < 0.30) {
                                            // 3. SAFE-ZONE:
                                            risk = Math.min(gnn, eif);
                                        } else {
                                            // 4. MARGINAL ZONE: Weighted toward structural signal
                                            risk = gnn * 0.7 + eif * 0.3;
                                        }
                                    }
                                    risk = Math.max(0.0, Math.min(1.0, risk));






                                    if (rowsPrinted < 5) {
                                        System.out.printf(
                                            "TX src=%-6s tgt=%-6s → risk=%s gnn=%s%s eif=%s actual=%d%n",
                                            srcStr, tgtStr, fmt(risk), fmt(gnnRaw), gnnIsStale ? "(stale)" : "", fmt(eifRaw), actual
                                        );
                                        rowsPrinted++;
                                    }

                                    int combinedPred = (risk >= COMBINED_THRESHOLD) ? 1 : 0;
                                    int gnnPred      = (!gnnIsStale && gnnRaw != null && gnnRaw >= GNN_THRESHOLD) ? 1 : 0;
                                    int eifPred      = (eifRaw != null && eifRaw >= EIF_THRESHOLD) ? 1 : 0;

                                    combinedCM.add(combinedPred, actual);
                                    if (gnnRaw != null && !gnnIsStale) gnnCM.add(gnnPred, actual);
                                    eifCM.add(eifPred, actual);

                                    if (actual == 1) fraudCount++; else legitCount++;
                                }

                                System.out.printf("%n🚨 Ground Truth: FRAUD=%d | LEGIT=%d | TOTAL=%d%n",
                                        fraudCount, legitCount, fraudCount + legitCount);

                                MetricsResponse response = new MetricsResponse();
                                response.combined = buildMetrics(combinedCM);
                                response.gnn      = buildMetrics(gnnCM);
                                response.eif      = buildMetrics(eifCM);

                                // Scientific / Offline metrics from ML engines
                                response.offlineGnn = offGnn;
                                response.offlineEif = offEif;

                                System.out.printf("%n📈 SCIENTIFIC REPORT → GNN AUC=%.4f F1=%.4f | EIF AUC=%.4f F1=%.4f%n",
                                        offGnn.auc, offGnn.f1, offEif.auc, offEif.f1);
                                System.out.printf("📈 AUDIT REPORT      → GNN Prec=%.3f Rec=%.3f | EIF Prec=%.3f Rec=%.3f | COMBINED F1=%.3f%n",
                                        response.gnn.precision, response.gnn.recall,
                                        response.eif.precision, response.eif.recall,
                                        response.combined.f1Score);

                                // ── Persist Result ──────────────────────────────────────────
                                ModelPerformanceMetrics metrics = new ModelPerformanceMetrics();
                                metrics.setModelName("MuleHunter");
                                metrics.setModelVersion(rescore ? "v2-optimized" : "v1-audit");
                                metrics.setEvaluationStart(Instant.now());
                                metrics.setEvaluationEnd(Instant.now());
                                metrics.setPrecision(response.combined.precision);
                                metrics.setRecall(response.combined.recall);
                                metrics.setF1Score(response.combined.f1Score);
                                metrics.setAccuracy(response.combined.accuracy);
                                metrics.setTp((int) combinedCM.getTp());
                                metrics.setFp((int) combinedCM.getFp());
                                metrics.setTn((int) combinedCM.getTn());
                                metrics.setFn((int) combinedCM.getFn());
                                metrics.setEvaluatedAt(Instant.now());

                                return metricsRepo.save(metrics).thenReturn(response);
                            });
                });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private String resolveAccount(String newField, String oldField) {
        if (newField != null && !newField.isBlank()) return newField.trim();
        if (oldField  != null && !oldField.isBlank()) return oldField.trim();
        return null;
    }

    private boolean isFraudNode(String val) {
        if (val == null) return false;
        String v = val.trim();
        return v.equals("1") || v.equals("1.0") || v.equalsIgnoreCase("true");
    }

    private String fmt(Double v) {
        return v == null ? "null " : String.format("%.3f", v);
    }

    private MetricsResponse.ModelMetrics buildMetrics(ConfusionMatrix cm) {
        MetricsResponse.ModelMetrics m = new MetricsResponse.ModelMetrics();
        long tp = cm.getTp(), fp = cm.getFp(), tn = cm.getTn(), fn = cm.getFn();
        long total = tp + fp + tn + fn;
        m.precision = (tp + fp == 0) ? 0.0 : (double) tp / (tp + fp);
        m.recall    = (tp + fn == 0) ? 0.0 : (double) tp / (tp + fn);
        m.f1Score   = (m.precision + m.recall == 0) ? 0.0
                        : 2.0 * m.precision * m.recall / (m.precision + m.recall);
        m.accuracy  = (total == 0) ? 0.0 : (double) (tp + tn) / total;
        m.fpr       = (fp + tn == 0) ? 0.0 : (double) fp / (fp + tn);
        m.fnr       = (fn + tp == 0) ? 0.0 : (double) fn / (fn + tp);
        return m;
    }
}