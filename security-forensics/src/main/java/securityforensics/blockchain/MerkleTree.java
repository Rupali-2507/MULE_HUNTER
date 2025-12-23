//hashes fraud log, combines them (pair by pair), produce final hash
//detects if evidence was changed
//even if one log changes, root hash changes, so detect it
package securityforensics.blockchain;
import java.security.MessageDigest;
import java.util.*;

public class MerkleTree {
    public static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes());
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
    
    public static String getMerkleRoot(List<FraudLog> logs) {
        // Handle empty logs case (genesis block)
        if (logs == null || logs.isEmpty()) {
            return sha256("genesis");
        }
        
        List<String> hashes = new ArrayList<>();
        for (FraudLog log : logs) {
            hashes.add(sha256(log.serialize()));
        }
        
        while (hashes.size() > 1) {
            List<String> temp = new ArrayList<>();
            for (int i = 0; i < hashes.size(); i += 2) {
                String left = hashes.get(i);
                String right = (i + 1 < hashes.size()) ? hashes.get(i + 1) : left;
                temp.add(sha256(left + right));
            }
            hashes = temp;
        }
        
        return hashes.get(0);
    }
}
