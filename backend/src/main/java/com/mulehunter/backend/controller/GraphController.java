package com.mulehunter.backend.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.DTO.GraphLinkDTO;
import com.mulehunter.backend.DTO.GraphNodeDTO;
import com.mulehunter.backend.DTO.GraphResponseDTO;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.repository.TransactionRepository;

import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/graph")
public class GraphController {

    private final TransactionRepository transactionRepository;

    public GraphController(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    @GetMapping
    public Mono<GraphResponseDTO> getGraph() {

        return transactionRepository.findAll()
                .collectList()
                .map(txs -> {

                    // Build links
                    List<GraphLinkDTO> links = txs.stream()
                            .map(t -> new GraphLinkDTO(
                                    t.getSourceAccount(),
                                    t.getTargetAccount(),
                                    t.getAmount()
                            ))
                            .toList();

                    // Build nodes
                    Map<String, Boolean> fraudMap = new HashMap<>();

                    for (Transaction t : txs) {
                        fraudMap.put(t.getSourceAccount(), t.isSuspectedFraud());
                        fraudMap.put(t.getTargetAccount(), t.isSuspectedFraud());
                    }

                    List<GraphNodeDTO> nodes = fraudMap.entrySet()
                            .stream()
                            .map(e -> new GraphNodeDTO(
                                    e.getKey(),
                                    e.getValue()
                            ))
                            .toList();

                    return new GraphResponseDTO(nodes, links);
                });

    }
    @GetMapping("/transactions")
    public Mono<List<Transaction>> getAllTransactions() {
        return transactionRepository.findAll().collectList();
    }

}
