package securityforensics;

import securityforensics.blockchain.*;
import securityforensics.ja3.BotDetectionService;
import securityforensics.ja3.JA3RiskResult;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;

import java.util.*;

@RestController
@RequestMapping("/api/security")
@CrossOrigin(origins = "*")
public class SecurityController {
    
    @Autowired
    private BotDetectionService botService;
    
    private static final Blockchain blockchain = new Blockchain();
    // Health
    @GetMapping("/status")
    public Map<String, String> getStatus() {
        Map<String, String> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "security-forensics");
        response.put("port", "8080");
        return response;
    }
    // JA3 RISK
    @PostMapping("/ja3-risk")
    public Map<String, Object> evaluateJA3(
            @RequestBody FraudRequest requestBody,
            HttpServletRequest request
    ) {
        // ✅ READ FROM HEADER, NOT ATTRIBUTE
        String ja3 = request.getHeader("X-JA3-Fingerprint");

        System.out.println("🛡️ SECURITY RECEIVED JA3 = " + ja3);

        JA3RiskResult result = botService.evaluate(
                ja3,
                requestBody.accountId
        );

        Map<String, Object> response = new HashMap<>();
        response.put("ja3", ja3);
        response.put("ja3Risk", result.ja3Risk);
        response.put("velocity", result.velocity);
        response.put("fanout", result.fanout);

        return response;
    }

    //  BLOCKCHAIN
    @GetMapping("/blockchain")
    public Map<String, Object> getBlockchain() {
        Map<String, Object> response = new HashMap<>();
        response.put("chain", blockchain.chain);
        response.put("totalBlocks", blockchain.chain.size());
        response.put("pendingLogs", blockchain.getPendingCount());
        
        int totalLogs = blockchain.chain.stream()
                .mapToInt(block -> block.logs.size())
                .sum();
        response.put("totalFraudLogs", totalLogs);
        
        return response;
    }
    
    @PostMapping("/log-fraud")
    public Map<String, Object> logFraud(@RequestBody FraudRequest request) {
        System.out.println("🚨 Logging fraud: " + request.txId);
        
        FraudLog log = new FraudLog(
            request.txId,
            request.accountId,
            request.amount,
            true
        );
        
        blockchain.addLog(log);  
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "queued");
        response.put("pendingLogs", blockchain.getPendingCount());
        response.put("totalBlocks", blockchain.chain.size());
        
        return response;
    }
    
    @PostMapping("/force-block")
    public Map<String, Object> forceBlock() {
        blockchain.forceBlock();
        Block latest = blockchain.chain.get(blockchain.chain.size() - 1);
        
        Map<String, Object> response = new HashMap<>();
        response.put("status", "forced");
        response.put("blockIndex", latest.index);
        response.put("blockHash", latest.hash);
        response.put("logsInBlock", latest.logs.size());
        
        return response;
    }
    
    @PostMapping("/test-fraud")
    public Map<String, String> testFraud() {
        FraudLog log = new FraudLog(
            "TX_" + System.currentTimeMillis(),
            "ACC_TEST",
            5000.0,
            true
        );
        
        blockchain.addLog(log);
        
        Map<String, String> response = new HashMap<>();
        response.put("status", "logged");
        response.put("message", "Test fraud queued. Pending: " + blockchain.getPendingCount());
        
        return response;
    }
}
// DTO
class FraudRequest {
    public String txId;
    public String accountId;
    public double amount;
}