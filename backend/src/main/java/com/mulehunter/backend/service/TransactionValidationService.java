package com.mulehunter.backend.service;

import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;

@Service
public class TransactionValidationService {

    private final TransactionRepository repository;

    public TransactionValidationService(TransactionRepository repository) {
        this.repository = repository;
    }

    public Mono<Void> validate(TransactionRequest request) {

        if (request.getSourceAccount() == null ||
            request.getTargetAccount() == null ||
            request.getAmount() == null ||
            request.getTransactionId() == null ||
            request.getTimestamp() == null) {

            return Mono.error(new IllegalArgumentException("Missing required fields"));
        }

        if (request.getAmount().doubleValue() <= 0) {
            return Mono.error(new IllegalArgumentException("Amount must be > 0"));
        }

        Instant ts = request.getTimestamp();

        if (ts.isBefore(Instant.now().minusSeconds(300))) {
            return Mono.error(new IllegalArgumentException("Transaction timestamp too old"));
        }

        return repository.existsByTransactionId(request.getTransactionId())
                .flatMap(exists -> {
                    if (exists) {
                        return Mono.error(new IllegalArgumentException("Duplicate transactionId"));
                    }
                    return Mono.empty();
                });
    }
}