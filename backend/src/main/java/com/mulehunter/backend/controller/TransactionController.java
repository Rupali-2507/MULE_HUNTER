package com.mulehunter.backend.controller;

import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.TransactionRequest;
import com.mulehunter.backend.service.TransactionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    @PostMapping("/transactions")
    public Mono<ResponseEntity<Map<String, Object>>> createTransaction(
            @RequestBody TransactionRequest request,
            HttpServletRequest httpRequest
    ) {
        System.out.println("🔥 CONTROLLER HIT 🔥");
        String ja3 = httpRequest.getHeader("X-JA3-Fingerprint");
        System.out.println("🧬 JA3 HEADER = " + ja3);

        return transactionService.createTransaction(request, ja3)
                .map(tx -> {
                    Map<String, Object> body = buildRichResponse(tx);

                    // 403 if BLOCK
                    HttpStatus status = "BLOCK".equals(tx.getDecision())
                            ? HttpStatus.FORBIDDEN
                            : HttpStatus.OK;

                    return ResponseEntity.status(status).body(body);
                });
    }

    private Map<String, Object> buildRichResponse(Transaction tx) {
        Map<String, Object> resp = new LinkedHashMap<>();

        // ── Core decision ─────────────────────────────────────────
        resp.put("transactionId", tx.getTransactionId());
        resp.put("decision",      tx.getDecision());
        resp.put("riskScore",     tx.getRiskScore());
        resp.put("riskLevel",     tx.getRiskLevel());
        resp.put("suspectedFraud", tx.isSuspectedFraud());

        // ── Model scores breakdown ────────────────────────────────
        Map<String, Object> scores = new LinkedHashMap<>();
        scores.put("gnn",      tx.getGnnScore());
        scores.put("eif",      tx.getUnsupervisedScore());
        scores.put("behavior", tx.getBehaviorScore());
        scores.put("graph",    tx.getGraphScore());
        scores.put("ja3",      tx.getJa3Risk());
        scores.put("confidence", tx.getGnnConfidence());
        resp.put("modelScores", scores);

        // ── Network metrics ───────────────────────────────────────
        Map<String, Object> network = new LinkedHashMap<>();
        network.put("suspiciousNeighbors", tx.getSuspiciousNeighbors());
        network.put("sharedDevices",       tx.getSharedDevices());
        network.put("sharedIPs",           tx.getSharedIPs());
        network.put("centralityScore",     tx.getCentralityScore());
        network.put("transactionLoops",    tx.getTransactionLoops());
        resp.put("networkMetrics", network);

        // ── Fraud cluster ─────────────────────────────────────────
        Map<String, Object> cluster = new LinkedHashMap<>();
        cluster.put("clusterId",       tx.getClusterId());
        cluster.put("clusterSize",     tx.getClusterSize());
        cluster.put("clusterRiskScore", tx.getClusterRiskScore());
        resp.put("fraudCluster", cluster);

        // ── Mule ring detection ───────────────────────────────────
        Map<String, Object> ring = new LinkedHashMap<>();
        ring.put("isMuleRingMember", tx.getMuleRingMember());
        ring.put("ringShape",        tx.getRingShape());
        ring.put("ringSize",         tx.getRingSize());
        ring.put("role",             tx.getRole());
        ring.put("hubAccount",       tx.getHubAccount());
        ring.put("ringAccounts",     tx.getRingAccounts());
        resp.put("muleRingDetection", ring);

        // ── Risk factors (explainability) ─────────────────────────
        resp.put("riskFactors", tx.getRiskFactors());

        // ── JA3 security signals ──────────────────────────────────
        Map<String, Object> ja3Info = new LinkedHashMap<>();
        ja3Info.put("ja3Risk",     tx.getJa3Risk());
        ja3Info.put("ja3Detected", tx.getJa3Detected());
        ja3Info.put("velocity",    tx.getJa3Velocity());
        ja3Info.put("fanout",      tx.getJa3Fanout());
        ja3Info.put("isNewDevice", tx.getIsNewDevice());
        ja3Info.put("isNewJa3",    tx.getIsNewJa3());
        resp.put("ja3Security", ja3Info);

        // ── Embedding ─────────────────────────────────────────────
        resp.put("embeddingNorm", tx.getEmbeddingNorm());

        return resp;
    }
}