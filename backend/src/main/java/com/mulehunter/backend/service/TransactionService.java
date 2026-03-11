package com.mulehunter.backend.service;

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

    public TransactionService(
            TransactionRepository repository,
            NodeEnrichedService nodeEnrichedService,
            VisualAnalyticsService visualAnalyticsService,
            Ja3SecurityService ja3SecurityService,
            AiRiskService aiRiskService,
            TransactionValidationService validationService
    ) {
        this.repository = repository;
        this.nodeEnrichedService = nodeEnrichedService;
        this.visualAnalyticsService = visualAnalyticsService;
        this.ja3SecurityService = ja3SecurityService;
        this.aiRiskService = aiRiskService;
        this.validationService = validationService;
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

                    return repository.save(tx)

                            .flatMap(savedTx ->
                                    Mono.when(
                                            nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                            nodeEnrichedService.handleIncoming(targetNodeId, amount),
                                            visualAnalyticsService.triggerVisualMlPipeline(savedTx)
                                    ).thenReturn(savedTx)
                            )

                            .flatMap(savedTx ->
                                    aiRiskService.analyzeTransaction(sourceNodeId, targetNodeId, amount)
                                            .doOnNext(result -> {

                                                savedTx.setRiskScore(result.getRiskScore());
                                                savedTx.setVerdict(result.getVerdict());
                                                savedTx.setSuspectedFraud(result.isSuspectedFraud());

                                                savedTx.setOutDegree(result.getOutDegree());
                                                savedTx.setRiskRatio(result.getRiskRatio());
                                                savedTx.setPopulationSize(result.getPopulationSize());
                                                savedTx.setUnsupervisedModelName(result.getModelVersion());
                                                savedTx.setUnsupervisedScore(result.getUnsupervisedScore());
                                                savedTx.setLinkedAccounts(result.getLinkedAccounts());

                                            })
                                            .thenReturn(savedTx)
                            )

                            .flatMap(savedTx ->
                                    ja3SecurityService.callJa3Risk(savedTx, ja3)
                                            .doOnNext(ja3Result -> {

                                                Object riskObj = ja3Result.get("ja3Risk");
                                                Object velocityObj = ja3Result.get("velocity");
                                                Object fanoutObj = ja3Result.get("fanout");

                                                if (riskObj instanceof Number) {
                                                    double risk = ((Number) riskObj).doubleValue();
                                                    savedTx.setJa3Risk(risk);
                                                    savedTx.setJa3Detected(risk > 0.7);
                                                }

                                                if (velocityObj instanceof Number) {
                                                    savedTx.setJa3Velocity(((Number) velocityObj).intValue());
                                                }

                                                if (fanoutObj instanceof Number) {
                                                    savedTx.setJa3Fanout(((Number) fanoutObj).intValue());
                                                }

                                            })
                                            .thenReturn(savedTx)
                            )

                            .flatMap(finalTx -> {
                                combineRiskSignals(finalTx);
                                return repository.save(finalTx);
                            });

                }));
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