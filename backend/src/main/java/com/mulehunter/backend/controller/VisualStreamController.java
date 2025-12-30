package com.mulehunter.backend.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;

@RestController
@CrossOrigin(origins = "http://localhost:3000", allowCredentials = "true")
@RequestMapping("/api/visual")
public class VisualStreamController {

        private final WebClient webClient;

        @Value("${visual.internal-api-key}")
        private String internalApiKey;

        public VisualStreamController(WebClient.Builder builder) {
                this.webClient = builder
                                .baseUrl("http://13.61.143.100:8000") // FastAPI base
                                .build();
        }

        @GetMapping(value = "/stream/unsupervised", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
        public Flux<String> streamUnsupervised(
                        @RequestParam String transactionId,
                        @RequestParam Long nodeId) {
                System.out.println(
                                "➡ SSE proxy → tx=" + transactionId + " node=" + nodeId);

                return webClient.get()
                                .uri(uriBuilder -> uriBuilder
                                                .path("/visual-analytics/api/visual/stream/unsupervised")
                                                .queryParam("transactionId", transactionId)
                                                .queryParam("nodeId", nodeId)
                                                .build())
                                .header("X-INTERNAL-API-KEY", internalApiKey)
                                .retrieve()
                                .bodyToFlux(String.class);
        }
}
