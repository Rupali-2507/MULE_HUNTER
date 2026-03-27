package com.mulehunter.backend.controller;

import com.mulehunter.backend.DTO.StatsResponse;
import com.mulehunter.backend.service.AuditPdfService;
import com.mulehunter.backend.service.StatsService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/api/admin/stats")
public class AuditController {

    private final StatsService    statsService;
    private final AuditPdfService auditPdfService;

    public AuditController(StatsService statsService, AuditPdfService auditPdfService) {
        this.statsService    = statsService;
        this.auditPdfService = auditPdfService;
    }

    /**
     * GET /api/admin/stats/audit/download
     *
     * Fetches live stats (same data source as the dashboard) and streams
     * a fully-formatted PDF performance audit report to the browser.
     *
     * Response headers:
     *   Content-Type:        application/pdf
     *   Content-Disposition: attachment; filename="mule-hunter-audit-<timestamp>.pdf"
     */
    @GetMapping("/audit/download")
    public Mono<ResponseEntity<byte[]>> downloadAudit() {
        return statsService.getStats().map(stats -> {

            byte[] pdf = auditPdfService.generate(stats);

            String timestamp = ZonedDateTime.now(ZoneOffset.UTC)
                    .format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
            String filename  = "mule-hunter-audit-" + timestamp + ".pdf";

            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_PDF)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + filename + "\"")
                    .header(HttpHeaders.CACHE_CONTROL,
                            "no-cache, no-store, must-revalidate")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header("X-Content-Type-Options", "nosniff")
                    .body(pdf);
        });
    }
}