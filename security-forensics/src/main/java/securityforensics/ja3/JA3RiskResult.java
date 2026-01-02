package securityforensics.ja3;

public class JA3RiskResult{
    public final double ja3Risk;
    public final int velocity;
    public final int fanout;

    public JA3RiskResult(double ja3Risk, int velocity, int fanout){
        this.ja3Risk = ja3Risk;
        this.velocity = velocity;
        this.fanout = fanout;
    }
}