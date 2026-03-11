package com.mulehunter.backend.repository;

import org.springframework.data.mongodb.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;

import com.mulehunter.backend.model.Transaction;

import reactor.core.publisher.Mono;

public interface TransactionRepository
        extends ReactiveCrudRepository<Transaction, String> {

    Mono<Boolean> existsByTransactionId(String transactionId);
    Mono<Long> countByJa3Detected(Boolean ja3Detected);
    Mono<Long> countByDeviceHash(String deviceHash);
    Mono<Long> countByIpAddress(String ipAddress);

    // ── Step 6: Graph feature queries ─────────────────────────────────────────

    /** Total edges: all transactions involving this account */
    @Query(value = "{ '$or': [ {'sourceAccount': ?0}, {'targetAccount': ?1} ] }", count = true)
    Mono<Long> countBySourceAccountOrTargetAccount(String sourceAccount, String targetAccount);

    /** Suspicious neighbours: counterparties flagged as fraud */
    @Query(value = "{ '$or': [ {'sourceAccount': ?0}, {'targetAccount': ?0} ], 'suspectedFraud': true }", count = true)
    Mono<Long> countSuspiciousNeighbours(String accountId);
}