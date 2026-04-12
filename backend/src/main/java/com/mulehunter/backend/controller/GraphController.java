package com.mulehunter.backend.controller;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.data.mongodb.core.ReactiveMongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
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
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class GraphController {

        private final ReactiveMongoTemplate mongo;

        public GraphController(ReactiveMongoTemplate mongo) {
                this.mongo = mongo;
        }

        // ── EXISTING: GET FULL GRAPH (nodes + links) ──────────────────────────────

        @GetMapping("/graph")
        public Mono<GraphResponseDTO> getGraph() {

                Mono<List<GraphNodeDTO>> nodesMono = mongo.findAll(Map.class, "nodes")
                                .map(doc -> {
                                        Object nodeIdObj = doc.get("node_id");
                                        if (nodeIdObj == null) return null;

                                        String nodeId = nodeIdObj.toString();
                                        double anomalyScore = parseDouble(doc.get("anomaly_score"));
                                        boolean isAnomalous = "1"
                                                        .equals(doc.getOrDefault("is_anomalous", "0").toString());
                                        long txVelocity = parseLong(doc.get("tx_count"));

                                        return new GraphNodeDTO(nodeId, anomalyScore, isAnomalous, txVelocity);
                                })
                                .filter(n -> n != null)
                                .collectList()
                                .onErrorReturn(List.of())
                                .cache();

                Mono<List<GraphLinkDTO>> linksMono = mongo.findAll(Map.class, "transactions")
                                .collectList()
                                .zipWith(nodesMono)
                                .map(tuple -> {
                                        List<Map> txs = tuple.getT1();
                                        List<GraphNodeDTO> nodes = tuple.getT2();

                                        Set<String> nodeIds = nodes.stream()
                                                        .map(GraphNodeDTO::nodeId)
                                                        .collect(Collectors.toSet());

                                        return txs.stream()
                                                        .map(doc -> {
                                                                Object srcObj = doc.get("source");
                                                                Object tgtObj = doc.get("target");
                                                                if (srcObj == null || tgtObj == null) return null;

                                                                String source = srcObj.toString();
                                                                String target = tgtObj.toString();
                                                                if (!nodeIds.contains(source) || !nodeIds.contains(target)) return null;

                                                                return new GraphLinkDTO(source, target, parseBigDecimal(doc.get("amount")));
                                                        })
                                                        .filter(l -> l != null)
                                                        .toList();
                                });

                return Mono.zip(nodesMono, linksMono)
                                .map(t -> new GraphResponseDTO(t.getT1(), t.getT2()))
                                .onErrorReturn(new GraphResponseDTO(List.of(), List.of()));
        }

        // ── EXISTING: GET SINGLE NODE DETAIL (SHAP / reasons) ────────────────────

        @GetMapping("/graph/node/{nodeId}")
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
                                                        .getOrDefault("shap_factors", List.of());

                                        return new GraphNodeDetailDTO(
                                                        doc.get("node_id").toString(),
                                                        anomalyScore,
                                                        isAnomalous,
                                                        reasons,
                                                        shapFactors);
                                })
                                .switchIfEmpty(Mono.just(new GraphNodeDetailDTO(
                                                nodeId, 0.0, false, List.of(), List.of())));
        }

        // ── NEW: GET RAW NODE BY nodeId — used by NodeInspector.tsx ──────────────

        @GetMapping("/nodes/node/{nodeId}")
        public Mono<ResponseEntity<Map>> getNodeByNodeId(@PathVariable String nodeId) {

                Query query = new Query(
                                new Criteria().orOperator(
                                                Criteria.where("node_id").is(nodeId),
                                                Criteria.where("node_id").is(parseIntSafe(nodeId))));

                return mongo.findOne(query, Map.class, "nodes")
                                .map(doc -> ResponseEntity.ok(doc))
                                .defaultIfEmpty(ResponseEntity.notFound().build());
        }

        // ── NEW: GET ALL RAW NODES ────────────────────────────────────────────────

        @GetMapping("/nodes")
        public Mono<ResponseEntity<List<Map>>> getAllNodes() {
                return mongo.findAll(Map.class, "nodes")
                                .collectList()
                                .map(ResponseEntity::ok);
        }

        // ── SAFE PARSERS ──────────────────────────────────────────────────────────

        private static double parseDouble(Object v) {
                try { return v == null ? 0.0 : Double.parseDouble(v.toString()); }
                catch (Exception e) { return 0.0; }
        }

        private static long parseLong(Object v) {
                try { return v == null ? 0L : Long.parseLong(v.toString()); }
                catch (Exception e) { return 0L; }
        }

        private static BigDecimal parseBigDecimal(Object v) {
                try { return v == null ? BigDecimal.ZERO : new BigDecimal(v.toString()); }
                catch (Exception e) { return BigDecimal.ZERO; }
        }

        private static Integer parseIntSafe(String v) {
                try { return Integer.valueOf(v); }
                catch (Exception e) { return null; }
        }
}