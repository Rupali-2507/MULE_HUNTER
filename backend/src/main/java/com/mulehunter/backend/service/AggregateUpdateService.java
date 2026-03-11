package com.mulehunter.backend.service;

import com.mulehunter.backend.model.AccountAggregate;
import com.mulehunter.backend.model.IdentityEvent;
import com.mulehunter.backend.repository.AccountAggregateRepository;
import com.mulehunter.backend.repository.IdentityEventRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * Step 4 — Incremental Aggregate Updater (Reactive MongoDB)
 *
 * Also handles Step 2 identity_events persistence.
 * Called from TransactionService after every transaction is saved.
 */
@Service
public class AggregateUpdateService {

    private final AccountAggregateRepository aggregateRepo;
    private final IdentityEventRepository identityEventRepo;

    public AggregateUpdateService(AccountAggregateRepository aggregateRepo,
                                   IdentityEventRepository identityEventRepo) {
        this.aggregateRepo     = aggregateRepo;
        this.identityEventRepo = identityEventRepo;
    }

    /**
     * Main entry point — call after each transaction is persisted.
     * Updates both source (outgoing) and destination (incoming) aggregates.
     */
    public Mono<Void> update(String sourceAccountId,
                              String destAccountId,
                              double amount,
                              String transactionId,
                              String ja3,
                              String deviceHash,
                              String ip) {

        // Step 2: persist identity event
        IdentityEvent event = IdentityEvent.from(
                sourceAccountId, transactionId, ja3, deviceHash, ip, "unknown"
        );

        return identityEventRepo.save(event)
                .then(updateAccountAggregate(sourceAccountId, amount, true,  ja3, deviceHash, ip, destAccountId))
                .then(updateAccountAggregate(destAccountId,   amount, false, null, null, null, sourceAccountId));
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private Mono<Void> updateAccountAggregate(String accountId,
                                               double amount,
                                               boolean isOutgoing,
                                               String ja3,
                                               String deviceHash,
                                               String ip,
                                               String counterpartyId) {

        return aggregateRepo.findByAccountId(accountId)
                .defaultIfEmpty(AccountAggregate.newFor(accountId))
                .flatMap(agg -> {
                    Instant now = Instant.now();
                    Instant cutoff24h = now.minus(24, ChronoUnit.HOURS);
                    Instant cutoff7d  = now.minus(7,  ChronoUnit.DAYS);

                    // Reset 24h window if expired
                    if (agg.getWindowStart24h() != null &&
                        agg.getWindowStart24h().isBefore(cutoff24h)) {
                        agg.setTotalOut24h(0.0);
                        agg.setTotalIn24h(0.0);
                        agg.setTxnCount24h(0);
                        agg.setWindowStart24h(now);
                    }

                    // Reset 7d window if expired
                    if (agg.getWindowStart7d() != null &&
                        agg.getWindowStart7d().isBefore(cutoff7d)) {
                        agg.setTotalOut7d(0.0);
                        agg.setTotalIn7d(0.0);
                        agg.setTxnCount7d(0);
                        agg.setUniqueCounterparties7d(0);
                        agg.setWindowStart7d(now);
                    }

                    // Update amounts
                    if (isOutgoing) {
                        agg.setTotalOut24h(agg.getTotalOut24h() + amount);
                        agg.setTotalOut7d(agg.getTotalOut7d() + amount);
                    } else {
                        agg.setTotalIn24h(agg.getTotalIn24h() + amount);
                        agg.setTotalIn7d(agg.getTotalIn7d() + amount);
                    }

                    agg.setTxnCount24h(agg.getTxnCount24h() + 1);
                    agg.setTxnCount7d(agg.getTxnCount7d() + 1);
                    agg.setUniqueCounterparties7d(agg.getUniqueCounterparties7d() + 1);

                    // Update identity reuse signals (only for source account)
                    if (ja3 != null)        agg.setJa3ReuseCount(agg.getJa3ReuseCount() + 1);
                    if (deviceHash != null) agg.setDeviceReuseCount(agg.getDeviceReuseCount() + 1);
                    if (ip != null)         agg.setIpReuseCount(agg.getIpReuseCount() + 1);

                    agg.setLastUpdated(now);
                    return aggregateRepo.save(agg);
                })
                .then();
    }
}