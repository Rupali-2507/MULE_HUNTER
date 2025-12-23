//stops the bot

package securityforensics.ja3;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;

public class JA3Filter implements Filter {

    private JA3FingerprintService fingerprintService = new JA3FingerprintService();  //calls JA3FS
    private BotDetectionService botService = new BotDetectionService();  //calls BDS

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) req;
        HttpServletResponse response = (HttpServletResponse) res;

        String ja3 = fingerprintService.generateFingerprint(request);

        if (botService.isBot(ja3)) {
            response.setStatus(403);
            response.getWriter().write("Blocked: Bot Detected");
            return;
        }

        chain.doFilter(req, res);
    }
}
