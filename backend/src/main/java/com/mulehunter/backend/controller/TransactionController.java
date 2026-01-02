package com.mulehunter.backend.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.service.TransactionService;
import jakarta.servlet.http.HttpServletRequest;


import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/transactions")

    public Mono<Transaction> createTransaction(@RequestBody TransactionRequest request,HttpServletRequest httpRequest) {
        System.out.println("🔥 CONTROLLER HIT 🔥");
        String ja3 = httpRequest.getHeader("X-JA3-Fingerprint");
        System.out.println("🧬 JA3 HEADER = " + ja3);

        return transactionService.createTransaction(request,ja3);
    }
}
