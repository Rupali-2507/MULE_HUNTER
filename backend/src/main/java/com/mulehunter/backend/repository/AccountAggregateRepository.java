package com.mulehunter.backend.repository;

import com.mulehunter.backend.model.AccountAggregate;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

@Repository
public interface AccountAggregateRepository extends ReactiveMongoRepository<AccountAggregate, String> {
    Mono<AccountAggregate> findByAccountId(String accountId);
}