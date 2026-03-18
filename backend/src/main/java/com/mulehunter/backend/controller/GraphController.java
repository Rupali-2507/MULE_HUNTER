package com.mulehunter.backend.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.mulehunter.backend.DTO.GraphLinkDTO;
import com.mulehunter.backend.DTO.GraphNodeDTO;
import com.mulehunter.backend.DTO.GraphNodeDetailDTO;
import com.mulehunter.backend.DTO.GraphResponseDTO;

import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/graph")
public class GraphController {

        private final ReactiveMongoTemplate mongo;

        public GraphController(ReactiveMongoTemplate mongo) {
                this.mongo = mongo;
        }

        // GET FULL GRAPH (nodes + links)

        @GetMapping
        public Mono<GraphResponseDTO> getGraph() {

                // ---------- NODES ----------
                Mono<List<GraphNodeDTO>> nodesMono = mongo.findAll(Map.class, "nodes")
                                .map(doc -> {

                                        Object nodeIdObj = doc.get("node_id");
                                        if (nodeIdObj == null)
                                                return null;

                                        String nodeId = nodeIdObj.toString();

                                        double anomalyScore = parseDouble(doc.get("anomaly_score"));

                                        boolean isAnomalous = "1"
                                                        .equals(doc.getOrDefault("is_anomalous", "0").toString());

                                        long txVelocity = parseLong(doc.get("tx_velocity"));

                                        return new GraphNodeDTO(
                                                        nodeId,
                                                        anomalyScore,
                                                        isAnomalous,
                                                        txVelocity);
                                })
                                .filter(n -> n != null)
                                .collectList()
                                .onErrorReturn(List.of());

                // ---------- LINKS ----------
                Mono<List<GraphLinkDTO>> linksMono = mongo.findAll(Map.class, "graph_edges")
                                .map(doc -> {

                                        Object srcObj = doc.get("source");
                                        Object tgtObj = doc.get("target");

                                        if (srcObj == null || tgtObj == null)
                                                return null;

                                        String source = srcObj.toString();
                                        String target = tgtObj.toString();

                                        BigDecimal amount = parseBigDecimal(doc.get("amount"));

                                        return new GraphLinkDTO(source, target, amount);
                                })
                                .filter(l -> l != null)
                                .collectList()
                                .onErrorReturn(List.of());

                return Mono.zip(nodesMono, linksMono)
                                .map(t -> new GraphResponseDTO(t.getT1(), t.getT2()))
                                .onErrorReturn(new GraphResponseDTO(List.of(), List.of()));
        }

        // GET SINGLE NODE DETAIL (SHAP / reasons)

        @GetMapping("/node/{nodeId}")
        public Mono<GraphNodeDetailDTO> getNodeDetail(@PathVariable String nodeId) {

                Query query = new Query(
                                new Criteria().orOperator(
                                                Criteria.where("node_id").is(nodeId),
                                                Criteria.where("node_id").is(parseIntSafe(nodeId))));

                return mongo.findOne(query, Map.class, "nodes")
                                .map(doc -> {

                                        double anomalyScore = parseDouble(doc.get("anomaly_score"));

                                        boolean isAnomalous = "1"
                                                        .equals(doc.getOrDefault("is_anomalous", "0").toString());

                                        @SuppressWarnings("unchecked")
                                        List<String> reasons = (List<String>) doc.getOrDefault("reasons", List.of());

                                        @SuppressWarnings("unchecked")
                                        List<Map<String, Object>> shapFactors = (List<Map<String, Object>>) doc
                                                        .getOrDefault(
                                                                        "shap_factors", List.of());

                                        return new GraphNodeDetailDTO(
                                                        doc.get("node_id").toString(),
                                                        anomalyScore,
                                                        isAnomalous,
                                                        reasons,
                                                        shapFactors);
                                })

                                .switchIfEmpty(
                                                Mono.just(
                                                                new GraphNodeDetailDTO(
                                                                                nodeId,
                                                                                0.0,
                                                                                false,
                                                                                List.of(),
                                                                                List.of())));
        }

        // SAFE PARSERS

        private static double parseDouble(Object v) {
                try {
                        return v == null ? 0.0 : Double.parseDouble(v.toString());
                } catch (Exception e) {
                        return 0.0;
                }
        }

        private static long parseLong(Object v) {
                try {
                        return v == null ? 0L : Long.parseLong(v.toString());
                } catch (Exception e) {
                        return 0L;
                }
        }

        private static BigDecimal parseBigDecimal(Object v) {
                try {
                        return v == null ? BigDecimal.ZERO : new BigDecimal(v.toString());
                } catch (Exception e) {
                        return BigDecimal.ZERO;
                }
        }

        private static Integer parseIntSafe(String v) {
                try {
                        return Integer.valueOf(v);
                } catch (Exception e) {
                        return null;
                }
        }
}
