package securityforensics.ja3;

import org.springframework.stereotype.Service;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class BotDetectionService {

    private static final int VELOCITY_THRESHOLD = 50;
    private static final int FANOUT_THRESHOLD = 20;
    private static final long WINDOW_MS = 5 * 60 * 1000; // 5 minutes

    private final ConcurrentHashMap<String, AtomicInteger> hitCounter = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> accountFanout = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> windowStart = new ConcurrentHashMap<>();

    public JA3RiskResult evaluate(String ja3, String accountId) {

        if (ja3 == null) {
            return new JA3RiskResult(0.3, 0, 0);
        }

        long now = System.currentTimeMillis();

        windowStart.putIfAbsent(ja3, now);

        // 🔁 RESET WINDOW
        if (now - windowStart.get(ja3) > WINDOW_MS) {
            hitCounter.remove(ja3);
            accountFanout.remove(ja3);
            windowStart.put(ja3, now);
        }

        hitCounter.putIfAbsent(ja3, new AtomicInteger(0));
        accountFanout.putIfAbsent(ja3, ConcurrentHashMap.newKeySet());

        int velocity = hitCounter.get(ja3).incrementAndGet();

        if (accountId != null && !accountId.isBlank()) {
            accountFanout.get(ja3).add(accountId);
        }

        int fanout = accountFanout.get(ja3).size();

        double risk = 0.2;
        if (velocity > VELOCITY_THRESHOLD) risk += 0.3;
        if (fanout > FANOUT_THRESHOLD) risk += 0.4;

        return new JA3RiskResult(
                Math.min(risk, 1.0),
                velocity,
                fanout
        );
    }
}
