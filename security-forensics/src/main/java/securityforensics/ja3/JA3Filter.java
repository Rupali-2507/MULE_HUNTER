package securityforensics.ja3;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import java.io.IOException;

@Component
public class JA3Filter implements Filter {
    
    
    
    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest request = (HttpServletRequest) req;
        
        
       
        String ja3 = request.getHeader("X-JA3-FINGERPRINT");
        
        if(ja3 != null) request.setAttribute("JA3",ja3);
        
        chain.doFilter(req, res);
    }
}
