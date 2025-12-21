package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;

import com.mulehunter.backend.client.FraudClient;
import com.mulehunter.backend.client.FraudResponse;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;

import reactor.core.publisher.Mono;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final FraudClient fraudClient;

    public TransactionService(TransactionRepository repository,
                              FraudClient fraudClient) {
        this.repository = repository;
        this.fraudClient = fraudClient;
    }

    public Mono<Transaction> createTransaction(TransactionRequest request) {
        Transaction tx = Transaction.from(request);
        int nodeId = Integer.parseInt(tx.getAccountId());

        return fraudClient.checkFraud(nodeId)
                .map(FraudResponse::isFraud)
                .onErrorReturn(true) // if AI fails → assume risk
                .flatMap(isFraud -> {
                    tx.setSuspectedFraud(isFraud);
                    return repository.save(tx);
                });
    }
}
