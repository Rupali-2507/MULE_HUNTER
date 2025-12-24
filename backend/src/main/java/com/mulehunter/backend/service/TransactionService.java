package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;

import com.mulehunter.backend.client.FraudClient;
import com.mulehunter.backend.client.FraudResponse;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.repository.TransactionRepository;
import com.mulehunter.backend.websocket.FraudAlertEvent;
import com.mulehunter.backend.websocket.FraudAlertPublisher;

import reactor.core.publisher.Mono;

@Service
public class TransactionService {

    private final TransactionRepository repository;
    private final FraudClient fraudClient;
    private final FraudAlertPublisher alertPublisher;
    private final NodeEnrichedService nodeEnrichedService;

    public TransactionService(
            TransactionRepository repository,
            FraudClient fraudClient,
            FraudAlertPublisher alertPublisher,
            NodeEnrichedService nodeEnrichedService) {
        this.repository = repository;
        this.fraudClient = fraudClient;
        this.alertPublisher = alertPublisher;
        this.nodeEnrichedService = nodeEnrichedService;
    }

    public Mono<Transaction> createTransaction(TransactionRequest request) {

        Transaction tx = Transaction.from(request);

        Long sourceNodeId = Long.parseLong(tx.getSourceAccount());
        Long targetNodeId = Long.parseLong(tx.getTargetAccount());
        double amount = tx.getAmount().doubleValue();

        return fraudClient.checkFraud(sourceNodeId.intValue())
                .onErrorReturn(new FraudResponse())
                .flatMap(response -> {

                    boolean isFraud = tx.isSuspectedFraud();
                    tx.setSuspectedFraud(isFraud);

                    if (isFraud) {
                        FraudAlertEvent event = new FraudAlertEvent(
                                tx.getSourceAccount(),
                                response.getRisk_score(),
                                response.getVerdict());
                        alertPublisher.publish(event);
                    }

                    return repository.save(tx)
                            .flatMap(savedTx -> Mono.when(
                                    nodeEnrichedService.handleOutgoing(sourceNodeId, amount),
                                    nodeEnrichedService.handleIncoming(targetNodeId, amount)).thenReturn(savedTx));
                });
    }
}
