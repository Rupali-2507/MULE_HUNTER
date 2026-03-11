package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.GraphFeaturesDTO;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * Step 6 — Graph Context Feature Computation (Reactive MongoDB)
 *
 * Queries existing newtransactions collection to compute:
 * - suspiciousNeighborCount (direct neighbours with high risk)
 * - twoHopFraudDensity (fraction of 2-hop accounts that are fraud)
 * - connectivityScore (ratio suspicious/total neighbours)
 *
 * Uses your existing TransactionRepository.
 */
@Service
public class GraphFeatureService {

    private final TransactionRepository transactionRepository;

    public GraphFeatureService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    public Mono<GraphFeaturesDTO> compute(String accountId) {

        // Count total unique counterparties (all edges)
        Mono<Long> totalEdgesMono = transactionRepository
                .countBySourceAccountOrTargetAccount(accountId, accountId)
                .defaultIfEmpty(0L);

        // Count suspicious direct neighbours (suspectedFraud = true)
        Mono<Long> suspiciousMono = transactionRepository
                .countSuspiciousNeighbours(accountId)
                .defaultIfEmpty(0L);

        return Mono.zip(totalEdgesMono, suspiciousMono)
                .map(tuple -> {
                    long total      = tuple.getT1();
                    long suspicious = tuple.getT2();

                    double connectivityScore = total == 0 ? 0.0
                            : Math.min((double) suspicious / total, 1.0);

                    // Two-hop fraud density approximated as connectivity^2
                    // (full two-hop requires graph traversal — approximation until GNN is wired)
                    double twoHopFraudDensity = round(connectivityScore * connectivityScore);

                    return new GraphFeaturesDTO(
                            (int) suspicious,
                            round(twoHopFraudDensity),
                            round(connectivityScore),
                            null,           // fraudClusterId — set by GNN later
                            (int) total
                    );
                });
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}