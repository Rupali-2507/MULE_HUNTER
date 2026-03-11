package com.mulehunter.backend.service;

import com.mulehunter.backend.model.Transaction;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
public class Ja3SecurityService {

    private final WebClient securityWebClient;

    public Ja3SecurityService(
            @Value("${security.service.url:http://mule-hunter-security-env.eba-twt3gcts.us-east-1.elasticbeanstalk.com}") 
            String securityServiceUrl
    ) {

        System.out.println("🔐 CONNECTING SECURITY TO: " + securityServiceUrl);

        this.securityWebClient = WebClient.builder()
                .baseUrl(securityServiceUrl)
                .build();
    }

    public Mono<Map> callJa3Risk(Transaction tx, String ja3) {

        if (ja3 == null) return Mono.empty();

        System.out.println("➡️ CALLING JA3 SERVICE with JA3=" + ja3);

        Map<String, Object> payload = Map.of(
                "accountId", tx.getSourceAccount(),
                "txId", tx.getId()
        );

        return securityWebClient.post()
                .uri("/api/security/ja3-risk")
                .header("X-JA3-Fingerprint", ja3)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Map.class)
                .onErrorResume(e -> {
                    System.err.println("❌ JA3 SERVICE CALL FAILED: " + e.getMessage());
                    return Mono.empty();
                });
    }
}