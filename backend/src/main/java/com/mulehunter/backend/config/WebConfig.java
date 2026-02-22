package com.mulehunter.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(
                    "http://localhost:3000",
                    "http://localhost:5173",
                    "http://13.48.249.157:3000",
                    "http://13.61.154.100",
                    "http://56.228.10.113:8001",
                    "http://34.230.243.158:3000",
                    "https://mule-hunter-h58t.vercel.app"
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600);

        System.out.println("✅ CORS CONFIG ACTIVE (explicit origins)");
    }
}
