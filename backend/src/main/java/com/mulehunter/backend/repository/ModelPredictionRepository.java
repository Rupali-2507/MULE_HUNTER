package com.mulehunter.backend.repository;

import com.mulehunter.backend.DTO.PredictionLabelDTO;
import com.mulehunter.backend.model.Transaction;
import com.mulehunter.backend.model.AiRiskResult;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.mongodb.repository.Query;

public interface ModelPredictionRepository extends JpaRepository<Transaction, String> {

    @Query("""
        SELECT new com.mulehunter.backend.dto.PredictionLabelDTO(
            r.modelName,
            r.modelVersion,
            r.predictedLabel,
            r.predictedScore,
            t.actualLabel
        )
        FROM AIriskResult r
        JOIN Transaction t
        ON r.transactionId = t.transactionId
        WHERE r.timestamp BETWEEN :start AND :end
    """)
    List<PredictionLabelDTO> fetchEvaluationData(
        @Param("start") LocalDateTime start,
        @Param("end") LocalDateTime end
    );
}