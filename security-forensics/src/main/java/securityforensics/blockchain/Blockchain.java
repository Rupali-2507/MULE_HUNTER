//stores blocks in order ,each block depends on the previous one,
// changing old data breaks everything after it

package securityforensics.blockchain;

import java.util.*;

public class Blockchain {
    public List<Block> chain = new ArrayList<>();

    public Blockchain() {
        chain.add(new Block(0, new ArrayList<>(), "0"));
    }

    public void addBlock(List<FraudLog> logs) {
        Block prev = chain.get(chain.size() - 1);
        chain.add(new Block(chain.size(), logs, prev.hash));
    }
}
