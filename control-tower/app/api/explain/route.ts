import { NextRequest, NextResponse } from "next/server";

// ── Local fallback: generates explanation without calling Claude API ──────────
function localExplanation(payload: {
  nodeId: string | number;
  anomalyScore: number;
  isAnomalous: boolean;
  reasons: string[];
  volume: number;
  role: string;
}): string {
  const { nodeId, anomalyScore, isAnomalous, reasons, volume, role } = payload;
  const score = (anomalyScore * 100).toFixed(1);
  const topReason = reasons?.[0] ?? "elevated transaction velocity";
  const secondReason = reasons?.[1] ?? "anomalous neighbourhood patterns";

  if (!isAnomalous) {
    return (
      `Account ACC${nodeId} has a low risk score of ${score}% and shows no significant ` +
      `anomalous behaviour. With ${volume} transactions recorded, it operates within ` +
      `normal parameters. No action is recommended at this time.`
    );
  }

  const roleDesc =
    role === "HUB"
      ? "This account acts as a central hub — the likely organiser of the mule ring, with the highest out-degree and PageRank in its cluster."
      : role === "BRIDGE"
      ? "This account acts as a bridge between sub-clusters — a connector that obscures the money trail between the source and destination."
      : "This account acts as a leaf mule — executing individual transfers while insulated from the ring organiser.";

  return (
    `Account ACC${nodeId} has been flagged with a ${score}% risk score by the GNN model. ` +
    `${roleDesc} ` +
    `The primary fraud signal is ${topReason}, compounded by ${secondReason}. ` +
    `With ${volume} transactions recorded, this account exhibits behavioural patterns ` +
    `consistent with money laundering — specifically structured deposits designed to ` +
    `avoid detection thresholds. Immediate account review and potential freeze is recommended.`
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let payload: any = {};

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { nodeId, anomalyScore, isAnomalous, reasons, volume, role } = payload;

  // ── Try Groq API first ──
  const apiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    try {
      const prompt = `You are an AML (anti-money laundering) analyst assistant for a fraud detection system called alertixAI.

Account details:
- Account ID: ACC${nodeId}
- Risk Score: ${((anomalyScore ?? 0) * 100).toFixed(1)}%
- Status: ${isAnomalous ? "FLAGGED as anomalous" : "Normal"}
- Role in network: ${role ?? "UNKNOWN"}
- Transaction volume: ${volume ?? 0}
- Top SHAP signals: ${(reasons ?? []).slice(0, 3).join(", ") || "none available"}

Write a concise 3-sentence forensic explanation of why this account was flagged. 
Be specific about the fraud pattern (smurfing, layering, structuring).
End with a clear action recommendation. Do not use bullet points.`;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API returned ${response.status}`);
      }

      const data = await response.json();
      const explanation =
        data?.choices?.[0]?.message?.content ??
        localExplanation({ nodeId, anomalyScore: anomalyScore ?? 0, isAnomalous: !!isAnomalous, reasons: reasons ?? [], volume: volume ?? 0, role: role ?? "MULE" });

      return NextResponse.json({ explanation });
    } catch (err) {
      console.error("Explain API error (Groq):", err);
      // Fall through to local fallback
    }
  }

  // ── Local fallback — always works, no API key needed ──
  const explanation = localExplanation({
    nodeId,
    anomalyScore: anomalyScore ?? 0,
    isAnomalous: !!isAnomalous,
    reasons: reasons ?? [],
    volume: volume ?? 0,
    role: role ?? "MULE",
  });

  return NextResponse.json({ explanation });
}