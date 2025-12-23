//blocks bots on based on no. of hits it make(50)

package securityforensics.ja3;

import java.util.concurrent.ConcurrentHashMap;

public class BotDetectionService {

    private static final int THRESHOLD = 50;  //after 50 req, bots will be blocked
    private ConcurrentHashMap<String, Integer> hitCounter = new ConcurrentHashMap<>();

    public boolean isBot(String ja3) {
        hitCounter.put(ja3, hitCounter.getOrDefault(ja3, 0) + 1);
        return hitCounter.get(ja3) > THRESHOLD;
    }
}
