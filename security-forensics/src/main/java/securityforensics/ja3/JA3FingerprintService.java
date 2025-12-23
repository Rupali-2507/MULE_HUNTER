//identify bots

package securityforensics.ja3;

import jakarta.servlet.http.HttpServletRequest;

public class JA3FingerprintService {

    public String generateFingerprint(HttpServletRequest request) {
        String ua = request.getHeader("User-Agent");

        if (ua == null) return "JA3_UNKNOWN";

        if (ua.contains("Chrome")) return "JA3_CHROME";
        if (ua.contains("Firefox")) return "JA3_FIREFOX";
        if (ua.contains("python") || ua.contains("requests"))
            return "JA3_PYTHON_BOT";

        return "JA3_OTHER";
    }
}
