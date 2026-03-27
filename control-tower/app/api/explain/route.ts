import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { nodeId, anomalyScore, reasons, isAnomalous, volume } =
      await req.json();

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `You are an expert financial fraud analyst.

Analyze the account ${nodeId} and explain in 2-3 sharp sentences why it is classified as ${isAnomalous ? "ANOMALOUS" : "NORMAL"}.

Details:
- Risk score: ${anomalyScore !== undefined ? (Math.abs(anomalyScore) * 100).toFixed(1) : "N/A"}
- Transaction volume: ${volume ?? "N/A"}
- Key signals: ${reasons?.join(", ") || "none"}

Focus on suspicious behavior patterns, transaction anomalies, or risk indicators.
Be concise, confident, and investigative in tone. No bullet points.`,
        },
      ],
    });

  const content = message.content as any[];

const text = content
  .map((c) => (c.type === "text" ? c.text : ""))
  .join(" ")
  .trim() || "No explanation generated.";

    return NextResponse.json({ explanation: text });
  } catch (err) {
    console.error("Explain API error:", err);
    return NextResponse.json(
      { explanation: "Failed to generate explanation." },
      { status: 500 }
    );
  }
}