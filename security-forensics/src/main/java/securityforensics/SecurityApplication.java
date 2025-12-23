package securityforensics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class SecurityApplication {
    public static void main(String[] args) {
        SpringApplication.run(SecurityApplication.class, args);
        System.out.println("🔒 SECURITY SERVICE STARTED");
        System.out.println("📡 Port: 8081");
        System.out.println("🔗 API: http://localhost:8081/api/security");
    }
}
