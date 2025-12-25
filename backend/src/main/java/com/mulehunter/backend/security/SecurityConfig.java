package com.mulehunter.backend.security;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SecurityConfig {

  @Bean
  public FilterRegistrationBean<JwtAuthFilter> jwtFilter(JwtAuthFilter filter) {
    FilterRegistrationBean<JwtAuthFilter> reg = new FilterRegistrationBean<>();
    reg.setFilter(filter);
    reg.addUrlPatterns("/api/graph");
    reg.setOrder(1);
    return reg;
  }
}
