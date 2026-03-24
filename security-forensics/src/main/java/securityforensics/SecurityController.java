package securityforensics;

import securityforensics.blockchain.*;
import securityforensics.ja3.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@RestController
@RequestMapping("/api/security")
@CrossOrigin(origins = "*")
public class SecurityController {

    @Autowired
    private BotDetectionService botService;

    @Autowired
    private IdentityProfileStore profileStore;

    private static final Blockchain blockchain = new Blockchain();

    // ─────────────────────────────────────────────────────────────────────────
    // HEALTH
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/status")
    public Map<String, String> getStatus() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "security-forensics");
        response.put("port", "8081");
        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENDPOINT 1: JA3 BOT DETECTION (existing — kept as-is)
    // Called by: Spring Boot backend Ja3SecurityService
    // Returns: ja3Risk score (velocity + fanout based)
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/ja3-risk")
    public Map<String, Object> evaluateJA3(
            @RequestBody JA3Request requestBody,
            HttpServletRequest request
    ) {
        String ja3 = request.getHeader("X-JA3-Fingerprint");
        if (ja3 == null) ja3 = requestBody.ja3Fingerprint; // fallback to body

        System.out.println("🛡️  JA3 BOT CHECK: ja3=" + ja3 + " account=" + requestBody.accountId);

        JA3RiskResult result = botService.evaluate(ja3, requestBody.accountId);

        Map<String, Object> response = new HashMap<>();
        boolean isBlocked = result.ja3Risk > 0.8;

        response.put("ja3", ja3);
        response.put("ja3Risk", result.ja3Risk);
        response.put("velocity", result.velocity);
        response.put("fanout", result.fanout);

        response.put("blocked", isBlocked);
        response.put("action", isBlocked ? "BLOCK_REQUEST" : "ALLOW");
        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENDPOINT 2: IDENTITY FORENSICS (NEW — this is what was missing)
    // Called by: Spring Boot backend (Step 3 of pipeline)
    // Returns: full identityFeatures block per architecture doc
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/identity-forensics")
    public Map<String, Object> identityForensics(
            @RequestBody IdentityForensicsRequest req,
            HttpServletRequest httpRequest
    ) {
        // Step 1 — Normalize & canonicalize
        String ja3         = req.ja3Fingerprint != null ? req.ja3Fingerprint.toLowerCase().trim() : null;
        String deviceHash  = sha256(req.deviceId != null ? req.deviceId : "unknown");
        String ip          = req.ipAddress != null ? req.ipAddress.trim() : null;
        String geoCountry  = req.geoCountry != null ? req.geoCountry.toUpperCase() : null;

        System.out.println("🔍 IDENTITY FORENSICS: account=" + req.accountId
                + " ja3=" + (ja3 != null ? ja3.substring(0, Math.min(20, ja3.length())) + "..." : "null")
                + " device=" + deviceHash.substring(0, 8) + "..."
                + " ip=" + ip);

        // Step 2 — Compute forensic signals
        IdentityForensicResult forensics = profileStore.record(
                req.accountId, ja3, deviceHash, ip,
                geoCountry,
                req.accountKnownCountry
        );

        // Step 3 — Bot risk check (bonus signal)
        JA3RiskResult botResult = botService.evaluate(ja3, req.accountId);

        // Step 4 — Build response matching architecture doc exactly

        double finalRisk = (
        botResult.ja3Risk * 0.4 +
        forensics.ja3ReuseCount * 0.2 +
        forensics.deviceReuseCount * 0.2 +
        (forensics.geoMismatch ? 0.2 : 0)
        );

        String decision = finalRisk > 0.7 ? "BLOCK" : "ALLOW";
        Map<String, Object> identityFeatures = new LinkedHashMap<>();
        identityFeatures.put("ja3ReuseCount",    forensics.ja3ReuseCount);
        identityFeatures.put("deviceReuseCount", forensics.deviceReuseCount);
        identityFeatures.put("ipReuseCount",     forensics.ipReuseCount);
        identityFeatures.put("geoMismatch",      forensics.geoMismatch);
        identityFeatures.put("isNewDevice",      forensics.isNewDevice);
        identityFeatures.put("isNewJa3",         forensics.isNewJa3);

        // Extra bot signals (bonus, not in original spec but useful)
        identityFeatures.put("ja3Risk",          botResult.ja3Risk);
        identityFeatures.put("ja3Velocity",      botResult.velocity);
        identityFeatures.put("ja3Fanout",        botResult.fanout);

        Map<String, Object> identityMetadata = new LinkedHashMap<>();
        identityMetadata.put("ja3FirstSeen",     forensics.isNewJa3);
        identityMetadata.put("deviceFirstSeen",  forensics.isNewDevice);
        identityMetadata.put("normalizedJa3",    ja3);
        identityMetadata.put("deviceHash",       deviceHash);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("identityFeatures", identityFeatures);
        response.put("identityMetadata", identityMetadata);
        response.put("finalRisk", finalRisk);
        response.put("decision", decision);

        boolean geoBlocked = forensics.geoMismatch && botResult.ja3Risk > 0.6;
        response.put("geoBlocked", geoBlocked);

        System.out.println("✅ IDENTITY FORENSICS DONE: ja3Reuse=" + forensics.ja3ReuseCount
                + " deviceReuse=" + forensics.deviceReuseCount
                + " geoMismatch=" + forensics.geoMismatch);

        // ───────────────── AUTO LOG TO BLOCKCHAIN ─────────────────
        if (!decision.equals("ALLOW")) {
            FraudLog log = new FraudLog(
                    req.transactionId != null ? req.transactionId : UUID.randomUUID().toString(),
                    req.accountId,
                    0.0, // amount unknown here
                    finalRisk,
                    decision,
                    "mock-eif-v1",
                    "mock-gnn-v1"
            );

            blockchain.addLog(log);

            System.out.println("📦 AUTO-LOGGED TO BLOCKCHAIN: " + log.txId);
        }

        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENDPOINT 3: LOG FRAUD DECISION → BLOCKCHAIN
    // Called by: Spring Boot backend (async, after response returned)
    // Payload: full fraud decision per architecture doc
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/log-fraud")
    public Map<String, Object> logFraud(@RequestBody FraudDecisionRequest req) {
        System.out.println("⛓️  BLOCKCHAIN LOG: txId=" + req.txId
                + " decision=" + req.decision
                + " riskScore=" + req.riskScore);

        FraudLog log = new FraudLog(
                req.txId,
                req.accountId,
                req.amount,
                req.riskScore,
                req.decision != null ? req.decision : "UNKNOWN",
                req.modelVersionEIF != null ? req.modelVersionEIF : "unknown",
                req.modelVersionGNN != null ? req.modelVersionGNN : "unknown"
        );

        blockchain.addLog(log);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "queued");
        response.put("pendingLogs", blockchain.getPendingCount());
        response.put("totalBlocks", blockchain.chain.size());
        response.put("decisionHash", log.decisionHash);
        return response;
    }


    @PostMapping("/blockchain/tamper")
    public Map<String, Object> tamperChain() {
        if (blockchain.chain.size() > 1) {
            Block block = blockchain.chain.get(1);

            if (!block.logs.isEmpty()) {
                block.logs.get(0).decision = "HACKED"; // simulate tampering
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "tampered");
        return response;
    }

    @PostMapping("/simulate-attack")
    public Map<String, Object> simulateAttack() {
        String fakeJA3 = "botnet-script";

        for (int i = 0; i < 50; i++) {
            botService.evaluate(fakeJA3, "acc_" + i);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "attack simulated");
        response.put("ja3", fakeJA3);
        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENDPOINT 4: VIEW BLOCKCHAIN
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/blockchain")
    public Map<String, Object> getBlockchain() {
        int totalLogs = blockchain.chain.stream()
                .mapToInt(block -> block.logs.size())
                .sum();

        Map<String, Object> response = new HashMap<>();
        response.put("chain", blockchain.chain);
        response.put("totalBlocks", blockchain.chain.size());
        response.put("pendingLogs", blockchain.getPendingCount());
        response.put("totalFraudLogs", totalLogs);
        return response;
    }

    // ── ENDPOINT: Verify blockchain integrity ──────────────────────────
    @GetMapping("/blockchain/verify")
    public Map<String, Object> verifyChain() {
        boolean valid = true;
        String reason = "Chain is intact";

        for (int i = 1; i < blockchain.chain.size(); i++) {
            Block current  = blockchain.chain.get(i);
            Block previous = blockchain.chain.get(i - 1);

            // Check block's own hash
            if (!current.isValid()) {
                valid  = false;
                reason = "Block #" + i + " hash is invalid (tampered!)";
                break;
            }

            // Check chain linkage
            if (!current.previousHash.equals(previous.hash)) {
                valid  = false;
                reason = "Block #" + i + " broken link (chain tampered!)";
                break;
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("valid",       valid);
        response.put("reason",      reason);
        response.put("totalBlocks", blockchain.chain.size());
        response.put("totalLogs",   blockchain.chain.stream().mapToInt(b -> b.logs.size()).sum());
        return response;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENDPOINT 5: FORCE BLOCK (demo use)
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/force-block")
    public Map<String, Object> forceBlock() {
        blockchain.forceBlock();
        Block latest = blockchain.chain.get(blockchain.chain.size() - 1);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "forced");
        response.put("blockIndex", latest.index);
        response.put("blockHash", latest.hash);
        response.put("merkleRoot", latest.merkleRoot);
        response.put("logsInBlock", latest.logs.size());
        return response;
    }

    

    // ─────────────────────────────────────────────────────────────────────────
    // UTIL
    // ─────────────────────────────────────────────────────────────────────────

    private String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "hash-error";
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST DTOs
// ─────────────────────────────────────────────────────────────────────────────

class JA3Request {
    public String accountId;
    public String txId;
    public String ja3Fingerprint; // fallback if header not present
}

class IdentityForensicsRequest {
    public String transactionId;
    public String accountId;          // sourceAccountId
    public String ja3Fingerprint;
    public String deviceId;
    public String ipAddress;
    public String userAgent;
    public String geoCountry;         // country from current request
    public String geoCity;
    public String accountKnownCountry; // account's registered country (for geo mismatch)
}

class FraudDecisionRequest {
    public String txId;
    public String accountId;
    public double amount;
    public double riskScore;
    public String decision;           // APPROVE / REVIEW / BLOCK
    public String modelVersionEIF;
    public String modelVersionGNN;
    public String timestamp;
}