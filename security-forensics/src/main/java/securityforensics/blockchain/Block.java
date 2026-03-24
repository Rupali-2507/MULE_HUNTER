package securityforensics.blockchain;

import java.util.List;

public class Block {
    public int index;
    public long timestamp;
    public List<FraudLog> logs;
    public String previousHash;
    public String merkleRoot;
    public String hash;
    public int nonce;           // ← Proof of Work counter
    public int difficulty = 4;  // ← hash must start with "0000"

    public Block(int index, List<FraudLog> logs, String previousHash) {
        this.index        = index;
        this.logs         = logs;
        this.previousHash = previousHash;
        this.timestamp    = System.currentTimeMillis();
        this.merkleRoot   = MerkleTree.getMerkleRoot(logs);
        this.hash         = mine(); // ← mine instead of direct hash
    }

    // ── Proof of Work ─────────────────────────────────────────────
    private String mine() {
        String target = "0".repeat(difficulty); // "0000"
        String candidate;
        nonce = 0;

        do {
            nonce++;
            candidate = MerkleTree.sha256(
                index + previousHash + merkleRoot + timestamp + nonce
            );
        } while (!candidate.startsWith(target));

        System.out.println("⛏️  Block #" + index + " mined! nonce=" + nonce
                + " hash=" + candidate.substring(0, 16) + "...");
        return candidate;
    }

    // ── Tamper verification ───────────────────────────────────────
    public boolean isValid() {
    //Recompute merkle root from logs 
    String recalculatedMerkle = MerkleTree.getMerkleRoot(logs);

    if (!merkleRoot.equals(recalculatedMerkle)) {
        return false;
    }

    // Recompute hash
    String recomputed = MerkleTree.sha256(
        index + previousHash + merkleRoot + timestamp + nonce
    );

    return hash.equals(recomputed) && hash.startsWith("0".repeat(difficulty));
}
}