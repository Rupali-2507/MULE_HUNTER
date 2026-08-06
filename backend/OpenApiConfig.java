package com.mulehunter.backend;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "alertixAI API Core",
        version = "1.0.0",
        description = "Orchestration Layer for Fraud Detection. Connects Java Backend to Python AI Engine."
    ),
    servers = {
        @Server(url = "http://localhost:8080", description = "Local Docker Server")
    }
)
public class OpenApiConfig {
}