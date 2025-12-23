//store fraud events

package securityforensics.blockchain;

public class FraudLog {
    public String txId;
    public String accountId;
    public double amount;
    public boolean fraud;
    public long timestamp;

    public FraudLog(String txId, String accountId, double amount, boolean fraud) {
        this.txId = txId;   //transaction ID
        this.accountId = accountId;
        this.amount = amount;
        this.fraud = fraud;
        this.timestamp = System.currentTimeMillis();
    }

    public String serialize() {
        return txId + accountId + amount + fraud + timestamp;   //converted to string
    }
}
