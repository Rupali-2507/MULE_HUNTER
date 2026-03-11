package com.mulehunter.backend.service;

import com.mulehunter.backend.DTO.BehaviorFeaturesDTO;
import com.mulehunter.backend.model.AccountAggregate;
import com.mulehunter.backend.repository.AccountAggregateRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * Step 5 — Behavioral Feature Computation (Reactive)
 * Reads from AccountAggregate (populated in Step 4).
 * Returns a BehaviorFeaturesDTO ready for the ML payload.
 */
@Service
public class BehaviorFeatureService {

    private final AccountAggregateRepository aggregateRepo;

    private static final double HIGH_VELOCITY_THRESHOLD = 10.0;
    private static final double HIGH_BURST_THRESHOLD    = 3.0;

    public BehaviorFeatureService(AccountAggregateRepository aggregateRepo) {
        this.aggregateRepo = aggregateRepo;
    }

    public Mono<BehaviorFeaturesDTO> compute(String accountId, double currentAmount) {
        return aggregateRepo.findByAccountId(accountId)
                .defaultIfEmpty(AccountAggregate.newFor(accountId))
                .map(agg -> buildFeatures(agg, currentAmount));
    }

    private BehaviorFeaturesDTO buildFeatures(AccountAggregate agg, double currentAmount) {

        // Velocity: txn count in 24h normalised to 0-1
        double velocityScore = Math.min(agg.getTxnCount24h() / HIGH_VELOCITY_THRESHOLD, 1.0);

        // Burst: today vs 7d average
        double avg7d = agg.getTxnCount7d() > 0
                ? agg.getTotalOut7d() / 7.0
                : 0.0;
        double burstScore = avg7d == 0
                ? 0.0
                : Math.min((agg.getTotalOut24h() / avg7d) / HIGH_BURST_THRESHOLD, 1.0);

        // Amount deviation: how far is this txn from avg txn size today
        double avgTxnSize = agg.getTxnCount24h() > 0
                ? agg.getTotalOut24h() / agg.getTxnCount24h()
                : 0.0;
        double avgAmountDeviation = avgTxnSize == 0
                ? 0.0
                : Math.min(Math.abs(currentAmount - avgTxnSize) / avgTxnSize, 1.0);

        return new BehaviorFeaturesDTO(
                agg.getTotalIn24h(),
                agg.getTotalOut24h(),
                agg.getTxnCount24h(),
                agg.getUniqueCounterparties7d(),
                round(velocityScore),
                round(burstScore),
                round(avgAmountDeviation)
        );
    }

    private double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}