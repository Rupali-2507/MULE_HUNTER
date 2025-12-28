package securityforensics.blockchain;
import java.util.*;

public class Blockchain {
    public List<Block> chain = new ArrayList<>();
    private List<FraudLog> pendingLogs = new ArrayList<>();
    private static final int BATCH_SIZE = 10;
    
    public Blockchain() {
        chain.add(new Block(0, new ArrayList<>(), "0"));
    }
    
    public synchronized void addLog(FraudLog log) {
        pendingLogs.add(log);
        System.out.println("📋 Pending logs: " + pendingLogs.size() + "/" + BATCH_SIZE);
        
        if (pendingLogs.size() >= BATCH_SIZE) {
            createBlock();
        }
    }
    
    private void createBlock() {
        Block prev = chain.get(chain.size() - 1);
        Block newBlock = new Block(chain.size(), new ArrayList<>(pendingLogs), prev.hash);
        chain.add(newBlock);
        System.out.println("⛓️  Block #" + newBlock.index + " mined! Hash: " + newBlock.hash.substring(0, 16) + "...");
        pendingLogs.clear();
    }
    
    public synchronized void forceBlock() {
        if (!pendingLogs.isEmpty()) {
            createBlock();
        }
    }
    
    public int getPendingCount() {
        return pendingLogs.size();
    }
}
