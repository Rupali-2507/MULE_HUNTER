package securityforensics;

import securityforensics.blockchain.*;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/security")
@CrossOrigin(origins = "*")
public class SecurityController {

    private static final Blockchain blockchain = new Blockchain();

    @GetMapping("/blockchain")
    public Map<String, Object> getBlockchain() {
        Map<String, Object> response = new HashMap<>();
        response.put("chain", blockchain.chain);
        response.put("totalBlocks", blockchain.chain.size());

        int totalLogs = blockchain.chain.stream()
                .mapToInt(block -> block.logs.size())
                .sum();
        response.put("totalFraudLogs", totalLogs);

        return response;
    }

    @PostMapping("/log-fraud")
    public Map<String, Object> logFraud(@RequestBody FraudRequest request) {
        System.out.println("Logging fraud: " + request.txId);

        FraudLog log = new FraudLog(
                request.txId,
                request.accountId,
                request.amount,
                true
        );

        blockchain.addBlock(List.of(log));

        Block latest = blockchain.chain.get(blockchain.chain.size() - 1);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "logged");
        response.put("blockIndex", latest.index);
        response.put("blockHash", latest.hash);

        System.out.println("Fraud logged to Block #" + latest.index);

        return response;
    }

    @PostMapping("/test-fraud")
    public String testFraud() {
        FraudLog log = new FraudLog(
                "TX_" + System.currentTimeMillis(),
                "ACC_TEST",
                5000.0,
                true
        );

        blockchain.addBlock(List.of(log));
        return "Test fraud logged!";
    }
}

class FraudRequest {
    public String txId;
    public String accountId;
    public double amount;
}
