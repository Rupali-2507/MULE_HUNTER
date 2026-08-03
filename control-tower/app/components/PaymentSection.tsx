"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Config ────────────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8082";

const PENALTY_REVIEW = 500;
const PENALTY_BLOCK  = 2000;
const PENALTY_KYC_MISS_REVIEW = 1000;
const PENALTY_KYC_MISS_BLOCK  = 5000;

const KYC_DEADLINE_REVIEW_H = 24;
const KYC_DEADLINE_BLOCK_H  = 12;

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

interface KycState {
  status: "none" | "pending_review" | "pending_block" | "completed" | "overdue";
  deadlineIso: string | null;
  deadlineHours: number | null;
  penaltyApplied: number;
  penaltyExtra: number;
  triggeredBy: string | null;
  accountBlocked: boolean;
}

const EMPTY_KYC: KycState = {
  status: "none",
  deadlineIso: null,
  deadlineHours: null,
  penaltyApplied: 0,
  penaltyExtra: 0,
  triggeredBy: null,
  accountBlocked: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadKyc(account: string): KycState {
  if (typeof window === "undefined") return EMPTY_KYC;
  try {
    const raw = localStorage.getItem(`mh_kyc_${account}`);
    return raw ? JSON.parse(raw) : EMPTY_KYC;
  } catch {
    return EMPTY_KYC;
  }
}

function saveKyc(account: string, state: KycState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`mh_kyc_${account}`, JSON.stringify(state));
}

function msLeft(isoDeadline: string | null): number {
  if (!isoDeadline) return Infinity;
  return new Date(isoDeadline).getTime() - Date.now();
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

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
            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
              <span>Suspicious neighbors</span>
              <span className="text-gray-100 text-right">
                {result.networkMetrics?.suspiciousNeighbors ?? "—"}
              </span>
              <span>Shared devices</span>
              <span className="text-gray-100 text-right">
                {result.networkMetrics?.sharedDevices ?? "—"}
              </span>
              <span>Shared IPs</span>
              <span className="text-gray-100 text-right">
                {result.networkMetrics?.sharedIPs ?? "—"}
              </span>
            </div>
          </div>

          <div>
            <p className="text-gray-500 mb-1.5">Mule ring detection</p>
            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
              <span>Ring member</span>
              <span
                className="text-right"
                style={{ color: result.muleRingDetection?.isMuleRingMember ? "#f87171" : "#4ade80" }}
              >
                {result.muleRingDetection?.isMuleRingMember ? "Yes" : "No"}
              </span>
              <span>Role</span>
              <span className="text-gray-100 text-right">{result.muleRingDetection?.role ?? "—"}</span>
              <span>Ring shape</span>
              <span className="text-gray-100 text-right">{result.muleRingDetection?.ringShape ?? "—"}</span>
              <span>Ring size</span>
              <span className="text-gray-100 text-right">{result.muleRingDetection?.ringSize ?? "—"}</span>
            </div>
          </div>

          <div>
            <p className="text-gray-500 mb-1.5">JA3 security</p>
            <div className="grid grid-cols-2 gap-y-1 gap-x-4">
              <span>JA3 detected</span>
              <span
                className="text-right"
                style={{ color: result.ja3Security?.ja3Detected ? "#f87171" : "#4ade80" }}
              >
                {result.ja3Security?.ja3Detected ? "Yes" : "No"}
              </span>
              <span>JA3 risk</span>
              <span className="text-gray-100 text-right">
                {result.ja3Security?.ja3Risk?.toFixed(3) ?? "—"}
              </span>
              <span>New device</span>
              <span className="text-gray-100 text-right">
                {result.ja3Security?.isNewDevice ? "Yes" : "No"}
              </span>
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

interface KycBannerProps {
  kyc: KycState;
  onCompleteKyc: () => void;
  account: string;
}

function KycBanner({ kyc, onCompleteKyc }: KycBannerProps) {
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    setMounted(true);
    setCountdown(fmtCountdown(msLeft(kyc.deadlineIso)));

    const t = setInterval(() => {
      setCountdown(fmtCountdown(msLeft(kyc.deadlineIso)));
    }, 1000);
    return () => clearInterval(t);
  }, [kyc.deadlineIso]);

  if (!mounted || kyc.status === "none" || kyc.status === "completed") return null;
  const isBlock = kyc.status === "pending_block" || kyc.accountBlocked;
  const overdue = msLeft(kyc.deadlineIso) <= 0;

  return (
    <div
      className={`rounded-xl p-4 mb-5 border ${
        isBlock ? "bg-red-950/40 border-red-600/60" : "bg-amber-950/30 border-amber-500/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{isBlock ? "🔴" : "🟡"}</span>
        <span className={`text-[13px] font-semibold ${isBlock ? "text-red-300" : "text-amber-300"}`}>
          {isBlock
            ? overdue
              ? "KYC overdue — account suspended"
              : "Action required: complete KYC within 12 hours"
            : overdue
            ? "KYC review overdue"
            : "Action required: complete KYC within 24 hours"}
        </span>
      </div>

      <p className="text-xs text-gray-300 leading-relaxed mb-3">
        {isBlock
          ? `A high-risk transaction flagged your account. All UPI transactions are suspended until KYC is verified. ${
              overdue ? `Additional overdue penalty: ₹${PENALTY_KYC_MISS_BLOCK.toLocaleString("en-IN")} levied.` : ""
            }`
          : `A transaction triggered a fraud review. You may continue using UPI but KYC must be completed within 24 hours. ${
              overdue ? `Additional overdue penalty: ₹${PENALTY_KYC_MISS_REVIEW.toLocaleString("en-IN")} levied.` : ""
            }`}
      </p>

      {!overdue && (
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] text-gray-500">Time remaining</span>
          <span className={`text-xl font-bold tracking-wider ${isBlock ? "text-red-400" : "text-amber-400"}`}>
            {countdown}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onCompleteKyc}
          className={`text-white text-xs font-semibold rounded-lg px-4 py-2 transition-colors ${
            isBlock ? "bg-red-600 hover:bg-red-500" : "bg-amber-600 hover:bg-amber-500"
          }`}
        >
          Complete KYC now →
        </button>
        <span className="text-[11px] text-gray-500">Ref: {kyc.triggeredBy?.slice(0, 12)}…</span>
      </div>
    </div>
  );
}

// ── KYC Modal ─────────────────────────────────────────────────────────────────
function KycModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [step, setStep] = useState<"form" | "verifying" | "done">("form");
  const [aadhaar, setAadhaar] = useState("");
  const [pan, setPan] = useState("");
  const [selfie, setSelfie] = useState(false);

  async function submit() {
    if (!aadhaar || !pan || !selfie) return;
    setStep("verifying");
    await new Promise((r) => setTimeout(r, 2400));
    setStep("done");
    setTimeout(onSuccess, 1200);
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[9999] px-4">
      <div className="bg-[#12141a] border border-gray-800 rounded-2xl p-7 w-full max-w-[400px]">
        {step === "form" && (
          <>
            <h2 className="text-white text-base font-semibold mb-5">KYC Verification</h2>

            <label className="text-[11px] text-gray-500 block mb-1.5">Aadhaar number (12 digits)</label>
            <input
              maxLength={12}
              value={aadhaar}
              onChange={(e) => setAadhaar(e.target.value)}
              placeholder="1234 5678 9012"
              className="w-full bg-[#1a1d24] border border-gray-800 rounded-xl text-white text-sm px-3.5 py-2.5 mb-4 outline-none focus:border-[#CAFF33]/60 transition-colors"
            />

            <label className="text-[11px] text-gray-500 block mb-1.5">PAN number</label>
            <input
              maxLength={10}
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              className="w-full bg-[#1a1d24] border border-gray-800 rounded-xl text-white text-sm px-3.5 py-2.5 mb-4 outline-none focus:border-[#CAFF33]/60 transition-colors"
            />

            <label className="flex items-center gap-2.5 text-xs text-gray-300 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={selfie}
                onChange={(e) => setSelfie(e.target.checked)}
                className="accent-[#CAFF33]"
              />
              I consent to liveness / selfie verification
            </label>

            <div className="flex gap-2.5">
              <button
                onClick={submit}
                disabled={!aadhaar || !pan || !selfie}
                className="flex-1 bg-[#CAFF33] text-black rounded-xl py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition"
              >
                Submit for verification
              </button>
              <button
                onClick={onClose}
                className="bg-[#1a1d24] text-gray-400 border border-gray-800 rounded-xl px-4 py-2.5 text-xs hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "verifying" && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-[3px] border-[#CAFF33] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-300 text-sm">Verifying identity with UIDAI & NSDL…</p>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <p className="text-green-400 text-sm font-semibold">KYC verified successfully</p>
            <p className="text-gray-500 text-xs mt-1.5">All services restored. Restrictions lifted.</p>
          </div>
        )}
      </div>
    </div>
  );
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
  const [showKycModal, setShowKycModal] = useState(false);

  const [kyc, setKyc] = useState<KycState>(EMPTY_KYC);

  useEffect(() => {
    setKyc(loadKyc(currentUserAccount));
  }, [currentUserAccount]);

  const kycRef = useRef(kyc);
  kycRef.current = kyc;

  useEffect(() => {
    const t = setInterval(() => {
      const cur = kycRef.current;
      if (
        (cur.status === "pending_review" || cur.status === "pending_block") &&
        cur.deadlineIso &&
        msLeft(cur.deadlineIso) <= 0
      ) {
        const extra =
          cur.status === "pending_block" ? PENALTY_KYC_MISS_BLOCK : PENALTY_KYC_MISS_REVIEW;
        const updated: KycState = {
          ...cur,
          status: "overdue",
          penaltyExtra: extra,
          accountBlocked: true,
        };
        setKyc(updated);
        saveKyc(currentUserAccount, updated);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [currentUserAccount]);

  const accountBlocked = kyc.accountBlocked && kyc.status !== "completed";

  const applyKycState = useCallback(
    (decision: Decision, txId: string) => {
      if (decision === "APPROVE") return;

      const hoursDeadline = decision === "BLOCK" ? KYC_DEADLINE_BLOCK_H : KYC_DEADLINE_REVIEW_H;
      const deadline = new Date(Date.now() + hoursDeadline * 60 * 60 * 1000).toISOString();
      const penalty = decision === "BLOCK" ? PENALTY_BLOCK : PENALTY_REVIEW;

      const updated: KycState = {
        status: decision === "BLOCK" ? "pending_block" : "pending_review",
        deadlineIso: kyc.deadlineIso ?? deadline,
        deadlineHours: hoursDeadline,
        penaltyApplied: kyc.penaltyApplied + penalty,
        penaltyExtra: 0,
        triggeredBy: txId,
        accountBlocked: decision === "BLOCK",
      };
      setKyc(updated);
      saveKyc(currentUserAccount, updated);
    },
    [kyc, currentUserAccount]
  );

  const handleKycSuccess = useCallback(() => {
    const cleared: KycState = {
      ...EMPTY_KYC,
      status: "completed",
      penaltyApplied: kyc.penaltyApplied,
    };
    setKyc(cleared);
    saveKyc(currentUserAccount, cleared);
    setShowKycModal(false);
  }, [kyc.penaltyApplied, currentUserAccount]);

  async function submitPayment() {
    if (!toAccount || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid recipient account and amount.");
      return;
    }
    if (accountBlocked) {
      setError("Your account is blocked. Complete KYC to resume UPI transactions.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

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
      applyKycState(data.decision, data.transactionId);

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

      <KycBanner kyc={kyc} account={currentUserAccount} onCompleteKyc={() => setShowKycModal(true)} />

      {/* Payment form */}
      <div
        className={`space-y-4 ${accountBlocked ? "opacity-40 pointer-events-none" : ""}`}
      >
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

          <div className="mt-4 px-3.5 py-2.5 bg-[#1a1d24] rounded-xl leading-relaxed text-gray-400">
            {result.decision === "APPROVE" && (
              <p className="m-0">
                Risk score below threshold. Payment of ₹{Number(amount).toLocaleString("en-IN")} to account{" "}
                {toAccount} processed successfully.
              </p>
            )}
            {result.decision === "REVIEW" && (
              <p className="m-0">
                Elevated risk detected. Payment is held pending review.{" "}
                <strong className="text-amber-400">
                  You must complete KYC within {KYC_DEADLINE_REVIEW_H} hours
                </strong>{" "}
                to restore full services. A penalty of ₹{PENALTY_REVIEW.toLocaleString("en-IN")} has been
                applied. Missing the KYC deadline will incur an additional ₹
                {PENALTY_KYC_MISS_REVIEW.toLocaleString("en-IN")} penalty.
              </p>
            )}
            {result.decision === "BLOCK" && (
              <p className="m-0">
                High-risk transaction detected by MuleHunter GNN + EIF.{" "}
                <strong className="text-red-400">All UPI transactions are now suspended.</strong> Complete
                KYC within {KYC_DEADLINE_BLOCK_H} hours to reinstate your account. Penalty: ₹
                {PENALTY_BLOCK.toLocaleString("en-IN")}. Failure to complete KYC will add ₹
                {PENALTY_KYC_MISS_BLOCK.toLocaleString("en-IN")} and trigger regulatory escalation.
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

      {showKycModal && <KycModal onClose={() => setShowKycModal(false)} onSuccess={handleKycSuccess} />}
    </div>
  );
}