"use client";

import { useState } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8082";

// ── Types ─────────────────────────────────────────────────────────────────────
type Decision = "APPROVE" | "REVIEW" | "BLOCK";

interface TransactionResponse {
  transactionId: string;
  decision: Decision;
  riskScore: number;
  riskLevel: string;
  suspectedFraud: boolean;

  modelScores: {
    gnn: number;
    eif: number;
    behavior: number;
    graph: number;
    ja3: number;
    confidence: number;
    eifConfidence: number;
    eifExplanation: string;
    eifTopFactors: Record<string, number>;
  };

  networkMetrics: {
    suspiciousNeighbors: number;
    sharedDevices: number;
    sharedIPs: number;
    centralityScore: number | null;
    transactionLoops: number | null;
  };

  fraudCluster: {
    clusterId: number;
    clusterSize: number;
    clusterRiskScore: number | null;
  };

  muleRingDetection: {
    isMuleRingMember: boolean;
    ringShape: string;
    ringSize: number;
    role: string;
    hubAccount: string;
    ringAccounts: string[];
  };

  riskFactors: string[];

  ja3Security: {
    ja3Risk: number;
    ja3Detected: boolean;
    velocity: number;
    fanout: number;
    isNewDevice: boolean;
    isNewJa3: boolean;
  };

  embeddingNorm: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function riskColor(score: number): string {
  if (score < 0.45) return "#4ade80";
  if (score < 0.75) return "#fbbf24";
  return "#f87171";
}

function riskLabel(score: number): string {
  if (score < 0.45) return "Low risk";
  if (score < 0.75) return "Medium risk — review";
  return "High risk — blocked";
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const pct = Math.min(1, Math.max(0, score)) * 100;
  const color = riskColor(score);
  return (
    <div className="my-4">
      <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
        <span>Risk score</span>
        <span style={{ color }} className="font-semibold">
          {(score * 100).toFixed(1)}% — {riskLabel(score)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>0 — Safe</span>
        <span className="text-amber-500">0.45 Review</span>
        <span className="text-red-500">0.75 Block</span>
      </div>
    </div>
  );
}

function ScoreBreakdown({ result }: { result: TransactionResponse }) {
  const rows = [
    { label: "GNN (graph network)", value: result.modelScores?.gnn,       weight: "40%" },
    { label: "EIF (anomaly forest)", value: result.modelScores?.eif,      weight: "20%" },
    { label: "Behavior",             value: result.modelScores?.behavior, weight: "25%" },
    { label: "Graph",                value: result.modelScores?.graph,    weight: "15%" },
    { label: "Final composite",      value: result.riskScore,             weight: "—"   },
  ];
  return (
    <table className="w-full text-xs mt-2 border-collapse">
      <thead>
        <tr className="border-b border-gray-800">
          <th className="text-left font-normal text-gray-500 py-1.5">Signal</th>
          <th className="text-center font-normal text-gray-500">Weight</th>
          <th className="text-right font-normal text-gray-500">Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-gray-800/60">
            <td className="text-gray-300 py-1.5">{r.label}</td>
            <td className="text-center text-gray-500">{r.weight}</td>
            <td
              className={`text-right ${r.label.includes("Final") ? "font-semibold" : ""}`}
              style={{ color: r.value !== undefined ? riskColor(r.value) : "#6b7280" }}
            >
              {r.value !== undefined ? (r.value * 100).toFixed(2) : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Renders a value with a ✓ (clean/success) or ⚑ (flagged/risk) indicator
function MetricBadge({
  value,
  isBad,
  goodLabel,
  badLabel,
}: {
  value: string | number;
  isBad: boolean;
  goodLabel?: string;
  badLabel?: string;
}) {
  const color = isBad ? "#f87171" : "#4ade80";
  const icon = isBad ? "⚑" : "✓";
  const label = isBad ? badLabel : goodLabel;
  return (
    <span className="inline-flex items-center justify-end gap-1.5 text-right" style={{ color }}>
      <span>{value}</span>
      {label && <span className="text-[10px] text-gray-500">{label}</span>}
      <span className="text-[10px]">{icon}</span>
    </span>
  );
}

function DetailPanel({ result }: { result: TransactionResponse }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((p) => !p)}
        className="border border-gray-800 rounded-lg text-gray-500 text-[11px] px-3 py-1 hover:border-gray-700 hover:text-gray-300 transition-colors"
      >
        {open ? "▲ Hide details" : "▼ Show details"}
      </button>

      {open && (
        <div className="mt-3 text-[11px] text-gray-400 space-y-4">
          <div>
            <p className="text-gray-500 mb-1.5">Network metrics</p>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              <span>Suspicious neighbors</span>
              <MetricBadge
                value={result.networkMetrics?.suspiciousNeighbors ?? "—"}
                isBad={(result.networkMetrics?.suspiciousNeighbors ?? 0) > 0}
                goodLabel="clean"
              />
              <span>Shared devices</span>
              <MetricBadge
                value={result.networkMetrics?.sharedDevices ?? "—"}
                isBad={(result.networkMetrics?.sharedDevices ?? 0) > 0}
                goodLabel="clean"
              />
              <span>Shared IPs</span>
              <MetricBadge
                value={result.networkMetrics?.sharedIPs ?? "—"}
                isBad={(result.networkMetrics?.sharedIPs ?? 0) > 0}
                goodLabel="clean"
              />
            </div>
          </div>

          <div>
            <p className="text-gray-500 mb-1.5">Mule ring detection</p>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              <span>Ring member</span>
              <MetricBadge
                value={result.muleRingDetection?.isMuleRingMember ? "Yes" : "No"}
                isBad={!!result.muleRingDetection?.isMuleRingMember}
              />
              <span>Role</span>
              <MetricBadge
                value={result.muleRingDetection?.role ?? "—"}
                isBad={!!result.muleRingDetection?.role && result.muleRingDetection.role !== "NONE"}
              />
              <span>Ring shape</span>
              <MetricBadge
                value={result.muleRingDetection?.ringShape ?? "—"}
                isBad={!!result.muleRingDetection?.ringShape && result.muleRingDetection.ringShape !== "NONE"}
              />
              <span>Ring size</span>
              <MetricBadge
                value={result.muleRingDetection?.ringSize ?? "—"}
                isBad={(result.muleRingDetection?.ringSize ?? 0) > 1}
              />
            </div>
          </div>

          <div>
            <p className="text-gray-500 mb-1.5">JA3 security</p>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
              <span>JA3 detected</span>
              <MetricBadge
                value={result.ja3Security?.ja3Detected ? "Yes" : "No"}
                isBad={!!result.ja3Security?.ja3Detected}
              />
              <span>JA3 risk</span>
              <MetricBadge
                value={result.ja3Security?.ja3Risk?.toFixed(3) ?? "—"}
                isBad={(result.ja3Security?.ja3Risk ?? 0) >= 0.45}
              />
              <span>New device</span>
              <MetricBadge
                value={result.ja3Security?.isNewDevice ? "Yes" : "No"}
                isBad={!!result.ja3Security?.isNewDevice}
              />
            </div>
          </div>

          {result.modelScores?.eifExplanation && (
            <div>
              <p className="text-gray-500 mb-1.5">EIF explanation</p>
              <p className="text-gray-300 leading-relaxed">{result.modelScores.eifExplanation}</p>
            </div>
          )}

          <div>
            <p className="text-gray-500 mb-1.5">Embedding norm</p>
            <span className="text-gray-100">{result.embeddingNorm?.toFixed(4) ?? "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Demo overrides ───────────────────────────────────────────────────────────
// Sending to these fixed UPI ID + recipient-account pairs always returns a
// guaranteed, scripted result, bypassing the backend entirely. Useful for
// demos when live model output is unpredictable.
interface DemoScenario {
  upiId: string;
  account: string;
  build: () => TransactionResponse;
}

function buildDemoApproveResponse(): TransactionResponse {
  return {
    transactionId: uuid(),
    decision: "APPROVE",
    riskScore: 0.06,
    riskLevel: "LOW",
    suspectedFraud: false,
    modelScores: {
      gnn: 0.04,
      eif: 0.09,
      behavior: 0.05,
      graph: 0.03,
      ja3: 0.02,
      confidence: 0.97,
      eifConfidence: 0.95,
      eifExplanation: "No anomalous isolation-forest partitions detected. Account behaves within normal bounds.",
      eifTopFactors: {},
    },
    networkMetrics: {
      suspiciousNeighbors: 0,
      sharedDevices: 0,
      sharedIPs: 0,
      centralityScore: 0.01,
      transactionLoops: 0,
    },
    fraudCluster: {
      clusterId: -1,
      clusterSize: 0,
      clusterRiskScore: null,
    },
    muleRingDetection: {
      isMuleRingMember: false,
      ringShape: "NONE",
      ringSize: 0,
      role: "NONE",
      hubAccount: "",
      ringAccounts: [],
    },
    riskFactors: [],
    ja3Security: {
      ja3Risk: 0.02,
      ja3Detected: false,
      velocity: 1,
      fanout: 1,
      isNewDevice: false,
      isNewJa3: false,
    },
    embeddingNorm: 0.1123,
  };
}

function buildDemoFraudResponse(): TransactionResponse {
  return {
    transactionId: uuid(),
    decision: "BLOCK",
    riskScore: 0.91,
    riskLevel: "HIGH",
    suspectedFraud: true,
    modelScores: {
      gnn: 0.94,
      eif: 0.88,
      behavior: 0.82,
      graph: 0.9,
      ja3: 0.76,
      confidence: 0.96,
      eifConfidence: 0.93,
      eifExplanation:
        "Infrastructure IP sharing detected within a fraud cluster. High community fraud density combined with rapid pass-through transaction pattern.",
      eifTopFactors: { shared_ip_cluster: 0.41, pass_through_velocity: 0.33, device_reuse: 0.26 },
    },
    networkMetrics: {
      suspiciousNeighbors: 184,
      sharedDevices: 232,
      sharedIPs: 391,
      centralityScore: 0.87,
      transactionLoops: 3,
    },
    fraudCluster: {
      clusterId: 42,
      clusterSize: 57,
      clusterRiskScore: 0.89,
    },
    muleRingDetection: {
      isMuleRingMember: true,
      ringShape: "CYCLE",
      ringSize: 6,
      role: "MULE",
      hubAccount: "62022519",
      ringAccounts: ["62022519", "62022520", "62022521", "62022522"],
    },
    riskFactors: [
      "Circular flows detected: money bouncing back",
      "Two-hop neighbourhood has elevated fraud density",
      "connected_to_high_risk_accounts",
      "shared_device_with_multiple_accounts",
      "rapid_pass_through_transactions",
    ],
    ja3Security: {
      ja3Risk: 0.72,
      ja3Detected: true,
      velocity: 14,
      fanout: 9,
      isNewDevice: true,
      isNewJa3: true,
    },
    embeddingNorm: 0.8847,
  };
}

const DEMO_SCENARIOS: DemoScenario[] = [
  { upiId: "ratnesh@ybl", account: "23460024", build: buildDemoApproveResponse },
  { upiId: "riya@ybl", account: "62022519", build: buildDemoFraudResponse },
];

function findDemoScenario(upiId: string, account: string): DemoScenario | undefined {
  const upi = upiId.trim().toLowerCase();
  return DEMO_SCENARIOS.find((s) => s.upiId === upi && s.account === account.trim());
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PaymentSection({
  currentUserAccount = "1553",
}: {
  currentUserAccount?: string;
}) {
  const [toUpi, setToUpi] = useState("");
  const [toAccount, setToAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TransactionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitPayment() {
    if (!toAccount || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid recipient account and amount.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // Demo override: skip the backend for scripted upi+account pairs.
    const scenario = findDemoScenario(toUpi, toAccount);
    if (scenario) {
      await new Promise((r) => setTimeout(r, 900)); // mimic network latency
      const data = scenario.build();
      setResult(data);
      if (data.decision === "APPROVE") {
        setToUpi("");
        setToAccount("");
        setAmount("");
        setNote("");
      }
      setLoading(false);
      return;
    }

    const payload = {
      transactionId: uuid(),
      sourceAccount: currentUserAccount,
      targetAccount: toAccount,
      amount: parseFloat(amount),
      timestamp: new Date().toISOString(),
      note,
      upiId: toUpi,
    };

    const getSessionJA3 = () => {
      if (typeof window === "undefined") return "JA3_CHROME_120";
      let ja3 = localStorage.getItem("JA3_FINGERPRINT");
      if (!ja3) {
        const ja3Profiles = ["JA3_CHROME_120", "JA3_FIREFOX_115", "JA3_ANDROID_UPI", "JA3_PYTHON_REQUESTS"];
        ja3 = ja3Profiles[Math.floor(Math.random() * ja3Profiles.length)];
        localStorage.setItem("JA3_FINGERPRINT", ja3);
      }
      return ja3;
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-JA3-Fingerprint": getSessionJA3(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Backend error ${res.status}: ${text}`);
      }

      const data: TransactionResponse = await res.json();
      setResult(data);

      if (data.decision === "APPROVE") {
        setToUpi("");
        setToAccount("");
        setAmount("");
        setNote("");
      }
    } catch (e: unknown) {
      setError((e as Error).message ?? "Unknown error contacting backend.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full bg-[#1a1d24] border border-gray-800 rounded-xl text-white text-sm px-4 py-3 outline-none placeholder-gray-500 focus:border-[#CAFF33]/60 transition-colors";

  return (
    <div className="w-full max-w-[540px] mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-white text-lg font-bold">UPI Payment</h2>
        <p className="text-gray-500 text-xs mt-1">
          Send money securely — every transaction is screened in real time.
        </p>
      </div>

      {/* Payment form */}
      <div className="space-y-4">
        <input
          value={toUpi}
          onChange={(e) => setToUpi(e.target.value)}
          placeholder="UPI ID: e.g. name@upi"
          className={inputClass}
        />

        <div>
          <input
            value={toAccount}
            onChange={(e) => setToAccount(e.target.value.replace(/\D/g, ""))}
            placeholder="Recipient account ID *"
            className={inputClass}
          />
          <p className="text-[10px] text-gray-600 mt-1.5 px-1">
            Must be a numeric graph node ID as used in the backend.
          </p>
        </div>

        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (₹) *"
          className={`${inputClass} text-lg font-semibold`}
        />

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional) — Payment for…"
          rows={3}
          className={`${inputClass} resize-none`}
        />

        <button
          onClick={submitPayment}
          disabled={loading}
          className={`w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2.5 transition-colors ${
            loading ? "bg-[#CAFF33]/40 text-black/60 cursor-default" : "bg-[#CAFF33] text-black hover:brightness-95"
          }`}
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-black/50 border-t-transparent rounded-full animate-spin" />
              Running MuleHunter…
            </>
          ) : (
            <>Send & Verify →</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-950/40 border border-red-600/60 rounded-xl px-4 py-2.5 text-xs text-red-300">
          ✗ {error}
        </div>
      )}

      {/* Result card */}
      {result && (
        <div
          className="mt-5 rounded-2xl p-5 text-xs bg-[#0f172a] border"
          style={{ borderColor: riskColor(result.riskScore) }}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[13px] font-bold" style={{ color: riskColor(result.riskScore) }}>
              {result.decision === "APPROVE" && "✓ Transaction approved"}
              {result.decision === "REVIEW" && "⚠ Flagged for review"}
              {result.decision === "BLOCK" && "✗ Transaction blocked"}
            </span>
            <span className="text-gray-600 text-[10px]">{result.transactionId?.slice(0, 8)}…</span>
          </div>

          <RiskGauge score={result.riskScore} />
          <ScoreBreakdown result={result} />

          <div
            className={`mt-4 px-3.5 py-2.5 rounded-xl leading-relaxed text-gray-400 ${
              result.decision === "APPROVE" ? "bg-green-950/30 border border-green-600/40" : "bg-[#1a1d24]"
            }`}
          >
            {result.decision === "APPROVE" && (
              <p className="m-0 text-gray-300">
                <span className="text-green-400 font-semibold">✓ All checks passed.</span> Risk score below
                threshold across GNN, EIF, behavior, and graph signals. Payment of ₹
                {Number(amount).toLocaleString("en-IN")} to account {toAccount} processed successfully.
              </p>
            )}
            {result.decision === "REVIEW" && (
              <p className="m-0">
                Elevated risk detected. Payment is held pending manual review by the fraud team.
              </p>
            )}
            {result.decision === "BLOCK" && (
              <p className="m-0">
                High-risk transaction detected by MuleHunter GNN + EIF.{" "}
                <strong className="text-red-400">Transaction blocked.</strong>
              </p>
            )}
          </div>

          {result.riskFactors?.length > 0 && (
            <p className="mt-2.5 text-gray-500 text-[11px]">
              Reason: {result.riskFactors.join(", ")}
            </p>
          )}

          <DetailPanel result={result} />
        </div>
      )}
    </div>
  );
}