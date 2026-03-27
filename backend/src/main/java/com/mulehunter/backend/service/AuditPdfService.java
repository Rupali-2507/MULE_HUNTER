package com.mulehunter.backend.service;

import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.mulehunter.backend.DTO.StatsResponse;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Service
public class AuditPdfService {

    // ── Brand colours ─────────────────────────────────────────────
    private static final Color C_LIME    = new Color(0xCA, 0xFF, 0x33);   // #CAFF33
    private static final Color C_BLACK   = new Color(0x08, 0x08, 0x08);
    private static final Color C_DARK    = new Color(0x12, 0x12, 0x12);
    private static final Color C_CARD    = new Color(0x1A, 0x1A, 0x1A);
    private static final Color C_BORDER  = new Color(0x2A, 0x2A, 0x2A);
    private static final Color C_WHITE   = new Color(0xF0, 0xF0, 0xF0);
    private static final Color C_GREY    = new Color(0x88, 0x88, 0x88);
    private static final Color C_RED     = new Color(0xEF, 0x44, 0x44);
    private static final Color C_ORANGE  = new Color(0xFB, 0x92, 0x3C);
    private static final Color C_BLUE    = new Color(0x60, 0xA5, 0xFA);

    // ── Fonts (Helvetica — universally embedded) ──────────────────
    private static final Font F_DISPLAY  = new Font(Font.HELVETICA, 28, Font.BOLD,   C_WHITE);
    private static final Font F_TITLE    = new Font(Font.HELVETICA, 18, Font.BOLD,   C_WHITE);
    private static final Font F_SECTION  = new Font(Font.HELVETICA, 11, Font.BOLD,   C_LIME);
    private static final Font F_LABEL    = new Font(Font.HELVETICA,  8, Font.BOLD,   C_GREY);
    private static final Font F_VALUE    = new Font(Font.HELVETICA, 14, Font.BOLD,   C_WHITE);
    private static final Font F_BODY     = new Font(Font.HELVETICA,  9, Font.NORMAL, C_GREY);
    private static final Font F_BODY_W   = new Font(Font.HELVETICA,  9, Font.NORMAL, C_WHITE);
    private static final Font F_MONO     = new Font(Font.COURIER,    8, Font.NORMAL, C_GREY);
    private static final Font F_MONO_W   = new Font(Font.COURIER,    8, Font.NORMAL, C_WHITE);
    private static final Font F_BADGE    = new Font(Font.HELVETICA,  7, Font.BOLD,   C_BLACK);
    private static final Font F_CRIT     = new Font(Font.HELVETICA,  8, Font.BOLD,   C_RED);
    private static final Font F_HIGH     = new Font(Font.HELVETICA,  8, Font.BOLD,   C_ORANGE);
    private static final Font F_STABLE   = new Font(Font.HELVETICA,  8, Font.BOLD,   C_LIME);

    // ─────────────────────────────────────────────────────────────
    public byte[] generate(StatsResponse stats) {
        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {

            Document doc = new Document(PageSize.A4, 40, 40, 50, 50);
            PdfWriter writer = PdfWriter.getInstance(doc, baos);

            // Page-event handler: header bar + footer on every page
            writer.setPageEvent(new PageDecorator());

            doc.open();
            addContent(doc, writer, stats);
            doc.close();

            return baos.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate audit PDF", e);
        }
    }

    // ─── Content ──────────────────────────────────────────────────
    private void addContent(Document doc, PdfWriter writer, StatsResponse stats) throws Exception {

        String generatedAt = ZonedDateTime.now(ZoneOffset.UTC)
                .format(DateTimeFormatter.ofPattern("dd MMM yyyy  HH:mm:ss 'UTC'"));

        PdfContentByte cb = writer.getDirectContent();
        float pw = doc.getPageSize().getWidth()  - doc.leftMargin() - doc.rightMargin();

        // ══════════════════════════════════════════════════════════
        // SECTION 1 — COVER
        // ══════════════════════════════════════════════════════════

        // Full-page dark background
        cb.setColorFill(C_BLACK);
        cb.rectangle(0, 0, doc.getPageSize().getWidth(), doc.getPageSize().getHeight());
        cb.fill();

        // Lime accent bar (left edge)
        cb.setColorFill(C_LIME);
        cb.rectangle(0, 0, 6, doc.getPageSize().getHeight());
        cb.fill();

        // Logo wordmark
        Paragraph logo = new Paragraph("MULE HUNTER", F_DISPLAY);
        logo.setAlignment(Element.ALIGN_LEFT);
        logo.setSpacingBefore(60);
        doc.add(logo);

        // Subtitle
        Paragraph sub = new Paragraph("Transaction Fraud Detection Platform", F_BODY);
        sub.setSpacingBefore(4);
        doc.add(sub);

        // Horizontal rule
        doc.add(hRule(pw, C_LIME, 0.5f));
        doc.add(spacer(8));

        // Report title
        Paragraph rt = new Paragraph("NETWORK PERFORMANCE AUDIT", F_TITLE);
        rt.setSpacingBefore(4);
        doc.add(rt);

        Paragraph gen = new Paragraph("Generated: " + generatedAt, F_MONO);
        gen.setSpacingBefore(6);
        doc.add(gen);

        doc.add(spacer(16));

        // CONFIDENTIAL badge
        PdfPTable badge = new PdfPTable(1);
        badge.setWidthPercentage(30);
        badge.setHorizontalAlignment(Element.ALIGN_LEFT);
        PdfPCell bc = cell("  CONFIDENTIAL — INTERNAL USE ONLY  ", F_BADGE, C_LIME, C_BLACK);
        bc.setPadding(5);
        badge.addCell(bc);
        doc.add(badge);

        doc.add(spacer(20));

        // Quick-stats strip on cover
        doc.add(sectionHeader("AT A GLANCE", pw));
        doc.add(spacer(6));
        doc.add(kpiStrip(stats, pw));
        doc.add(spacer(20));
        
        // ══════════════════════════════════════════════════════════
        // SECTION 2 — DETECTION PERFORMANCE
        // ══════════════════════════════════════════════════════════
        doc.add(sectionHeader("DETECTION PERFORMANCE", pw));
        doc.add(spacer(6));

        PdfPTable det = new PdfPTable(new float[]{ 1, 1, 1 });
        det.setWidthPercentage(100);
        det.setSpacingBefore(4);

        double accuracy = stats.detectionAccuracy * 100;
        double fpr      = stats.falsePositiveRate  * 100;
        double variance = stats.targetVariance      * 100;

        det.addCell(metricCard("GNN PRECISION", String.format("%.2f%%", accuracy),
                accuracy >= 95 ? C_LIME : accuracy >= 80 ? new Color(250,204,21) : C_RED));
        det.addCell(metricCard("FALSE POSITIVE RATE",
                String.format("%.4f%%", fpr), fpr <= 0.1 ? C_LIME : C_ORANGE));
        det.addCell(metricCard("TARGET VARIANCE",
                "< " + String.format("%.1f%%", variance), C_BLUE));
        doc.add(det);

        doc.add(spacer(8));

        // Model ensemble badges
        PdfPTable models = new PdfPTable(new float[]{ 1, 1, 1, 1 });
        models.setWidthPercentage(100);
        models.setSpacingBefore(4);
        for (String[] m : new String[][]{
                { "GNN v2.1",       "Graph Neural Network · primary classifier"      },
                { "EIF Ensemble",   "Extended Isolation Forest · anomaly detection"  },
                { "Unsupervised",   "Cluster-based unsupervised mule detection"      },
                { "JA3 Fingerprint","Bot/automation device fingerprint analysis"     },
        }) {
            PdfPCell mc = new PdfPCell();
            mc.setBackgroundColor(C_CARD);
            mc.setBorderColor(C_BORDER);
            mc.setBorderWidth(0.5f);
            mc.setPadding(8);
            mc.addElement(new Paragraph(m[0], F_SECTION));
            mc.addElement(new Paragraph(m[1], F_BODY));
            models.addCell(mc);
        }
        doc.add(models);
        doc.add(spacer(20));

        // ══════════════════════════════════════════════════════════
        // SECTION 3 — ENFORCEMENT DISTRIBUTION
        // ══════════════════════════════════════════════════════════
        doc.add(sectionHeader("ENFORCEMENT DISTRIBUTION", pw));
        doc.add(spacer(6));

        long blocked    = stats.muleAccountsBlocked;
        long inReview   = Math.round(blocked * (stats.flaggedForReviewPct / (stats.accountsFrozenPct > 0 ? stats.accountsFrozenPct : 100.0)));
        long referred   = Math.round(blocked * (stats.policeReferralsPct  / 100.0));

        PdfPTable enf = twoColTable(pw);
        enf.addCell(labelCell("CATEGORY"));
        enf.addCell(labelCell("PERCENTAGE"));
        enf.addCell(labelCell("ACCOUNT COUNT"));
        enf.addCell(labelCell("ACTION"));

        addEnfRow(enf, "Accounts Frozen",    stats.accountsFrozenPct,   blocked,  "Account freeze + asset hold", C_LIME);
        addEnfRow(enf, "Flagged for Review", stats.flaggedForReviewPct, inReview, "Manual investigator review",  new Color(234,179,8));
        addEnfRow(enf, "Police Referrals",   stats.policeReferralsPct,  referred, "FIR filing + LEA referral",   C_RED);

        doc.add(enf);
        doc.add(spacer(8));

        // Bar chart visual (drawn via canvas)
        drawBarChart(cb, doc, stats, pw);
        doc.add(spacer(20));

        // ══════════════════════════════════════════════════════════
        // SECTION 4 — OPERATIONAL METRICS
        // ══════════════════════════════════════════════════════════
        doc.add(sectionHeader("OPERATIONAL METRICS", pw));
        doc.add(spacer(6));

        // Derive txDisplay
        String txDisplay;
        long total = stats.totalTransactions;
        if (total >= 1_000_000) txDisplay = String.format("%.2fM", total / 1_000_000.0);
        else if (total >= 1_000) txDisplay = String.format("%.1fK", total / 1_000.0);
        else                     txDisplay = String.valueOf(total);

        PdfPTable ops = new PdfPTable(new float[]{ 1, 1 });
        ops.setWidthPercentage(100);
        ops.setSpacingBefore(4);

        String[][] opRows = {
            { "Value Intercepted",      String.format("Rs. %.2f Cr", stats.valueInterceptedCrores) },
            { "Avg Detection Latency",  String.format("%.0f ms",  stats.avgDetectionLatencyMs) },
            { "System Throughput",      String.format("%,d TPS",   stats.throughputTps) },
            { "Transactions Analysed",  txDisplay },
            { "Mule Accounts Blocked",  String.format("%,d total · %,d / day avg", blocked, stats.muleAccountsBlockedToday) },
            { "Max System Scalability", String.format("%.0fM transactions / day", stats.maxScalabilityMDay) },
        };

        for (String[] row : opRows) {
            PdfPCell lc = new PdfPCell(new Phrase(row[0], F_LABEL));
            lc.setBackgroundColor(C_DARK);
            lc.setBorderColor(C_BORDER);
            lc.setBorderWidth(0.5f);
            lc.setPadding(9);

            PdfPCell vc = new PdfPCell(new Phrase(row[1], F_VALUE));
            vc.setBackgroundColor(C_CARD);
            vc.setBorderColor(C_BORDER);
            vc.setBorderWidth(0.5f);
            vc.setPadding(9);
            vc.setHorizontalAlignment(Element.ALIGN_RIGHT);

            ops.addCell(lc);
            ops.addCell(vc);
        }
        doc.add(ops);
        doc.add(spacer(20));

        // ══════════════════════════════════════════════════════════
        // SECTION 5 — LIVE THREAT EVENTS
        // ══════════════════════════════════════════════════════════
        doc.add(sectionHeader("LIVE THREAT EVENTS", pw));
        doc.add(spacer(6));

        PdfPTable events = new PdfPTable(new float[]{ 0.8f, 2.8f, 1f, 0.8f });
        events.setWidthPercentage(100);
        events.setSpacingBefore(4);

        for (String h : new String[]{ "TIME (UTC)", "EVENT", "ACCOUNT", "SEVERITY" }) {
            events.addCell(labelCell(h));
        }

        List<StatsResponse.LiveEvent> liveEvents = stats.liveEvents;
        if (liveEvents != null) {
            for (StatsResponse.LiveEvent ev : liveEvents) {
                Font sevFont = "CRITICAL".equals(ev.severity) ? F_CRIT :
                               "HIGH".equals(ev.severity)     ? F_HIGH :
                               "STABLE".equals(ev.severity)   ? F_STABLE : F_BODY_W;

                events.addCell(eventCell(ev.time,       F_MONO_W));
                events.addCell(eventCell(ev.message,    F_BODY_W));
                events.addCell(eventCell(ev.accountId,  F_MONO));
                events.addCell(eventCell(ev.severity,   sevFont));
            }
        }
        doc.add(events);
        doc.add(spacer(20));

        // ══════════════════════════════════════════════════════════
        // SECTION 6 — METHODOLOGY & DISCLAIMER
        // ══════════════════════════════════════════════════════════
        doc.add(sectionHeader("METHODOLOGY & DISCLAIMER", pw));
        doc.add(spacer(6));

        String[] paras = {
            "Detection accuracy (GNN Precision) is computed as TP / (TP + FP) from the most recent " +
            "model_performance_metrics evaluation run. When evaluation data is unavailable, precision " +
            "is derived from the average GNN score across fraud-labelled transactions in the live " +
            "transaction corpus.",

            "False Positive Rate is computed as FP / (FP + TN). For operational datasets, this is " +
            "approximated using transactions with riskScore < 0.30 as the negative class proxy.",

            "Enforcement percentages are computed from the live transactions collection. " +
            "Police Referral threshold is riskScore >= 0.90 (RBI AML Circular 2022 alignment). " +
            "If no transactions breach 0.90, a soft threshold of 0.85 is applied.",

            "Value Intercepted is the sum of transaction amounts for all BLOCK-decision transactions. " +
            "Where amount data is unavailable, a conservative estimate of Rs. 18,500 per blocked " +
            "transaction is applied (median UPI transaction size, NPCI FY2024).",

            "CONFIDENTIAL: This document is generated automatically from live system data and is " +
            "intended for internal use and regulatory compliance only. Do not distribute externally " +
            "without authorisation from the MULE HUNTER system administrator.",
        };

        for (String p : paras) {
            Paragraph para = new Paragraph(p, F_BODY);
            para.setLeading(13);
            para.setSpacingBefore(5);
            doc.add(para);
        }
    }

    // ─── KPI strip (cover page) ───────────────────────────────────
    private PdfPTable kpiStrip(StatsResponse s, float pw) {
        PdfPTable t = new PdfPTable(new float[]{ 1, 1, 1, 1 });
        t.setWidthPercentage(100);
        t.addCell(metricCard("THROUGHPUT",       String.format("%,d TPS", s.throughputTps),              C_LIME));
        t.addCell(metricCard("LATENCY",          String.format("%.0f ms", s.avgDetectionLatencyMs),      C_BLUE));
        t.addCell(metricCard("MULE ACCS BLOCKED",String.format("%,d",     s.muleAccountsBlocked),        C_RED));
        t.addCell(metricCard("SCALABILITY",      String.format("%,.0f TX/day", s.systemScalabilityTxDay), C_LIME));
        return t;
    }

    // ─── Enforcement row ──────────────────────────────────────────
    private void addEnfRow(PdfPTable t, String label, double pct, long count, String action, Color barColor) {
        t.addCell(dataCell(label,                      C_DARK,  F_BODY_W));
        t.addCell(dataCell(String.format("%.2f%%", pct), C_CARD, pctFont(pct, barColor)));
        t.addCell(dataCell(String.format("%,d", count), C_DARK,  F_VALUE));
        t.addCell(dataCell(action,                     C_CARD,  F_BODY));
    }

    private Font pctFont(double pct, Color c) {
        Font f = new Font(Font.HELVETICA, 10, Font.BOLD, c);
        return f;
    }

    // ─── Bar chart drawn directly on canvas ──────────────────────
    private void drawBarChart(PdfContentByte cb, Document doc, StatsResponse s, float pw)
            throws Exception {
        // We add an empty paragraph to get the current vertical position,
        // then draw the chart bars below it.
        doc.add(spacer(4));

        float chartH   = 14f;
        float chartY   = 0;  // relative; we use a positioned table instead
        float barTotal = pw * 0.70f;

        PdfPTable bars = new PdfPTable(new float[]{ 0.25f, 0.75f });
        bars.setWidthPercentage(100);

        double[] pcts   = { s.accountsFrozenPct, s.flaggedForReviewPct, s.policeReferralsPct };
        String[] labels = { "Accounts Frozen", "Flagged for Review", "Police Referrals" };
        Color[] colors  = { C_LIME, new Color(234,179,8), C_RED };

        for (int i = 0; i < 3; i++) {
            // Label cell
            PdfPCell lc = new PdfPCell(new Phrase(labels[i], F_LABEL));
            lc.setBorder(Rectangle.NO_BORDER);
            lc.setPaddingTop(4);
            lc.setPaddingBottom(4);
            bars.addCell(lc);

            // Bar cell with nested 2-col table (bar + pct)
            PdfPTable inner = new PdfPTable(new float[]{ (float) pcts[i] / 100f, 1 - (float) pcts[i] / 100f });
            inner.setWidthPercentage(100);

            PdfPCell filled = new PdfPCell(new Phrase(String.format(" %.1f%%", pcts[i]), F_BADGE));
            filled.setBackgroundColor(colors[i]);
            filled.setBorder(Rectangle.NO_BORDER);
            filled.setFixedHeight(chartH);
            filled.setVerticalAlignment(Element.ALIGN_MIDDLE);
            inner.addCell(filled);

            PdfPCell empty = new PdfPCell();
            empty.setBackgroundColor(C_DARK);
            empty.setBorder(Rectangle.NO_BORDER);
            empty.setFixedHeight(chartH);
            inner.addCell(empty);

            PdfPCell bc = new PdfPCell(inner);
            bc.setBorder(Rectangle.NO_BORDER);
            bc.setPadding(2);
            bars.addCell(bc);
        }
        doc.add(bars);
    }

    // ─── Section header ───────────────────────────────────────────
    private Element sectionHeader(String title, float pw) throws Exception {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        t.setSpacingBefore(8);
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

    // ─── Metric card ──────────────────────────────────────────────
    private PdfPCell metricCard(String label, String value, Color accent) {
        PdfPCell c = new PdfPCell();
        c.setBackgroundColor(C_CARD);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(10);
        Font valFont = new Font(Font.HELVETICA, 16, Font.BOLD, accent);
        c.addElement(new Paragraph(label, F_LABEL));
        c.addElement(new Paragraph(value, valFont));
        return c;
    }

    // ─── Table helpers ────────────────────────────────────────────
    private PdfPTable twoColTable(float pw) {
        PdfPTable t = new PdfPTable(new float[]{ 1.2f, 1f, 0.8f, 1.5f });
        t.setWidthPercentage(100);
        t.setSpacingBefore(4);
        return t;
    }

    private PdfPCell labelCell(String text) {
        PdfPCell c = new PdfPCell(new Phrase(text, F_LABEL));
        c.setBackgroundColor(new Color(0x0E, 0x0E, 0x0E));
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(7);
        return c;
    }

    private PdfPCell dataCell(String text, Color bg, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text, font));
        c.setBackgroundColor(bg);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(7);
        return c;
    }

    private PdfPCell eventCell(String text, Font font) {
        PdfPCell c = new PdfPCell(new Phrase(text != null ? text : "—", font));
        c.setBackgroundColor(C_DARK);
        c.setBorderColor(C_BORDER);
        c.setBorderWidth(0.5f);
        c.setPadding(6);
        return c;
    }

    private PdfPCell cell(String text, Font font, Color bg, Color fg) {
        Font f = new Font(font.getFamily(), font.getSize(), font.getStyle(), fg);
        PdfPCell c = new PdfPCell(new Phrase(text, f));
        c.setBackgroundColor(bg);
        c.setBorder(Rectangle.NO_BORDER);
        return c;
    }

    private Element hRule(float pw, Color color, float width) throws Exception {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        t.setSpacingBefore(6);
        t.setSpacingAfter(6);
        PdfPCell c = new PdfPCell();
        c.setFixedHeight(width == 0.5f ? 1f : 2f);
        c.setBackgroundColor(color);
        c.setBorder(Rectangle.NO_BORDER);
        t.addCell(c);
        return t;
    }

    private Element spacer(float h) {
        Paragraph p = new Paragraph(" ");
        p.setLeading(h);
        return p;
    }

    // ─── Page decorator (header bar + footer) ─────────────────────
    private static class PageDecorator extends PdfPageEventHelper {
    @Override
    public void onEndPage(PdfWriter writer, Document document) {

        PdfContentByte cb = writer.getDirectContent();
        float w = document.getPageSize().getWidth();
        float h = document.getPageSize().getHeight();

        // Left accent
        cb.setColorFill(new Color(0xCA, 0xFF, 0x33));
        cb.rectangle(0, 0, 4, h);
        cb.fill();

        // Footer bar
        cb.setColorFill(new Color(0x12, 0x12, 0x12));
        cb.rectangle(0, 0, w, 28);
        cb.fill();

        try {
            BaseFont bf = BaseFont.createFont(
                    BaseFont.HELVETICA,
                    BaseFont.CP1252,
                    false
            );

            cb.beginText();

            // ✅ MUST be before ANY text
            cb.setFontAndSize(bf, 7);

            cb.setColorFill(new Color(0x66, 0x66, 0x66));

            // Left text
            cb.showTextAligned(
                    Element.ALIGN_LEFT,
                    "MULE HUNTER · NETWORK PERFORMANCE AUDIT · CONFIDENTIAL",
                    document.leftMargin(),
                    10,
                    0
            );

            // Right text
            cb.showTextAligned(
                    Element.ALIGN_RIGHT,
                    "Page " + writer.getPageNumber(),
                    w - document.rightMargin(),
                    10,
                    0
            );

            cb.endText();

        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
}