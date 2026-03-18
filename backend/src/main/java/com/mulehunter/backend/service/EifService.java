package com.mulehunter.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import com.mulehunter.backend.DTO.EifResponse;

import reactor.core.publisher.Mono;

import java.util.List;
import java.util.Map;

@Service
public class EifService {

    private final WebClient webClient;

    public EifService(WebClient.Builder builder) {
        this.webClient = builder
                .baseUrl("http://127.0.0.1:8002")   // change to AWS later
                .build();
    }
    public Mono<EifResponse> score(List<Double> features) {

        Map<String, Object> body = Map.of(
                "features", features
        );

        return webClient.post()
                .uri("/v1/eif/score")
                .bodyValue(body)
                .retrieve()
                .bodyToMono(EifResponse.class)
                .onErrorReturn(new EifResponse());
    }
}