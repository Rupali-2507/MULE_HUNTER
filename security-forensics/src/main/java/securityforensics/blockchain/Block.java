//locks group of fraud logs, protects logs in batches

package securityforensics.blockchain;

import java.util.List;

public class Block {
    public int index;
    public long timestamp;
    public List<FraudLog> logs;
    public String previousHash;
    public String merkleRoot;
    public String hash;

    public Block(int index, List<FraudLog> logs, String previousHash) {
        this.index = index;
        this.logs = logs;
        this.previousHash = previousHash;
        this.timestamp = System.currentTimeMillis();
        this.merkleRoot = MerkleTree.getMerkleRoot(logs);
        this.hash = MerkleTree.sha256(index + previousHash + merkleRoot + timestamp);
    }
}
