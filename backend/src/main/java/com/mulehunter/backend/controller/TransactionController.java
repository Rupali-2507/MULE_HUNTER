package com.mulehunter.backend.controller;

import com.mulehunter.backend.DTO.RiskDecisionDTO;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.service.RiskPipelineService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
public class TransactionController {

    private final RiskPipelineService riskPipelineService;

    public TransactionController(RiskPipelineService riskPipelineService) {
        this.riskPipelineService = riskPipelineService;
    }

    @PostMapping("/transactions")
    public Mono<ResponseEntity<RiskDecisionDTO>> createTransaction(
            @RequestBody TransactionRequest request,
            HttpServletRequest httpRequest
    ) {
        System.out.println("🔥 CONTROLLER HIT 🔥");
        String ja3 = httpRequest.getHeader("X-JA3-Fingerprint");
        System.out.println("🧬 JA3 HEADER = " + ja3);

        return riskPipelineService.evaluate(request, ja3)
                .map(dto -> {
                    if ("BLOCK".equals(dto.getDecision())) {
                        return ResponseEntity.status(403).body(dto);
                    }
                    return ResponseEntity.ok(dto);
                });
    }
}