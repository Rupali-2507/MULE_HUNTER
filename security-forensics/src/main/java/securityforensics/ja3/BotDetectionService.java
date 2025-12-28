package securityforensics.ja3;

import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.HashMap;

@Service
public class BotDetectionService {
    private static final int THRESHOLD = 50;
    private ConcurrentHashMap<String, Integer> hitCounter = new ConcurrentHashMap<>();
    private ConcurrentHashMap<String, Long> firstSeen = new ConcurrentHashMap<>();
    private ConcurrentHashMap<String, Boolean> blockedList = new ConcurrentHashMap<>();
    
    public boolean isBot(String ja3) {
        firstSeen.putIfAbsent(ja3, System.currentTimeMillis());
        int count = hitCounter.merge(ja3, 1, Integer::sum);
        
        if (count > THRESHOLD) {
            blockedList.put(ja3, true);
            System.out.println("🚨 BOT BLOCKED: " + ja3 + " (Hits: " + count + ")");
            return true;
        }
        
        return false;
    }
    
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("uniqueFingerprints", hitCounter.size());
        stats.put("blockedBots", blockedList.size());
        stats.put("totalRequests", hitCounter.values().stream().mapToInt(Integer::intValue).sum());
        stats.put("details", hitCounter);
        return stats;
    }
}
