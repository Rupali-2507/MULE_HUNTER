package com.mulehunter.backend.client;

import java.time.Duration;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import reactor.core.publisher.Mono;

@Component
public class FraudClient {

    private final WebClient webClient;

    public FraudClient(WebClient.Builder builder) {
        this.webClient = builder
                .baseUrl("http://localhost:8000")
                .build();
    }

    public Mono<FraudResponse> checkFraud(int nodeId) {
        return webClient.get()
                .uri("/predict/{nodeId}", nodeId)
                .retrieve()
                .bodyToMono(FraudResponse.class)
                .timeout(Duration.ofSeconds(2));
    }
}
