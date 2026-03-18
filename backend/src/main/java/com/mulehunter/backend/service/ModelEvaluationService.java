package com.mulehunter.backend.service;

import com.mulehunter.backend.model.FraudLabel;
import com.mulehunter.backend.model.ModelPerformanceMetrics;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.repository.FraudLabelRepository;
import com.mulehunter.backend.repository.ModelMetricsRepository;
import com.mulehunter.backend.repository.TransactionRepository;

import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Service
public class ModelEvaluationService {

    private final TransactionRepository transactionRepo;
    private final FraudLabelRepository labelRepo;
    private final ModelMetricsRepository metricsRepo;

    public ModelEvaluationService(
            TransactionRepository transactionRepo,
            FraudLabelRepository labelRepo,
            ModelMetricsRepository metricsRepo
    ) {
        this.transactionRepo = transactionRepo;
        this.labelRepo = labelRepo;
        this.metricsRepo = metricsRepo;
    }

    public Mono<Void> evaluateModels(Instant start, Instant end) {

        return transactionRepo.findByTimestampBetween(start, end)

                // join with fraud labels
                .flatMap(tx ->
                        labelRepo.findByTransactionId(tx.getTransactionId())
                                .map(label -> new EvaluationRow(tx, label))
                )

                .collectList()

                .flatMap(rows -> {

                    int tp = 0, fp = 0, tn = 0, fn = 0;

                    for (EvaluationRow r : rows) {

                        int predicted = (r.tx.getRiskScore() != null &&
                                         r.tx.getRiskScore() >= 0.45) ? 1 : 0;

                        int actual = r.label.getActualLabel();

                        if (predicted == 1 && actual == 1) tp++;
                        else if (predicted == 1 && actual == 0) fp++;
                        else if (predicted == 0 && actual == 0) tn++;
                        else fn++;
                    }

                    double precision = (tp + fp == 0) ? 0 : (double) tp / (tp + fp);
                    double recall    = (tp + fn == 0) ? 0 : (double) tp / (tp + fn);
                    double f1        = (precision + recall == 0) ? 0 :
                            2 * precision * recall / (precision + recall);
                    double accuracy  = (double) (tp + tn) / (tp + tn + fp + fn);

                    ModelPerformanceMetrics metrics = new ModelPerformanceMetrics();
                    metrics.setModelName("MuleHunter");
                    metrics.setModelVersion("v1");
                    metrics.setEvaluationStart(start);
                    metrics.setEvaluationEnd(end);
                    metrics.setPrecision(precision);
                    metrics.setRecall(recall);
                    metrics.setF1Score(f1);
                    metrics.setAccuracy(accuracy);
                    metrics.setTp(tp);
                    metrics.setFp(fp);
                    metrics.setTn(tn);
                    metrics.setFn(fn);
                    metrics.setEvaluatedAt(Instant.now());

                    return metricsRepo.save(metrics).then();
                });
    }

    // helper class
    static class EvaluationRow {
        Transaction tx;
        FraudLabel label;

        EvaluationRow(Transaction tx, FraudLabel label) {
            this.tx = tx;
            this.label = label;
        }
    }
}