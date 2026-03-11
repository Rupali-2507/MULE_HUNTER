package com.mulehunter.backend.repository;

import com.mulehunter.backend.model.IdentityEvent;
import org.springframework.data.mongodb.repository.ReactiveMongoRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

@Repository
public interface IdentityEventRepository extends ReactiveMongoRepository<IdentityEvent, String> {
    Flux<IdentityEvent> findByAccountId(String accountId);
    Flux<IdentityEvent> findByJa3(String ja3);
    Flux<IdentityEvent> findByDeviceHash(String deviceHash);
    Flux<IdentityEvent> findByIp(String ip);
}