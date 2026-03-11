package com.mulehunter.backend.repository;

import org.springframework.data.repository.reactive.ReactiveCrudRepository;

import com.mulehunter.backend.model.Transaction;

import reactor.core.publisher.Mono;

public interface TransactionRepository
        extends ReactiveCrudRepository<Transaction, String> {

    Mono<Boolean> existsByTransactionId(String transactionId);
}