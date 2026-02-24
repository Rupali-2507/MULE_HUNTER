package com.mulehunter.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

  @Value("${jwt.secret}")
  private String jwtSecret;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {

        // ✅ Allow CORS preflight requests
      if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
          response.setStatus(HttpServletResponse.SC_OK);
          return;
      }

    String header = request.getHeader("Authorization");

    if (header == null || !header.startsWith("Bearer ")) {
    filterChain.doFilter(request, response);
    return;
}

    String token = header.substring(7);

    try {
    Claims claims = Jwts.parserBuilder()
        .setSigningKey(jwtSecret.getBytes())
        .build()
        .parseClaimsJws(token)
        .getBody();

    // ✅ DEFINE role FIRST
    String role = claims.get("role", String.class);

    // ✅ NOW this line is valid
    request.setAttribute("role", role);

} catch (Exception e) {
    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
    return;
}


    filterChain.doFilter(request, response);
  }
}
