package com.mulehunter.backend.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.mulehunter.backend.DTO.MetricsResponse;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

@Service
public class MetricsPdfService {

    // ── Brand colours (alertixAI Dark Theme) ─────────────────
    private static final Color C_LIME    = new Color(0xCA, 0xFF, 0x33);
    private static final Color C_BLACK   = new Color(0x08, 0x08, 0x08);
    private static final Color C_DARK    = new Color(0x12, 0x12, 0x12);
    private static final Color C_CARD    = new Color(0x1A, 0x1A, 0x1A);
    private static final Color C_BORDER  = new Color(0x2A, 0x2A, 0x2A);
    private static final Color C_WHITE   = new Color(0xF0, 0xF0, 0xF0);
    private static final Color C_GREY    = new Color(0x88, 0x88, 0x88);
    private static final Color C_PURPLE  = new Color(0xA8, 0x55, 0xF7);
    private static final Color C_BLUE    = new Color(0x3B, 0x82, 0xF6);

    // ── Fonts ─────────────────────────────────────────────────
    private static final Font F_DISPLAY = new Font(Font.HELVETICA, 24, Font.BOLD,   C_WHITE);
    private static final Font F_TITLE   = new Font(Font.HELVETICA, 16, Font.BOLD,   C_WHITE);
    private static final Font F_SECTION = new Font(Font.HELVETICA, 10, Font.BOLD,   C_LIME);
    private static final Font F_LABEL   = new Font(Font.HELVETICA,  8, Font.BOLD,   C_GREY);
    private static final Font F_VALUE   = new Font(Font.HELVETICA, 12, Font.BOLD,   C_WHITE);
    private static final Font F_BODY    = new Font(Font.HELVETICA,  9, Font.NORMAL, C_GREY);
    private static final Font F_MONO    = new Font(Font.COURIER,    8, Font.NORMAL, C_GREY);
    private static final Font F_BADGE   = new Font(Font.HELVETICA,  7, Font.BOLD,   C_BLACK);

    public byte[] generate(MetricsResponse metrics) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            Document doc = new Document(PageSize.A4, 40, 40, 50, 50);
            PdfWriter writer = PdfWriter.getInstance(doc, baos);
            writer.setPageEvent(new PageDecorator());
            
            doc.open();
            addContent(doc, writer, metrics);
            doc.close();
            
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate metrics PDF", e);
        }
    }

    private void addContent(Document doc, PdfWriter writer, MetricsResponse metrics) throws Exception {
        String generatedAt = ZonedDateTime.now(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm:ss 'UTC'"));
        float pw = doc.getPageSize().getWidth() - doc.leftMargin() - doc.rightMargin();

        // Background
        PdfContentByte cb = writer.getDirectContent();
        cb.setColorFill(C_BLACK);
        cb.rectangle(0, 0, doc.getPageSize().getWidth(), doc.getPageSize().getHeight());
        cb.fill();

        // Lime accent
        cb.setColorFill(C_LIME);
        cb.rectangle(0, 0, 6, doc.getPageSize().getHeight());
        cb.fill();

        // Header
        Paragraph logo = new Paragraph("alertixAI", F_DISPLAY);
        doc.add(logo);
        Paragraph sub = new Paragraph("AI Intelligence System · Model Evaluation", F_BODY);
        doc.add(sub);
        doc.add(spacer(16));
        Paragraph title = new Paragraph("MODEL PERFORMANCE REPORT", F_TITLE);
        doc.add(title);
        Paragraph gen = new Paragraph("Generated: " + generatedAt, F_MONO);
        doc.add(gen);
        doc.add(spacer(24));

        // SECTION 1: SCIENTIFIC BENCHMARKS (OFFLINE)
        doc.add(sectionHeader("SCIENTIFIC BENCHMARKS (OFFLINE TRAINING)", pw));
        doc.add(spacer(8));
        
        PdfPTable sciTable = new PdfPTable(new float[]{1, 1});
        sciTable.setWidthPercentage(100);
        
        if (metrics.offlineGnn != null) {
            sciTable.addCell(modelHeaderCell("GNN (Graph Neural Network)", C_LIME));
        }
        if (metrics.offlineEif != null) {
            sciTable.addCell(modelHeaderCell("EIF (Isolation Forest)", C_PURPLE));
        }
        
        if (metrics.offlineGnn != null) {
            sciTable.addCell(metricsSummary(metrics.offlineGnn, C_LIME));
        }
        if (metrics.offlineEif != null) {
            sciTable.addCell(metricsSummary(metrics.offlineEif, C_PURPLE));
        }
        doc.add(sciTable);
        doc.add(spacer(20));

        // SECTION 2: OPERATIONAL AUDIT (LIVE SYSTEM)
        doc.add(sectionHeader("OPERATIONAL AUDIT (LIVE SYSTEM ANALYSIS)", pw));
        doc.add(spacer(8));

        PdfPTable auditTable = new PdfPTable(new float[]{1, 1, 1});
        auditTable.setWidthPercentage(100);
        
        auditTable.addCell(modelHeaderCell("GNN AUDIT", C_LIME));
        auditTable.addCell(modelHeaderCell("EIF AUDIT", C_PURPLE));
        auditTable.addCell(modelHeaderCell("FUSION ENSEMBLE", C_BLUE));
        
        auditTable.addCell(auditMetricsSummary(metrics.gnn, C_LIME));
        auditTable.addCell(auditMetricsSummary(metrics.eif, C_PURPLE));
        auditTable.addCell(auditMetricsSummary(metrics.combined, C_BLUE));
        
        doc.add(auditTable);
        doc.add(spacer(20));

        // SECTION 3: ENSEMBLE WEIGHTS
        doc.add(sectionHeader("MODEL ENSEMBLE CONFIGURATION", pw));
        doc.add(spacer(8));
        
        PdfPTable weights = new PdfPTable(new float[]{1, 1, 1, 1, 1});
        weights.setWidthPercentage(100);
        weights.addCell(weightCell("GNN", "40%", C_LIME));
        weights.addCell(weightCell("EIF", "20%", C_PURPLE));
        weights.addCell(weightCell("BEHAVIOR", "25%", C_WHITE));
        weights.addCell(weightCell("GRAPH", "10%", C_WHITE));
        weights.addCell(weightCell("JA3", "5%", C_WHITE));
        doc.add(weights);
        doc.add(spacer(20));

        // Methodology
        doc.add(sectionHeader("METHODOLOGY", pw));
        Paragraph methodology = new Paragraph(
            "This report is generated from the live transaction database and scientific evaluation engines. " +
            "Offline metrics reflect controlled training validation. Operational metrics reflect audit performance " +
            "against human-labelled ground truth from recent transaction logs.", F_BODY);
        methodology.setLeading(12);
        doc.add(methodology);
    }

    private Element sectionHeader(String title, float pw) {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        PdfPCell c = new PdfPCell(new Phrase(title, F_SECTION));
        c.setBackgroundColor(C_DARK);
        c.setBorderColor(C_LIME);
        c.setBorderWidthLeft(3f);
        c.setBorderWidthTop(0);
        c.setBorderWidthRight(0);
        c.setBorderWidthBottom(0);
        c.setPadding(8);
        t.addCell(c);
        return t;
    }

    private PdfPCell modelHeaderCell(String text, Color color) {
        PdfPCell c = new PdfPCell();
        c.setBackgroundColor(C_CARD);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(8);
        Font f = new Font(Font.HELVETICA, 10, Font.BOLD, color);
        c.addElement(new Paragraph(text, f));
        return c;
    }

    private PdfPCell metricsSummary(MetricsResponse.OfflineMetrics m, Color color) {
        PdfPCell c = new PdfPCell();
        c.setBackgroundColor(C_DARK);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(10);
        
        c.addElement(metricRow("F1 Score", String.format("%.4f", m.f1)));
        c.addElement(metricRow("Precision", String.format("%.4f", m.precision)));
        c.addElement(metricRow("Recall", String.format("%.4f", m.recall)));
        c.addElement(metricRow("Accuracy", String.format("%.4f", m.accuracy)));
        c.addElement(metricRow("AUC-ROC", String.format("%.4f", m.auc)));
        return c;
    }

    private PdfPCell auditMetricsSummary(MetricsResponse.ModelMetrics m, Color color) {
        PdfPCell c = new PdfPCell();
        c.setBackgroundColor(C_DARK);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(10);
        
        if (m == null) {
            c.addElement(new Paragraph("Awaiting Audit", F_LABEL));
            return c;
        }

        c.addElement(metricRow("F1 Rank", String.format("%.3f", m.f1Score)));
        c.addElement(metricRow("Audit FPR", String.format("%.4f", m.fpr)));
        c.addElement(metricRow("Audit Precision", String.format("%.3f", m.precision)));
        c.addElement(metricRow("Audit Recall", String.format("%.3f", m.recall)));
        return c;
    }

    private PdfPCell weightCell(String label, String value, Color color) {
        PdfPCell c = new PdfPCell();
        c.setBackgroundColor(C_DARK);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(8);
        c.setHorizontalAlignment(Element.ALIGN_CENTER);
        
        Paragraph p1 = new Paragraph(label, F_LABEL);
        p1.setAlignment(Element.ALIGN_CENTER);
        c.addElement(p1);
        
        Font vf = new Font(Font.HELVETICA, 12, Font.BOLD, color);
        Paragraph p2 = new Paragraph(value, vf);
        p2.setAlignment(Element.ALIGN_CENTER);
        c.addElement(p2);
        
        return c;
    }

    private Paragraph metricRow(String label, String value) {
        Paragraph p = new Paragraph();
        p.add(new Chunk(label + ": ", F_LABEL));
        p.add(new Chunk(value, F_VALUE));
        p.setSpacingBefore(2);
        return p;
    }

    private Element spacer(float h) {
        Paragraph p = new Paragraph(" ");
        p.setLeading(h);
        return p;
    }

    private static class PageDecorator extends PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            float w = document.getPageSize().getWidth();
            float h = document.getPageSize().getHeight();

            cb.setColorFill(C_LIME);
            cb.rectangle(0, 0, 4, h);
            cb.fill();

            cb.setColorFill(C_DARK);
            cb.rectangle(0, 0, w, 28);
            cb.fill();

            try {
                BaseFont bf = BaseFont.createFont(BaseFont.HELVETICA, BaseFont.CP1252, false);
                cb.beginText();
                cb.setFontAndSize(bf, 7);
                cb.setColorFill(C_GREY);
                cb.showTextAligned(Element.ALIGN_LEFT, "alertixAI PERFORMANCE REPORT", document.leftMargin(), 10, 0);
                cb.showTextAligned(Element.ALIGN_RIGHT, "Page " + writer.getPageNumber(), w - document.rightMargin(), 10, 0);
                cb.endText();
            } catch (Exception e) {}
        }
    }
}
