package com.mulehunter.backend.repository;

import com.mulehunter.backend.model.FraudLabel;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import reactor.core.publisher.Mono;

public interface FraudLabelRepository 
        extends ReactiveCrudRepository<FraudLabel, String> {

    Mono<FraudLabel> findByTransactionId(String transactionId);
}