package com.mulehunter.backend.controller;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import com.mulehunter.backend.repository.*;
import com.mulehunter.backend.DTO.NodeAnalyticsResponse;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/backend/api/visual/node")
public class NodeAnalyticsController {

    private final NodeEnrichedRepository nodeRepo;
    private final AnomalyScoreRepository anomalyRepo;
    private final ShapExplanationRepository shapRepo;
    private final FraudExplanationRepository fraudRepo;

    public NodeAnalyticsController(
            NodeEnrichedRepository nodeRepo,
            AnomalyScoreRepository anomalyRepo,
            ShapExplanationRepository shapRepo,
            FraudExplanationRepository fraudRepo) {

        this.nodeRepo = nodeRepo;
        this.anomalyRepo = anomalyRepo;
        this.shapRepo = shapRepo;
        this.fraudRepo = fraudRepo;
    }

    @GetMapping("/{nodeId}/full")
public Mono<NodeAnalyticsResponse> getFull(@PathVariable Long nodeId) {

    return Mono.zip(
            nodeRepo.findByNodeId(nodeId),
            anomalyRepo.findByNodeId(nodeId).switchIfEmpty(Mono.empty()),
            shapRepo.findByNodeId(nodeId).collectList(),
            fraudRepo.findByNodeId(nodeId).switchIfEmpty(Mono.empty())
    ).map(t -> {

        NodeAnalyticsResponse r = new NodeAnalyticsResponse();
        r.setFeatures(t.getT1());
        r.setAnomaly(t.getT2());
        r.setShap(t.getT3());
        r.setReasons(t.getT4());

        return r;
    });
}
}
