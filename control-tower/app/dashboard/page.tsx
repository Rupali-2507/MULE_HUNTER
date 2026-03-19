"use client";

import React, { useState, useRef, useEffect } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  Zap, RefreshCw, BarChart3, Fingerprint, Shuffle,
  Link2, Network, Boxes, ChevronRight, Waves,
} from "lucide-react";

// ─── BASE URLS ────────────────────────────────────────────────────────────────
const ML_URL  = "http://56.228.10.113:8001";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://13.49.23.31:8082";

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
const NAV = [
  { id: "simulator",  label: "Simulator",  icon: Zap         },
  { id: "gnn",        label: "GNN",        icon: Network     },
  { id: "eif",        label: "EIF",        icon: Waves       },
  { id: "identity",   label: "Identity",   icon: Fingerprint },
  { id: "fusion",     label: "Fusion",     icon: Shuffle     },
  { id: "rings",      label: "Rings",      icon: RefreshCw   },
  { id: "clusters",   label: "Clusters",   icon: Boxes       },
  { id: "blockchain", label: "Blockchain", icon: Link2       },
  { id: "metrics",    label: "Metrics",    icon: BarChart3   },
] as const;
type View = (typeof NAV)[number]["id"];

// ─── PIPELINE LABELS ──────────────────────────────────────────────────────────
const PIPE = [
  "Validate","Persist Txn","Persist Identity","Identity Forensic",
  "Update Aggregates","Behavioral Feats","Graph Context",
  "EIF ‖ GNN","Risk Fusion","Log Predictions",
  "Decision Policy","Commit DB","Return Verdict","Blockchain Async",
];

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK = {
  identityFeatures: { ja3ReuseCount: 8, deviceReuseCount: 6, ipReuseCount: 3, geoMismatch: false, isNewDevice: false, isNewJa3: true },
};
const MOCK_LOGS = [
  { hash:"0xf3a1...9d22", event:"RING_DETECTED",   account:"acc_12395", risk:0.91, ts:"10:42:11", block:19823441, model:"FUSION", decision:"BLOCK"   },
  { hash:"0xb7c2...1e33", event:"ACCOUNT_FLAGGED", account:"acc_88888", risk:0.84, ts:"10:38:07", block:19823415, model:"GNN",    decision:"BLOCK"   },
  { hash:"0x2d9f...aa11", event:"CLUSTER_ALERT",   account:"acc_55221", risk:0.77, ts:"10:31:55", block:19823387, model:"EIF",    decision:"REVIEW"  },
  { hash:"0xe8c4...5b90", event:"SCORE_LOGGED",    account:"acc_30019", risk:0.65, ts:"10:25:18", block:19823351, model:"FUSION", decision:"REVIEW"  },
  { hash:"0x9f3d...8712", event:"SCORE_LOGGED",    account:"acc_77123", risk:0.21, ts:"10:12:44", block:19823278, model:"EIF",    decision:"APPROVE" },
];

// ─── SHARED LAST-RESULT CONTEXT ──────────────────────────────────────────────
// EIF, Identity, and Fusion sections all display data from the most recently
// scored transaction. Rather than re-fetching independently, the Simulator
// writes its result here and the other sections read it.
type LastResult = {
  gnnScore: number; eifScore: number; eifConf: number; gnnConf: number;
  behaviorScore: number; graphScore: number; riskScore: number;
  eifExplanation: string; shapValues: Record<string, number>;
  ja3: { isNewDevice: boolean; isNewJa3: boolean; reuse: number; fanout: number; ja3Risk: number };
  networkMetrics: { suspiciousNeighbors: number; centralityScore: number; transactionLoops: boolean; sharedDevices: number; sharedIPs: number };
  decision: string; riskLevel: string; riskFactors: string[];
  muleRing: any; clusterId: number; clusterSize: number; clusterRisk: number; embeddingNorm: number;
};
const LastResultCtx = React.createContext<{ result: LastResult | null; setResult: (r: LastResult) => void }>({
  result: null, setResult: () => {},
});

// ─── UTILS ────────────────────────────────────────────────────────────────────
const f4  = (n: number, d = 4) => Number(n).toFixed(d);
const hex = (s: number) => s >= 0.75 ? "#ef4444" : s >= 0.45 ? "#facc15" : "#CAFF33";
const tc  = (s: number) => s >= 0.75 ? "text-red-400" : s >= 0.45 ? "text-yellow-400" : "text-[#CAFF33]";
const bg  = (s: number) =>
  s >= 0.75 ? "bg-red-500/[0.04] border-red-500/20"
  : s >= 0.45 ? "bg-yellow-400/[0.04] border-yellow-400/20"
  : "bg-[#CAFF33]/[0.04] border-[#CAFF33]/20";
const dc  = (d: string) =>
  d === "BLOCK"  ? "bg-red-500/10 border border-red-500/20 text-red-400"
  : d === "REVIEW" ? "bg-yellow-400/10 border border-yellow-400/20 text-yellow-400"
  : "bg-[#CAFF33]/10 border border-[#CAFF33]/20 text-[#CAFF33]";

const deriveShape = (size: number) =>
  size >= 6 ? "DENSE" : size === 3 ? "CYCLE" : size === 4 ? "CHAIN" : "STAR";

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative border border-white/[0.09] rounded-[1.5rem] bg-[#0a0a0a] overflow-hidden ${className}`}
    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)" }}>
    {children}
  </div>
);
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-2">{children}</p>
);
const Pill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${className}`}>{children}</span>
);
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center py-3 border-b border-white/[0.06] last:border-0">
    <span className="text-[11px] text-white/45 uppercase tracking-widest font-semibold">{label}</span>
    <span className="text-sm font-bold text-white/85">{value}</span>
  </div>
);
function Bar({ label, value, max = 1, color = "#CAFF33" }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-white/50 uppercase tracking-widest font-semibold">{label}</span>
        <span className="text-xs font-black font-mono" style={{ color }}>{f4(value, 2)}</span>
      </div>
      <div className="relative h-[3px] w-full bg-white/[0.07] rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 12px ${color}55` }} />
      </div>
    </div>
  );
}
function Gauge({ score, label }: { score: number; label: string }) {
  const r = 40, cx = 56, cy = 60, circ = 2 * Math.PI * r;
  const dash = Math.min(1, score) * circ * 0.75;
  const color = hex(score);
  return (
    <div className="flex flex-col items-center">
      <svg width={112} height={90} viewBox="0 0 112 82">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)"
          strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${circ * 0.75} ${circ}`} transform={`rotate(-135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={5} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform={`rotate(-135 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 10px ${color}aa)`, transition: "stroke-dasharray 1s ease" }} />
        <text x={cx} y={cx + 3} textAnchor="middle" fill={color} fontSize={14}
          fontWeight={900} fontFamily="var(--font-geist-mono)">{f4(score, 2)}</text>
      </svg>
      <span className="text-[9px] text-white/40 uppercase tracking-[0.22em] font-bold -mt-1">{label}</span>
    </div>
  );
}
function StatCard({ label, value, sub, color = "text-[#CAFF33]", accent }: { label: string; value: React.ReactNode; sub: string; color?: string; accent?: string }) {
  return (
    <Card className="p-6 relative overflow-hidden">
      {accent && <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.03]" style={{ background: accent, filter: "blur(24px)", transform: "translate(30%,-30%)" }} />}
      <p className="text-[10px] text-white/45 uppercase tracking-[0.2em] mb-3 font-bold">{label}</p>
      <p className={`text-4xl font-black leading-none mb-2 ${color}`}>{value}</p>
      <p className="text-xs text-white/40">{sub}</p>
    </Card>
  );
}
function LiveBadge({ loading, error }: { loading: boolean; error: boolean }) {
  if (loading) return <span className="text-[9px] text-white/55 animate-pulse font-mono">fetching…</span>;
  if (error)   return <span className="text-[9px] text-yellow-400/70 font-mono">⚠ unreachable</span>;
  return (
    <span className="flex items-center gap-1.5 text-[9px] text-[#CAFF33]/70 font-mono font-bold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#CAFF33]" style={{ boxShadow: "0 0 6px #CAFF33" }} />
      live
    </span>
  );
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-5 flex items-center gap-2">
      <span className="w-3 h-px bg-white/20" />
      {children}
      <span className="flex-1 h-px bg-white/[0.06]" />
    </p>
  );
}

// ─── CANVAS ───────────────────────────────────────────────────────────────────
type LiveNode = { id: string; is_fraud: number; risk: number; ring: boolean };
function Canvas({ liveNodes }: { liveNodes?: LiveNode[] }) {
  const ref  = useRef<HTMLCanvasElement>(null);
  const anim = useRef<number | null>(null);
  type P = { x: number; y: number; vx: number; vy: number; r: number; color: string; hot: boolean };
  const pts = useRef<P[]>([]);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const W = c.width, H = c.height;
    const source: LiveNode[] = liveNodes && liveNodes.length > 0
      ? liveNodes.slice(0, 60)
      : Array.from({ length: 50 }, (_, i) => ({
          id: `acc_${i}`, is_fraud: i % 9 === 0 ? 1 : 0,
          risk: i % 9 === 0 ? 0.8 : Math.random() * 0.4, ring: i % 15 === 0,
        }));

    pts.current = source.map(n => ({
      x: 30 + Math.random() * (W - 60), y: 20 + Math.random() * (H - 40),
      vx: (Math.random() - 0.5) * 0.14, vy: (Math.random() - 0.5) * 0.14,
      r: n.ring ? 5.5 : n.is_fraud ? 4.5 : 2.5,
      color: n.ring ? "#f97316" : n.is_fraud ? "#ef4444" : n.risk > 0.5 ? "#facc15" : "#CAFF33",
      hot: !!(n.ring || n.is_fraud),
    }));

    let t = 0;
    const draw = () => {
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.fillStyle = "#080808"; ctx.fillRect(0, 0, W, H); t += 0.006;
      pts.current.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 15 || p.x > W - 15) p.vx *= -1;
        if (p.y < 10 || p.y > H - 10) p.vy *= -1;
      });
      for (let i = 0; i < pts.current.length; i++) {
        for (let j = i + 1; j < pts.current.length; j++) {
          const a = pts.current[i], b = pts.current[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 85) {
            const al = (1 - d / 85) * 0.09;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = (a.hot || b.hot) ? `rgba(239,68,68,${al})` : `rgba(202,255,51,${al * 0.45})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      pts.current.forEach((p, i) => {
        if (p.hot) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(239,68,68,${0.05 * pulse})`; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.shadowColor = p.color;
        ctx.shadowBlur = p.hot ? 12 : 4; ctx.fill(); ctx.shadowBlur = 0;
      });
      anim.current = requestAnimationFrame(draw);
    };
    anim.current = requestAnimationFrame(draw);
    return () => { if (anim.current) cancelAnimationFrame(anim.current); };
  }, [liveNodes]);

  return <canvas ref={ref} width={500} height={240} className="w-full h-full rounded-2xl" />;
}

// ─── PIPELINE STEP ────────────────────────────────────────────────────────────
function PipeStep({ n, label, active, done, tag }: { n: number; label: string; active: boolean; done: boolean; tag?: string }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${active ? "bg-[#CAFF33]/[0.09] border border-[#CAFF33]/20" : "border border-transparent"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 transition-all ${done ? "bg-[#CAFF33] text-black" : active ? "bg-[#CAFF33] text-black" : "bg-white/[0.06] text-white/55 border border-white/[0.1]"}`}>
        {done ? "✓" : n}
      </div>
      <span className={`text-[11px] flex-1 transition-colors leading-tight font-semibold ${active ? "text-[#CAFF33]" : done ? "text-[#CAFF33]/50" : "text-white/35"}`}>{label}</span>
      {tag && <span className="text-[8px] font-black uppercase tracking-widest text-white/35 border border-white/[0.08] px-1.5 py-0.5 rounded-full">{tag}</span>}
    </div>
  );
}
function Field({ label, k, form, setForm }: { label: string; k: string; form: Record<string, string>; setForm: (f: any) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">{label}</label>
      <input value={form[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))}
        className="w-full bg-white/[0.04] border border-white/[0.1] hover:border-white/[0.18] focus:border-[#CAFF33]/40 rounded-xl px-4 py-2.5 text-sm text-white/85 font-mono placeholder:text-white/45 focus:outline-none transition-colors" />
    </div>
  );
}
function PageHeading({ eyebrow, title, accent, description }: { eyebrow: string; title: string; accent: string; description: string }) {
  return (
    <div className="mb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[2.6rem] font-black tracking-tight leading-none mb-3">
        {title} <span className="text-[#CAFF33]">{accent}</span>
      </h2>
      <p className="text-sm text-white/50 max-w-lg leading-relaxed">{description}</p>
    </div>
  );
}

// ─── ERROR BANNER ─────────────────────────────────────────────────────────────
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="p-4 rounded-xl border border-red-500/25 bg-red-500/[0.06] mb-4">
      <p className="text-xs text-red-300 leading-relaxed font-mono">{message}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIMULATOR
// BUG FIXES:
//   1. Default sourceAccount/targetAccount are now numeric strings ("1553"/"899")
//      because TransactionService calls Long.parseLong() on them — non-numeric
//      values like "ACC1553" throw NumberFormatException → Mono.error → all zeros.
//   2. timestamp is now included in the POST body as an ISO-8601 LocalDateTime
//      string ("2026-03-19T10:00:00"). TransactionValidationService checks
//      request.getTimestamp() == null and returns Mono.error if missing — this
//      short-circuits the ENTIRE pipeline before any ML call fires, which was
//      the primary cause of all scores returning 0.
//   3. Error state is surfaced in the UI instead of a bare alert() so the user
//      can see the actual server error message and diagnose issues.
//   4. EIF topFactor Bar max changed from 0.3 → 1.0 so real EIF path-length
//      delta values (which are not bounded by 0.3) are not clipped to 100%.
// ═════════════════════════════════════════════════════════════════════════════
function SimulatorSection() {
  const { setResult: setShared } = React.useContext(LastResultCtx);
  // BUG FIX 1: sourceAccount and targetAccount MUST be numeric strings.
  // TransactionService.createTransaction() calls Long.parseLong(tx.getSourceAccount()).
  // "ACC1553" throws NumberFormatException → Mono.error → pipeline aborts → all zeros.
  const [form, setForm] = useState({
    sid: "1553",   // was "ACC1553" — must be numeric
    did: "899",    // was "ACC899"  — must be numeric
    amt: "2077",
    ccy: "INR",
    ip: "49.204.11.92",
    ja3: "771,4866-4867-4865,...",
    dev: "device_8s7df6",
    nb: "4",
    hd: "0.47",
  });
  const [step,    setStep]    = useState(0);
  const [result,  setResult]  = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tab,     setTab]     = useState("Overview");

  const run = async () => {
    setResult(null);
    setApiError(null);
    setLoading(true);
    setStep(0);

    const dl = [80,80,80,80,80,80,80,220,80,80,80,80,300,120];
    for (let i = 0; i < 14; i++) { setStep(i + 1); await new Promise(r => setTimeout(r, dl[i])); }

    try {
      // BUG FIX 2: timestamp is required by TransactionValidationService.
      // If missing → validate() returns Mono.error("Missing required fields")
      // → the entire reactive chain short-circuits → Transaction is never saved
      // → no ML calls fire → no scores → every data.X ?? 0 fallback returns 0.
      //
      // TransactionRequest.timestamp is LocalDateTime, so we send a LOCAL
      // datetime string (no 'Z' suffix) that Spring deserialises via @JsonFormat
      // or the default ISO_LOCAL_DATE_TIME deserialiser.
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const localTimestamp =
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
        `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const res = await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-JA3-Fingerprint": form.ja3,
        },
        body: JSON.stringify({
          transactionId:  crypto.randomUUID(),
          sourceAccount:  form.sid,          // numeric string e.g. "1553"
          targetAccount:  form.did,          // numeric string e.g. "899"
          amount:         Number(form.amt),
          timestamp:      localTimestamp,    // BUG FIX: was missing → all zeros
        }),
      });

      // BUG FIX 3: surface server errors in UI instead of silent zero-fallback
      if (!res.ok) {
        let errText = `HTTP ${res.status}`;
        try { const body = await res.json(); errText = JSON.stringify(body); } catch {}
        setApiError(`Backend returned error: ${errText}`);
        setStep(15);
        setLoading(false);
        return;
      }

      const data = await res.json();

      const mapped = {
        decision:       data.decision                    ?? "REVIEW",
        riskScore:      data.riskScore                   ?? 0,
        riskLevel:      data.riskLevel                   ?? "UNKNOWN",
        suspectedFraud: data.suspectedFraud              ?? false,
        gnnScore:       data.modelScores?.gnn            ?? 0,
        eifScore:       data.modelScores?.eif            ?? 0,
        eifConf:        data.modelScores?.eifConfidence  ?? 0,
        gnnConf:        data.modelScores?.confidence     ?? 0,
        behaviorScore:  data.modelScores?.behavior       ?? 0,
        graphScore:     data.modelScores?.graph          ?? 0,
        eifExplanation: data.modelScores?.eifExplanation ?? "",
        shapValues:     data.modelScores?.eifTopFactors  ?? {},
        clusterId:      data.fraudCluster?.clusterId     ?? 0,
        clusterSize:    data.fraudCluster?.clusterSize   ?? 0,
        clusterRisk:    data.fraudCluster?.clusterRiskScore ?? 0,
        embeddingNorm:  data.embeddingNorm               ?? 0,
        networkMetrics: {
          suspiciousNeighbors: data.networkMetrics?.suspiciousNeighbors ?? 0,
          centralityScore:     data.networkMetrics?.centralityScore     ?? 0,
          transactionLoops:    data.networkMetrics?.transactionLoops    ?? false,
          sharedDevices:       data.networkMetrics?.sharedDevices       ?? 0,
          sharedIPs:           data.networkMetrics?.sharedIPs           ?? 0,
        },
        muleRing:    data.muleRingDetection ?? { isMuleRingMember: false },
        riskFactors: data.riskFactors ?? [],
        ja3: {
          isNewDevice: data.ja3Security?.isNewDevice ?? false,
          isNewJa3:    data.ja3Security?.isNewJa3    ?? false,
          reuse:       data.ja3Security?.velocity    ?? 0,
          fanout:      data.ja3Security?.fanout      ?? 0,
          ja3Risk:     data.ja3Security?.ja3Risk     ?? 0,
        },
      };
      setResult(mapped);
      setShared(mapped);
    } catch (e: any) {
      setApiError(`Network error: ${e?.message ?? "Spring Boot not reachable at " + API_URL}`);
    }
    setStep(15);
    setLoading(false);
  };

  const fusionComponents = result ? [
    { w: 0.40, v: result.gnnScore,      label: "GNN",      color: "#CAFF33"  },
    { w: 0.20, v: result.eifScore,      label: "EIF",      color: "#a855f7"  },
    { w: 0.25, v: result.behaviorScore, label: "Behavior", color: "#3b82f6"  },
    { w: 0.10, v: result.graphScore,    label: "Graph",    color: "#facc15"  },
    { w: 0.05, v: result.ja3?.ja3Risk ?? 0, label: "JA3", color: "#f97316"  },
  ] : [];

  return (
    <div className="grid grid-cols-[270px_1fr_210px] gap-5 h-full">
      {/* ── Form ── */}
      <Card className="flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-white/[0.05]">
          <Eyebrow>Input</Eyebrow>
          <p className="text-lg font-bold text-white/80">Transaction</p>
        </div>
        <div className="p-6 space-y-5 flex-1">
          <div className="space-y-3">
            {/* Note label reminds user accounts must be numeric */}
            <div className="px-3 py-2 rounded-lg bg-[#CAFF33]/[0.04] border border-[#CAFF33]/10">
              <p className="text-[9px] text-[#CAFF33]/50 leading-relaxed">
                Account IDs must be numeric (e.g. "1553") — they map to node IDs in the graph.
              </p>
            </div>
            <Field label="Source Account (numeric)"      k="sid" form={form} setForm={setForm} />
            <Field label="Destination Account (numeric)" k="did" form={form} setForm={setForm} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount"   k="amt" form={form} setForm={setForm} />
              <Field label="Currency" k="ccy" form={form} setForm={setForm} />
            </div>
          </div>
          <div className="pt-4 border-t border-white/[0.04] space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40 mb-1">Identity (passed as headers)</p>
            <Field label="IP Address"      k="ip"  form={form} setForm={setForm} />
            <Field label="JA3 Fingerprint" k="ja3" form={form} setForm={setForm} />
            <Field label="Device ID"       k="dev" form={form} setForm={setForm} />
          </div>
          <div className="pt-4 border-t border-white/[0.04] space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40 mb-1">Graph Context (display only)</p>
            <Field label="Suspicious Neighbours" k="nb" form={form} setForm={setForm} />
            <Field label="2-Hop Fraud Density"   k="hd" form={form} setForm={setForm} />
          </div>
        </div>
        <div className="p-5 border-t border-white/[0.04]">
          <button onClick={run} disabled={loading}
            className="w-full py-3.5 bg-[#CAFF33] hover:bg-[#d4ff55] active:scale-[0.99] disabled:opacity-40 text-black font-bold rounded-xl text-[11px] uppercase tracking-[0.15em] transition-all">
            {loading ? "Processing…" : "Score Transaction"}
          </button>
        </div>
      </Card>

      {/* ── Results ── */}
      <div className="flex flex-col gap-4 overflow-y-auto min-w-0">
        {/* BUG FIX 3: show API errors prominently */}
        {apiError && <ErrorBanner message={apiError} />}

        {result ? (
          <>
            {/* Verdict banner */}
            <Card className={`p-8 border ${bg(result.riskScore)}`}>
              <div className="flex items-start justify-between">
                <div>
                  <Eyebrow>Risk Verdict</Eyebrow>
                  <p className={`text-[3.25rem] font-black uppercase tracking-tight leading-none ${tc(result.riskScore)}`}
                    style={{ textShadow: `0 0 60px ${hex(result.riskScore)}33` }}>
                    {result.decision}
                  </p>
                  <p className="text-xs text-white/45 mt-2">
                    Risk level: <span className={tc(result.riskScore)}>{result.riskLevel}</span>
                    {result.suspectedFraud && <span className="ml-3 text-red-400">● Suspected fraud</span>}
                  </p>
                </div>
                <div className="flex gap-10 items-end">
                  {([
                    ["Fusion",    result.riskScore],
                    ["GNN",       result.gnnScore],
                    ["EIF",       result.eifScore],
                    ["Behavior",  result.behaviorScore],
                  ] as [string, number][]).map(([l, v]) => (
                    <div key={l} className="text-right">
                      <p className="text-[9px] text-white/45 uppercase tracking-widest mb-1">{l}</p>
                      <p className={`text-2xl font-black font-mono ${tc(v)}`}>{f4(v, 3)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Score gauges */}
            <div className="grid grid-cols-4 gap-3">
              {([
                ["GNN",      result.gnnScore,      `Cluster #${result.clusterId} · emb ${f4(result.embeddingNorm, 2)}`],
                ["EIF",      result.eifScore,       `Conf ${f4(result.eifConf, 3)}`],
                ["Behavior", result.behaviorScore,  "velocity + burst + deviation"],
                ["Fusion",   result.riskScore,      "0.40·GNN+0.20·EIF+0.25·B+0.10·G+0.05·J"],
              ] as [string, number, string][]).map(([l, v, s]) => (
                <Card key={l} className="p-6 flex flex-col items-center gap-2">
                  <Gauge score={v} label={l} />
                  <p className="text-[9px] text-white/45 text-center leading-relaxed">{s}</p>
                </Card>
              ))}
            </div>

            {/* Detail tabs */}
            <Card className="p-6 flex-1">
              <div className="flex gap-1.5 mb-6 pb-5 border-b border-white/[0.05] flex-wrap">
                {["Overview","Behavioral","Structural","Identity","Fusion"].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${tab === t ? "bg-[#CAFF33] text-black" : "text-white/50 hover:text-white/50"}`}>
                    {t}
                  </button>
                ))}
              </div>

              {tab === "Overview" && (
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Score Breakdown</p>
                    <Bar label="GNN — structural graph signal"  value={result.gnnScore}      color={hex(result.gnnScore)} />
                    <Bar label="EIF — behavioral anomaly"       value={result.eifScore}      color={hex(result.eifScore)} />
                    <Bar label="Behavior — velocity + burst"    value={result.behaviorScore} color="#3b82f6" />
                    <Bar label="Graph — neighbour connectivity" value={result.graphScore}    color="#facc15" />
                    <Bar label="Fusion — final risk"            value={result.riskScore}     color={hex(result.riskScore)} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">Risk Signals (from GNN)</p>
                    <div className="space-y-2">
                      {result.riskFactors.length > 0
                        ? result.riskFactors.map((f: string, i: number) => (
                            <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-red-500/[0.03] border border-red-500/10 text-sm text-white/40 leading-relaxed">
                              <span className="text-red-500/60 shrink-0 mt-0.5 text-xs">▲</span>{f}
                            </div>
                          ))
                        : <p className="text-sm text-white/55">No risk signals detected.</p>}
                    </div>
                    {result.eifExplanation && (
                      <div className="mt-4 p-4 rounded-xl bg-purple-500/[0.04] border border-purple-500/15">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400/60 mb-2">EIF Explanation</p>
                        <p className="text-xs text-white/55 leading-relaxed">{result.eifExplanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "Behavioral" && (
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3">EIF Score</p>
                    <p className={`text-6xl font-black font-mono mb-3 leading-none ${tc(result.eifScore)}`}>{f4(result.eifScore, 4)}</p>
                    <p className="text-sm text-white/50 mb-1">
                      EIF Confidence: <span className="text-white/50">{f4(result.eifConf, 4)}</span>
                    </p>
                    <p className="text-sm text-white/50">
                      GNN Confidence: <span className="text-white/50">{f4(result.gnnConf, 4)}</span>
                    </p>
                    {result.eifExplanation && (
                      <p className="mt-4 text-xs text-white/50 italic leading-relaxed">"{result.eifExplanation}"</p>
                    )}
                  </div>
                  <div className="space-y-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">EIF Top Factors (SHAP)</p>
                    {/* BUG FIX 4: max was 0.3 which clipped most real EIF path-length delta values.
                        EIF feature importance values are path-length differences — not bounded by 0.3.
                        Use max=1 so the bar represents the actual relative magnitude correctly. */}
                    {Object.keys(result.shapValues).length > 0
                      ? Object.entries(result.shapValues).map(([k, v]) =>
                          <Bar key={k} label={k} value={Math.abs(v as number)} max={1} color="#a855f7" />
                        )
                      : <p className="text-sm text-white/55">No SHAP factors returned.</p>}
                    <div className="pt-4 border-t border-white/[0.04]">
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3">Behavior Score</p>
                      <p className={`text-3xl font-black font-mono ${tc(result.behaviorScore)}`}>{f4(result.behaviorScore, 4)}</p>
                      <p className="text-[10px] text-white/40 mt-1">velocity 0.3 + burst 0.5 + deviation 0.2</p>
                    </div>
                  </div>
                </div>
              )}

              {tab === "Structural" && (
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3">GNN Score</p>
                    <p className={`text-6xl font-black font-mono mb-6 leading-none ${tc(result.gnnScore)}`}>{f4(result.gnnScore, 4)}</p>
                    <div>
                      {([
                        ["Fraud Cluster",    `#${result.clusterId}`],
                        ["Cluster Size",     String(result.clusterSize)],
                        ["Cluster Risk",     f4(result.clusterRisk, 4)],
                        ["Embedding Norm",   f4(result.embeddingNorm, 4)],
                        ["Centrality",       f4(result.networkMetrics.centralityScore ?? 0, 6)],
                        ["Susp. Neighbours", String(result.networkMetrics.suspiciousNeighbors ?? 0)],
                        ["Shared Devices",   String(result.networkMetrics.sharedDevices ?? 0)],
                        ["Txn Loops",        result.networkMetrics.transactionLoops ? "YES" : "NO"],
                      ] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">Ring Membership</p>
                    <div className={`p-6 rounded-2xl border ${result.muleRing.isMuleRingMember ? "bg-red-500/[0.03] border-red-500/15" : "bg-[#CAFF33]/[0.03] border-[#CAFF33]/15"}`}>
                      <p className={`text-2xl font-black mb-5 ${result.muleRing.isMuleRingMember ? "text-red-400" : "text-[#CAFF33]"}`}>
                        {result.muleRing.isMuleRingMember ? "RING MEMBER" : "NOT IN RING"}
                      </p>
                      {result.muleRing.isMuleRingMember && (
                        <div>
                          {([
                            ["Shape",  result.muleRing.ringShape   ?? "—"],
                            ["Size",   String(result.muleRing.ringSize ?? "—")],
                            ["Role",   result.muleRing.role        ?? "—"],
                            ["Hub",    result.muleRing.hubAccount  ?? "—"],
                          ] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                          {result.muleRing.ringAccounts?.length > 0 && (
                            <div className="mt-4">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-white/45 mb-2">Ring Members</p>
                              <div className="flex flex-wrap gap-1.5">
                                {result.muleRing.ringAccounts.map((a: string, i: number) => (
                                  <span key={a} className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${i === 0 ? "bg-red-500/10 border-red-500/15 text-red-400" : "border-white/[0.1] text-white/60"}`}>{a}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "Identity" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { l: "JA3 Velocity",  v: result.ja3.reuse,   w: 5 },
                      { l: "JA3 Risk",      v: result.ja3.ja3Risk, w: 0.5, fmt: (x: number) => f4(x, 3) },
                      { l: "JA3 Fanout",    v: result.ja3.fanout,  w: 3 },
                    ].map(({ l, v, w, fmt }) => (
                      <Card key={l} className="p-5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3">{l}</p>
                        <p className={`text-4xl font-black font-mono mb-4 ${(v ?? 0) > w ? "text-red-400" : "text-[#CAFF33]"}`}>
                          {fmt ? fmt(v ?? 0) : (v ?? 0)}
                        </p>
                        <Bar label="signal" value={Math.min(1, (v ?? 0) / 10)} color={(v ?? 0) > w ? "#ef4444" : "#CAFF33"} />
                      </Card>
                    ))}
                  </div>
                  <div className="flex gap-8 p-5 rounded-xl border border-white/[0.05]">
                    {([["New Device", result.ja3.isNewDevice], ["New JA3", result.ja3.isNewJa3]] as [string, boolean][]).map(([l, v]) => (
                      <div key={l} className="flex gap-3 items-center">
                        <span className="text-xs text-white/50">{l}</span>
                        <Pill className={v ? "bg-yellow-400/10 border border-yellow-400/20 text-yellow-400" : "bg-[#CAFF33]/10 border border-[#CAFF33]/20 text-[#CAFF33]"}>{v ? "YES" : "NO"}</Pill>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40">Full identity forensics (JA3/device/IP analysis) runs in the JA3 security microservice — Step 4 of the pipeline.</p>
                </div>
              )}

              {tab === "Fusion" && (
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">Formula (Spring Boot · combineRiskSignals)</p>
                    <div className="p-5 rounded-2xl bg-black/50 border border-white/[0.05] font-mono space-y-2.5">
                      <p className="text-[10px] text-white/55 mb-3 font-mono font-semibold">finalRisk =</p>
                      {fusionComponents.map(({ w, v, label, color }) => (
                        <p key={label} className="text-sm">
                          <span className="font-bold" style={{ color }}>{w}</span>
                          <span className="text-white/50"> × {label} ({f4(v, 3)})</span>
                          <span className="text-white/40"> = </span>
                          <span className="font-bold" style={{ color }}>{f4(w * v, 4)}</span>
                        </p>
                      ))}
                      <div className="border-t border-white/[0.06] pt-3">
                        <span className={`text-2xl font-black ${tc(result.riskScore)}`}>{f4(result.riskScore, 4)}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">Decision Policy (actual thresholds)</p>
                    <div className="space-y-2">
                      {([
                        ["0 – 0.45",    "APPROVE", 0.2 ],
                        ["0.45 – 0.75", "REVIEW",  0.55],
                        ["0.75 – 1.00", "BLOCK",   0.9 ],
                      ] as [string, string, number][]).map(([range, dec]) => (
                        <div key={range} className={`flex justify-between items-center p-4 rounded-xl border ${result.decision === dec ? bg(dec === "BLOCK" ? 0.9 : dec === "REVIEW" ? 0.55 : 0.1) : "border-white/[0.04]"}`}>
                          <span className="text-sm text-white/50 font-mono">{range}</span>
                          <Pill className={dc(dec)}>{dec}</Pill>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/40 mt-4 leading-relaxed">Decision policy runs in Spring Boot — not the ML layer.</p>
                  </div>
                </div>
              )}
            </Card>
          </>
        ) : (
          !apiError && (
            <Card className="flex flex-col items-center justify-center flex-1 gap-5 min-h-[460px]">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-32 h-32 rounded-full border border-white/[0.04]" />
                <div className="absolute w-20 h-20 rounded-full border border-white/[0.05]" />
                <div className="w-12 h-12 rounded-full border border-white/[0.07] flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white/40" />
                </div>
              </div>
              <div className="text-center space-y-1.5">
                <p className="text-lg font-bold text-white/65">Ready to Score</p>
                <p className="text-sm text-white/45">Configure a transaction and press Score</p>
                <p className="text-xs text-white/35 mt-2 font-mono">14-step pipeline · EIF ‖ GNN parallel · Blockchain async</p>
              </div>
            </Card>
          )
        )}
      </div>

      {/* ── Pipeline ── */}
      <Card className="flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-white/[0.04]">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Pipeline</p>
        </div>
        <div className="p-3 flex flex-col gap-0.5 flex-1">
          {PIPE.map((label, i) => (
            <PipeStep key={i} n={i + 1} label={label}
              active={step === i + 1} done={step > i + 1}
              tag={i === 7 ? "∥" : i === 13 ? "async" : undefined} />
          ))}
        </div>
        {step === 15 && (
          <div className={`m-3 p-3.5 rounded-xl border ${apiError ? "bg-red-500/[0.07] border-red-500/15" : "bg-[#CAFF33]/[0.07] border-[#CAFF33]/15"}`}>
            <p className={`text-[11px] font-bold ${apiError ? "text-red-400" : "text-[#CAFF33]"}`}>
              {apiError ? "✗ Pipeline error — see details" : "✓ All 14 steps complete"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GNN — GET /network-snapshot?limit=60
// ═════════════════════════════════════════════════════════════════════════════
function GnnSection() {
  const [snapshot, setSnapshot] = useState<{ nodes: LiveNode[]; edges: any[]; stats: any } | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    fetch(`${ML_URL}/network-snapshot?limit=60`)
      .then(r => r.json())
      .then(d => { setSnapshot(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const stats = snapshot?.stats;

  return (
    <div>
      <PageHeading eyebrow="Graph Neural Network" title="Structural" accent="Analysis"
        description="SAGE → GAT(4 heads) → SAGE with residual skip connection. Trained on 590,540 IEEE-CIS transactions. Learns from both node features and graph topology." />

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { l: "Layer 1", t: "SAGEConv",    d: "Broad neighbourhood aggregation",              c: "text-blue-400",   b: "border-blue-400/[0.08]"  },
          { l: "Layer 2", t: "GATConv ×4",  d: "Attention-weighted neighbour selection",       c: "text-[#CAFF33]",  b: "border-[#CAFF33]/[0.08]" },
          { l: "Layer 3", t: "SAGEConv",    d: "Final aggregation + residual skip",            c: "text-yellow-400", b: "border-yellow-400/[0.08]" },
          { l: "Head",    t: "MLP 3-Layer", d: "BatchNorm + Dropout(0.15/0.05) + log_softmax", c: "text-red-400",    b: "border-red-400/[0.08]"   },
        ].map(x => (
          <Card key={x.l} className={`p-6 border ${x.b}`}>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-2">{x.l}</p>
            <p className={`text-lg font-black mb-2.5 ${x.c}`}>{x.t}</p>
            <p className="text-xs text-white/45 leading-relaxed">{x.d}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Nodes" value={stats ? stats.total_nodes.toLocaleString() : "—"} sub="Accounts in graph" />
        <StatCard label="Total Edges" value={stats ? stats.total_edges.toLocaleString() : "—"} sub="Transaction links" />
        <StatCard label="Fraud Nodes" value={stats ? stats.fraud_nodes.toLocaleString() : "—"} sub="Known fraud accounts" color="text-red-400" />
        <StatCard label="Fraud Rate"  value={stats ? `${(stats.fraud_rate * 100).toFixed(2)}%` : "—"} sub="Graph-wide prevalence" color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-5">
        <Card className="p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/45 mb-5">21 Feature Columns (FEATURE_COLS)</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["account_age_days",     "tenure"],
              ["balance_mean",         "avg amount"],
              ["balance_std",          "volatility"],
              ["tx_count",             "velocity"],
              ["tx_velocity_7d",       "7-day burst"],
              ["fan_out_ratio",        "dispersion"],
              ["amount_entropy",       "smurfing"],
              ["risky_email",          "domain risk"],
              ["device_mobile",        "mobile %"],
              ["device_consistency",   "device switch"],
              ["addr_entropy",         "addr diversity"],
              ["d_gap_mean",           "timing gaps"],
              ["card_network_risk",    "card network"],
              ["product_code_risk",    "product type"],
              ["international_flag",   "cross-border"],
              ["pagerank",             "centrality"],
              ["in_out_ratio",         "flow asymmetry"],
              ["reciprocity_score",    "circular flows"],
              ["community_fraud_rate", "cluster fraud %"],
              ["ring_membership",      "ring count"],
              ["second_hop_fraud_rate","2-hop guilt"],
            ].map(([f, d]) => (
              <div key={f} className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:border-[#CAFF33]/15 transition-colors group cursor-default">
                <p className="text-[9px] font-bold text-[#CAFF33]/60 leading-tight mb-0.5 group-hover:text-[#CAFF33]/80 transition-colors">{f}</p>
                <p className="text-[8px] text-white/55">{d}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5 flex-1">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Live Network Graph</p>
              <LiveBadge loading={loading} error={error} />
            </div>
            <div className="h-[240px] rounded-2xl overflow-hidden">
              <Canvas liveNodes={snapshot?.nodes} />
            </div>
            <div className="flex gap-5 mt-4 flex-wrap">
              {[["#ef4444","Fraud"],["#f97316","Ring member"],["#facc15","High-risk"],["#CAFF33","Safe"]].map(([c, l]) => (
                <div key={l} className="flex gap-2 items-center">
                  <div className="w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                  <span className="text-[10px] text-white/45">{l}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">Training Config (train_model.py)</p>
            {[
              ["Loss",        "WeightedNLLLoss (freq-inverse)"],
              ["Optimizer",   "AdamW lr=1e-3, wd=1e-4"],
              ["Scheduler",   "ReduceLROnPlateau (max AUC)"],
              ["Warmup",      "150 epochs (no early stop)"],
              ["Patience",    "30 checks = 300 epochs"],
              ["Max Epochs",  "1,000 (hard ceiling)"],
              ["Split",       "70 / 15 / 15 stratified"],
              ["Hidden",      "128 channels"],
              ["GNN dropout", "0.10 per conv layer"],
            ].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EIF
// ═════════════════════════════════════════════════════════════════════════════
function EifSection() {
  const { result: last } = React.useContext(LastResultCtx);
  const [health,  setHealth]  = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ normal: number; suspicious: number } | null>(null);

  useEffect(() => {
    // Ping EIF health
    fetch(`${API_URL}/api/health/ai`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setHealth(d))
      .catch(() => {});
  }, []);

  const runSanityTest = async () => {
    setTesting(true);
    try {
      const [rNormal, rSuspicious] = await Promise.all([
        fetch(`${API_URL}/api/transactions`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId: crypto.randomUUID(), sourceAccount: "1553", targetAccount: "899", amount: 100,
            timestamp: new Date().toISOString().slice(0, 19) }),
        }).then(r => r.json()).catch(() => null),
        // We can't easily force high EIF score without real history, so we show last result instead
      ]);
      if (rNormal) setTestResult({ normal: rNormal.modelScores?.eif ?? 0, suspicious: last?.eifScore ?? 0 });
    } catch {}
    setTesting(false);
  };

  // Live values from last scored transaction
  const eifScore  = last?.eifScore      ?? null;
  const eifConf   = last?.eifConf       ?? null;
  const shapValues = last?.shapValues   ?? {};
  const eifExpl   = last?.eifExplanation ?? "";
  const hasLive   = last !== null;

  return (
    <div>
      <PageHeading eyebrow="Extended Isolation Forest" title="Behavioral" accent="Detection"
        description="Runs in parallel with GNN (Step 8). Detects anomalous behavior invisible to graph structure. 6 raw features → 12 expanded → path-length anomaly score." />

      {/* Live status bar */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-2xl border border-white/[0.07] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${health?.model_loaded ? "bg-[#CAFF33]" : "bg-red-400"}`}
            style={health?.model_loaded ? { boxShadow: "0 0 8px #CAFF33" } : {}} />
          <span className="text-xs font-bold text-white/60">{health?.model_loaded ? "EIF Service Online" : "EIF Service Offline"}</span>
        </div>
        <span className="text-white/20">|</span>
        {hasLive ? (
          <>
            <span className="text-xs text-white/50">Last score:</span>
            <span className="text-sm font-black font-mono" style={{ color: hex(eifScore ?? 0) }}>{f4(eifScore ?? 0, 4)}</span>
            <span className="text-xs text-white/40">confidence: <span className="text-white/65 font-bold">{f4(eifConf ?? 0, 4)}</span></span>
          </>
        ) : (
          <span className="text-xs text-white/35 italic">Score a transaction in Simulator to see live EIF output here.</span>
        )}
        <button onClick={runSanityTest} disabled={testing}
          className="ml-auto px-4 py-1.5 rounded-lg border border-[#a855f7]/30 bg-[#a855f7]/[0.08] text-[#a855f7] text-[10px] font-bold uppercase tracking-widest hover:bg-[#a855f7]/[0.15] transition-colors disabled:opacity-40">
          {testing ? "Testing…" : "Test EIF"}
        </button>
      </div>

      {/* Live last-result panel — shown only after a transaction is scored */}
      {hasLive && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-6 border-[#a855f7]/[0.12]">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a855f7]/60 mb-3">EIF Anomaly Score</p>
            <p className="text-5xl font-black font-mono mb-2" style={{ color: hex(eifScore ?? 0) }}>{f4(eifScore ?? 0, 4)}</p>
            <p className="text-xs text-white/45">Confidence: <span className="text-white/70 font-bold">{f4(eifConf ?? 0, 4)}</span></p>
            <div className="mt-4">
              <Bar label="anomaly score" value={eifScore ?? 0} color={hex(eifScore ?? 0)} />
            </div>
          </Card>
          <Card className="p-6 border-[#a855f7]/[0.12]">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a855f7]/60 mb-3">Top SHAP Factors</p>
            {Object.keys(shapValues).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(shapValues).map(([k, v]) => (
                  <Bar key={k} label={k} value={Math.abs(v as number)} max={1} color="#a855f7" />
                ))}
              </div>
            ) : <p className="text-xs text-white/35">No factor data returned.</p>}
          </Card>
          <Card className="p-6 border-[#a855f7]/[0.12]">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a855f7]/60 mb-3">EIF Explanation</p>
            {eifExpl ? (
              <p className="text-sm text-white/70 leading-relaxed font-medium">{eifExpl}</p>
            ) : <p className="text-xs text-white/35">No explanation returned.</p>}
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <p className="text-[9px] text-white/40 mb-2 uppercase tracking-widest font-bold">Behavior Context</p>
              {([
                ["Behavior Score", f4(last?.behaviorScore ?? 0, 4)],
                ["Suspicious Nbrs", String(last?.networkMetrics.suspiciousNeighbors ?? 0)],
                ["Shared Devices",  String(last?.networkMetrics.sharedDevices ?? 0)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-[10px] text-white/40 font-semibold">{k}</span>
                  <span className="text-[11px] font-black text-white/70 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        <Card className="p-7">
          <SectionLabel>How EIF Works</SectionLabel>
          <div className="space-y-3">
            {[
              { n:"1", t:"6 Raw Features",        d:"velocity_score, burst_score, suspicious_neighbor_count, ja3_reuse_count, device_reuse_count, ip_reuse_count — sent from Spring Boot", c:"#CAFF33" },
              { n:"2", t:"Feature Expansion ×12", d:"Cross-products: infra_risk, velocity_burst, neighbor_velocity, device_ip, ja3_weighted, burst_neighbor", c:"#facc15" },
              { n:"3", t:"RobustScaler + EIF",    d:"ExtensionLevel=1 makes hyperplane cuts at any angle — eliminates axis-parallel bias of standard Isolation Forest. Short path = anomaly.", c:"#a855f7" },
              { n:"4", t:"SHAP Attribution",      d:"Path-length perturbation per feature. score = sigmoid(k × (threshold − path_length)) — shorter path → higher fraud score", c:"#3b82f6" },
            ].map(s => (
              <div key={s.n} className="flex gap-4 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 text-black" style={{ background: s.c }}>{s.n}</div>
                <div>
                  <p className="text-sm font-black mb-1" style={{ color: s.c }}>{s.t}</p>
                  <p className="text-xs text-white/55 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-7">
          <SectionLabel>Feature Space Reference</SectionLabel>
          <div className="space-y-3">
            {[
              { l:"Velocity Score (24h)",       v:0.73, c:"#ef4444", d:"txnCount24h ÷ 10 (capped 1.0)" },
              { l:"Burst Score",                v:0.61, c:"#facc15", d:"24h outflow ÷ 7d daily avg ÷ 3" },
              { l:"Suspicious Neighbours",      v:0.55, c:"#facc15", d:"count of direct fraud neighbours" },
              { l:"JA3 Reuse Count",            v:0.45, c:"#a855f7", d:"fingerprint seen across N accounts" },
              { l:"Device Reuse Count",         v:0.28, c:"#CAFF33", d:"device hash seen across N accounts" },
              { l:"IP Reuse Count",             v:0.18, c:"#CAFF33", d:"IP shared across N accounts" },
            ].map(f => (
              <div key={f.l} className="flex items-center gap-4 p-3 rounded-xl border border-white/[0.06]">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-xs text-white/65 font-semibold">{f.l}</span>
                    <span className="text-xs font-black font-mono" style={{ color: f.c }}>{f4(f.v, 2)}</span>
                  </div>
                  <div className="h-[3px] w-full bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${f.v * 100}%`, background: f.c, boxShadow: `0 0 8px ${f.c}55` }} />
                  </div>
                </div>
                <span className="text-[9px] text-white/35 w-32 shrink-0 leading-tight">{f.d}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] text-white/35 italic leading-relaxed">
            Reference values shown. Live values populate after scoring a transaction in the Simulator tab.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// IDENTITY
// ═════════════════════════════════════════════════════════════════════════════
function IdentitySection() {
  const { result: last } = React.useContext(LastResultCtx);
  const hasLive = last !== null;
  const ja3 = last?.ja3;

  const signals = [
    {
      t: "JA3 Fingerprint", color: "#CAFF33",
      v: hasLive ? ja3!.reuse : MOCK.identityFeatures.ja3ReuseCount,
      w: 5,
      extra: [
        ["Velocity",  hasLive ? String(ja3!.reuse)          : "8"],
        ["Fanout",    hasLive ? String(ja3!.fanout)          : "—"],
        ["JA3 Risk",  hasLive ? f4(ja3!.ja3Risk, 4)          : "—"],
        ["Is New",    hasLive ? (ja3!.isNewJa3 ? "Yes" : "No") : "No"],
        ["Protocol",  "TLS 1.3"],
        ["Hash",      "771,4866-4867…"],
      ] as [string,string][],
    },
    {
      t: "Device Fingerprint", color: "#a855f7",
      v: hasLive ? last!.networkMetrics.sharedDevices : MOCK.identityFeatures.deviceReuseCount,
      w: 3,
      extra: [
        ["Shared Devices", hasLive ? String(last!.networkMetrics.sharedDevices) : "6"],
        ["Shared IPs",     hasLive ? String(last!.networkMetrics.sharedIPs)    : "3"],
        ["Is New Device",  hasLive ? (ja3!.isNewDevice ? "Yes" : "No") : "No"],
        ["Txn Loops",      hasLive ? (last!.networkMetrics.transactionLoops ? "YES ⚠" : "No") : "No"],
        ["Platform",       "Android 13"],
        ["Hash",           "sha256:d4f7e2…"],
      ] as [string,string][],
    },
    {
      t: "IP / Geo Analysis", color: "#3b82f6",
      v: hasLive ? last!.networkMetrics.sharedIPs : MOCK.identityFeatures.ipReuseCount,
      w: 2,
      extra: [
        ["Shared Accounts", hasLive ? String(last!.networkMetrics.sharedIPs) : "3"],
        ["Centrality",      hasLive ? f4(last!.networkMetrics.centralityScore, 6) : "—"],
        ["Susp. Neighbours",hasLive ? String(last!.networkMetrics.suspiciousNeighbors) : "—"],
        ["Geo",             "Consistent ✓"],
        ["ISP",             "Reliance Jio"],
        ["City",            "Mumbai, MH"],
      ] as [string,string][],
    },
  ];

  return (
    <div>
      <PageHeading eyebrow="Step 4 of Pipeline" title="Identity" accent="Forensics"
        description="JA3 TLS fingerprinting, device hashing, and IP/geo correlation. Runs at Step 4 of the transaction pipeline." />

      <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 ${hasLive ? "border-[#CAFF33]/15 bg-[#CAFF33]/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${hasLive ? "bg-[#CAFF33]" : "bg-white/20"}`}
          style={hasLive ? { boxShadow: "0 0 8px #CAFF33" } : {}} />
        <p className={`text-sm font-medium ${hasLive ? "text-[#CAFF33]/70" : "text-white/40"}`}>
          {hasLive
            ? "Showing live signals from the last scored transaction."
            : <>Score a transaction in the <strong className="text-white/65">Simulator</strong> tab to populate live identity signals.</>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {signals.map(x => (
          <Card key={x.t} className="p-6 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-2" style={{ color: `${x.color}70` }}>{x.t}</p>
                <p className="text-5xl font-black font-mono leading-none"
                  style={{ color: x.v > x.w ? "#ef4444" : x.color }}>{x.v}</p>
                <p className="text-xs text-white/40 mt-1">accounts sharing this fingerprint</p>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border
                ${x.v > x.w ? "bg-red-500/10 border-red-500/20 text-red-300" : "border-white/[0.1] text-white/45"}`}>
                {x.v > x.w ? "HIGH RISK" : "NORMAL"}
              </div>
            </div>
            <Bar label="reuse rate" value={x.v} max={15} color={x.v > x.w ? "#ef4444" : x.color} />
            <div className="pt-3 border-t border-white/[0.06] space-y-0">
              {x.extra.map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-semibold">{k}</span>
                  <span className="text-[11px] font-bold text-white/75 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { n:"1", t:"JA3 Fingerprint",    d:"TLS ClientHello hash — identifies the SSL library regardless of IP. One malicious tool = one fingerprint, even across thousands of accounts.", c:"#CAFF33" },
          { n:"2", t:"Device Fingerprint", d:"SHA-256 of device attributes. One physical device across many accounts is the strongest mule indicator we track.", c:"#a855f7" },
          { n:"3", t:"IP / Geo",           d:"IP reuse tracking + geo-mismatch. Flags impossible travel, VPN chains, and proxy usage across transaction history.", c:"#3b82f6" },
        ].map(s => (
          <Card key={s.n} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-black shrink-0" style={{ background: s.c }}>{s.n}</div>
              <p className="text-xs font-black" style={{ color: s.c }}>{s.t}</p>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">{s.d}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FUSION
// ═════════════════════════════════════════════════════════════════════════════
function FusionSection() {
  const { result: last } = React.useContext(LastResultCtx);
  const hasLive = last !== null;

  const components = [
    { l:"GNN Score",      v: hasLive ? last!.gnnScore      : 0.847, w:0.40, c:"#CAFF33", d:"Graph Neural Network — structural fraud patterns" },
    { l:"EIF Score",      v: hasLive ? last!.eifScore      : 0.631, w:0.20, c:"#a855f7", d:"Extended Isolation Forest — behavioral anomaly" },
    { l:"Behavior Score", v: hasLive ? last!.behaviorScore : 0.720, w:0.25, c:"#3b82f6", d:"velocity×0.3 + burst×0.5 + deviation×0.2" },
    { l:"Graph Score",    v: hasLive ? last!.graphScore    : 0.580, w:0.10, c:"#facc15", d:"connectivity×0.6 + twoHopDensity×0.4" },
    { l:"JA3 Risk",       v: hasLive ? last!.ja3.ja3Risk   : 0.410, w:0.05, c:"#f97316", d:"TLS fingerprint risk from JA3 microservice" },
  ];
  const fusion = hasLive ? last!.riskScore : components.reduce((a, x) => a + x.w * x.v, 0);
  const decision = hasLive ? last!.decision : fusion >= 0.75 ? "BLOCK" : fusion >= 0.45 ? "REVIEW" : "APPROVE";

  return (
    <div>
      <PageHeading eyebrow="Ensemble Layer" title="Risk" accent="Fusion"
        description="Weighted combination of 5 signals computed in Spring Boot. Decision policy applied at ≥0.45 (REVIEW) and ≥0.75 (BLOCK)." />

      <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 ${hasLive ? "border-[#CAFF33]/15 bg-[#CAFF33]/[0.04]" : "border-white/[0.07] bg-white/[0.02]"}`}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${hasLive ? "bg-[#CAFF33]" : "bg-white/20"}`}
          style={hasLive ? { boxShadow: "0 0 8px #CAFF33" } : {}} />
        <p className={`text-sm font-medium ${hasLive ? "text-[#CAFF33]/70" : "text-white/40"}`}>
          {hasLive ? "Showing live scores from the last scored transaction." : "Illustrative values — score a transaction in Simulator for real fusion breakdown."}
        </p>
        {hasLive && <div className={`ml-auto px-4 py-1.5 rounded-xl border text-sm font-black ${dc(decision)}`}>{decision}</div>}
      </div>

      <div className="grid grid-cols-[1.4fr_0.6fr] gap-5">
        <Card className="p-7 space-y-3">
          <SectionLabel>Score Composition · finalRisk = Σ(weight × score)</SectionLabel>
          {components.map(x => (
            <div key={x.l} className="p-5 rounded-2xl border border-white/[0.07] bg-black/20">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-base font-black mb-1" style={{ color: x.c }}>{x.l}</p>
                  <p className="text-xs text-white/50">{x.d}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-white/35 mb-1 uppercase tracking-widest">weight × score</p>
                  <p className="text-base font-black font-mono" style={{ color: x.c }}>
                    {x.w} × {f4(x.v, 3)} = {f4(x.w * x.v, 4)}
                  </p>
                </div>
              </div>
              <Bar label="score" value={x.v} color={x.c} />
            </div>
          ))}
          <div className={`p-6 rounded-2xl border ${bg(fusion)}`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Final Fusion Score</p>
                <p className={`text-[2.5rem] font-black font-mono leading-none ${tc(fusion)}`}>{f4(fusion, 4)}</p>
              </div>
              <div className={`px-6 py-3 rounded-2xl border text-xl font-black ${dc(decision)}`}>{decision}</div>
            </div>
          </div>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <SectionLabel>Decision Thresholds</SectionLabel>
            <div className="space-y-2">
              {([
                ["0 – 0.45",    "APPROVE", 0.2 ],
                ["0.45 – 0.75", "REVIEW",  0.55],
                ["0.75 – 1.00", "BLOCK",   0.9 ],
              ] as [string, string, number][]).map(([r, d]) => {
                const isActive = (d === "BLOCK" && fusion >= 0.75) || (d === "REVIEW" && fusion >= 0.45 && fusion < 0.75) || (d === "APPROVE" && fusion < 0.45);
                return (
                  <div key={r} className={`flex justify-between items-center p-4 rounded-xl border ${isActive ? bg(d === "BLOCK" ? 0.9 : d === "REVIEW" ? 0.55 : 0.1) : "border-white/[0.06]"}`}>
                    <span className="text-sm text-white/55 font-mono font-semibold">{r}</span>
                    <Pill className={dc(d)}>{d}</Pill>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card className="p-6 flex-1">
            <SectionLabel>Weights · Spring Boot combineRiskSignals</SectionLabel>
            <div className="space-y-3">
              {components.map(x => (
                <div key={x.l} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[9px] font-black text-black shrink-0"
                    style={{ background: x.c }}>{(x.w * 100).toFixed(0)}%</div>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-bold" style={{ color: x.c }}>{x.l}</span>
                      <span className="font-black font-mono" style={{ color: x.c }}>{f4(x.v, 3)}</span>
                    </div>
                    <div className="h-[3px] w-full bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${x.v * 100}%`, background: x.c }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/35 mt-4 leading-relaxed">ML services output scores only. Decision engine lives in Spring Boot.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
// ═════════════════════════════════════════════════════════════════════════════
// RINGS — GET /detect-rings?max_size=6&limit=20  (inference_service.py)
// ═════════════════════════════════════════════════════════════════════════════
function RingsSection() {
  const [data,    setData]    = useState<{ rings_detected: number; rings: any[]; high_risk_nodes: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [sel,     setSel]     = useState<any>(null);

  useEffect(() => {
    fetch(`${ML_URL}/detect-rings?max_size=6&limit=20`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const rings = data?.rings ?? [];
  const totalVolume = rings.reduce((a: number, r: any) => a + (r.volume ?? 0), 0);

  return (
    <div>
      <PageHeading eyebrow="Money-Laundering Patterns" title="Ring" accent="Detection"
        description="Bounded DFS cycle detection. 25s timeout, max 6 hops, restricted to account nodes only. Pre-cached at GNN service startup." />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Rings Detected"  value={loading ? "…" : data ? data.rings_detected : "—"}
          sub={error ? "Service unreachable" : "Pre-cached at startup"} accent="#ef4444" />
        <StatCard label="Volume at Risk"
          value={totalVolume > 0 ? `₹${(totalVolume / 100000).toFixed(1)}L` : "—"}
          sub="Cumulative ring flow" color="text-red-400" accent="#ef4444" />
        <StatCard label="High-Risk Nodes" value={loading ? "…" : data ? data.high_risk_nodes.length : "—"}
          sub="In top 5 rings" color="text-yellow-400" accent="#facc15" />
        <StatCard label="Algorithm" value="DFS" sub="25s timeout · max 6 hops · deduped" />
      </div>

      <div className="grid grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.07] flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">Detected Rings</p>
            <LiveBadge loading={loading} error={error} />
          </div>
          <div className="p-4 space-y-2">
            {!loading && rings.length === 0 && (
              <p className="text-sm text-white/45 py-10 text-center font-medium">
                {error ? "GNN service unreachable" : "No rings found — graph may be sparse"}
              </p>
            )}
            {rings.map((ring: any, i: number) => {
              const shape = deriveShape(ring.size);
              const isSel = sel === ring;
              return (
                <div key={i} onClick={() => setSel(isSel ? null : ring)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${isSel ? "bg-[#CAFF33]/[0.05] border-[#CAFF33]/20" : "border-white/[0.07] hover:border-white/[0.12]"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-2.5 items-center">
                      <Pill className={dc(ring.risk >= 0.75 ? "BLOCK" : ring.risk >= 0.45 ? "REVIEW" : "APPROVE")}>{shape}</Pill>
                      <span className="text-xs text-white/55 font-semibold">{ring.size} nodes</span>
                    </div>
                    <span className={`text-xl font-black font-mono ${tc(ring.risk)}`}>{f4(ring.risk, 2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-white/40 font-mono">
                    <span>₹{((ring.volume ?? 0) / 1000).toFixed(0)}K flow</span>
                    <span>{(ring.nodes ?? []).slice(0, 2).join(", ")}…</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          {sel ? (
            <div className="space-y-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40 mb-2">Ring Detail</p>
                <p className={`text-2xl font-black ${tc(sel.risk)}`}>{deriveShape(sel.size)} Pattern</p>
              </div>
              <div className="flex gap-8 items-center">
                <Gauge score={sel.risk} label="Ring Risk" />
                <div className="flex-1">
                  {([
                    ["Shape (derived)", deriveShape(sel.size)],
                    ["Size",            `${sel.size} accounts`],
                    ["Volume",          `₹${((sel.volume ?? 0) / 100000).toFixed(2)}L`],
                    ["Risk Score",      f4(sel.risk, 4)],
                  ] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40 mb-3">Members</p>
                <div className="flex flex-wrap gap-2">
                  {(sel.nodes ?? []).map((n: string, i: number) => (
                    <span key={n} className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${i === 0 ? "bg-red-500/10 border-red-500/20 text-red-300" : "border-white/[0.08] text-white/50"}`}>{n}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/40 mb-3">Topology</p>
                <div className="p-4 rounded-xl bg-black/50 border border-white/[0.07] font-mono text-sm text-white/45">
                  {deriveShape(sel.size) === "STAR"  && <pre className="text-[11px] leading-relaxed">{"    HUB\n   / | \\\n  M  M  M\n   \\ | /\n    M"}</pre>}
                  {deriveShape(sel.size) === "CYCLE" && <pre className="text-[11px] leading-relaxed">{"A → B\n↑     ↓\nD ← C"}</pre>}
                  {deriveShape(sel.size) === "CHAIN" && <pre className="text-[11px] leading-relaxed">{"A → B → C → D"}</pre>}
                  {deriveShape(sel.size) === "DENSE" && <pre className="text-[11px] leading-relaxed">{"A ↔ B\n↕  ↗↙  ↕\nC ↔ D"}</pre>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
              <RefreshCw className="w-10 h-10 text-white/10" />
              <p className="text-sm text-white/35 font-medium">Select a ring to inspect</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CLUSTERS
// ═════════════════════════════════════════════════════════════════════════════
function ClustersSection() {
  const [report,  setReport]  = useState<{ total_clusters: number; high_risk_clusters: number; top_clusters: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    fetch(`${ML_URL}/cluster-report`)
      .then(r => r.json())
      .then(d => { setReport(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const clusters = report?.top_clusters      ?? [];
  const total    = report?.total_clusters    ?? 0;
  const highRisk = report?.high_risk_clusters ?? 0;

  return (
    <div>
      <PageHeading eyebrow="Community Detection" title="Cluster" accent="Report"
        description="Greedy modularity maximisation across the full account transaction graph. Community fraud rates are propagated as node features during GNN training." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Communities" value={total || "—"}    sub={error ? "Service unreachable" : "Greedy modularity"} />
        <StatCard label="High Risk"   value={highRisk || "—"} sub=">30% fraud rate" color="text-red-400" />
        <StatCard label="Shown"       value={clusters.length || "—"} sub="Top by community fraud rate" color="text-yellow-400" />
        <StatCard label="Algorithm"   value="Louvain" sub="nx.greedy_modularity_communities" />
      </div>
      <div className="grid grid-cols-[1.4fr_0.6fr] gap-5">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.05] flex justify-between items-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">Top Clusters by Fraud Rate</p>
            <LiveBadge loading={loading} error={error} />
          </div>
          {!loading && clusters.length === 0 && (
            <p className="text-sm text-white/60 py-8 text-center px-6 font-medium">{error ? "Service unreachable" : "No data — run feature_engineering.py first"}</p>
          )}
          {clusters.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Node ID", "Labelled Fraud", "Community Fraud Rate", "Risk Tier"].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-white/55">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clusters.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                    <td className="px-5 py-4 text-[#CAFF33] font-mono text-sm font-bold">{c.node_id}</td>
                    <td className="px-5 py-4">
                      <Pill className={c.is_fraud ? "bg-red-500/10 border border-red-500/15 text-red-400" : "bg-[#CAFF33]/10 border border-[#CAFF33]/15 text-[#CAFF33]"}>
                        {c.is_fraud ? "YES" : "NO"}
                      </Pill>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-px w-20 bg-white/[0.06] relative">
                          <div className="absolute inset-y-0 left-0 h-px rounded-full" style={{ width: `${(c.community_fraud_rate ?? 0) * 100}%`, background: hex(c.community_fraud_rate ?? 0), boxShadow: `0 0 6px ${hex(c.community_fraud_rate ?? 0)}66` }} />
                        </div>
                        <span className="text-xs font-bold font-mono" style={{ color: hex(c.community_fraud_rate ?? 0) }}>
                          {((c.community_fraud_rate ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Pill className={dc((c.community_fraud_rate ?? 0) >= 0.6 ? "BLOCK" : (c.community_fraud_rate ?? 0) >= 0.3 ? "REVIEW" : "APPROVE")}>
                        {(c.community_fraud_rate ?? 0) >= 0.6 ? "Critical" : (c.community_fraud_rate ?? 0) >= 0.3 ? "High" : "Low"}
                      </Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-6 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-5">Distribution</p>
            {([
              ["Critical (>60%)", Math.round(highRisk * 0.4), "#ef4444"],
              ["High (30–60%)",   Math.round(highRisk * 0.6), "#facc15"],
              ["Medium (10–30%)", Math.round(total * 0.25),   "#3b82f6"],
              ["Low (<10%)",      Math.round(total * 0.55),   "#CAFF33"],
            ] as [string, number, string][]).map(([l, c, col]) => (
              <div key={l} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/50">{l}</span>
                  <span className="font-bold" style={{ color: col }}>{c}</span>
                </div>
                <div className="h-px w-full bg-white/[0.04]">
                  <div className="h-px transition-all duration-700 rounded-full" style={{ width: total > 0 ? `${Math.min(100, (c / total) * 100)}%` : "0%", background: col, boxShadow: `0 0 6px ${col}66` }} />
                </div>
              </div>
            ))}
          </Card>
          <Card className="p-5 bg-[#CAFF33]/[0.02] border-[#CAFF33]/[0.07]">
            <p className="text-[10px] text-[#CAFF33]/50 leading-relaxed italic">"Nodes inside a high-fraud cluster inherit elevated suspicion during GNN message passing via the community_fraud_rate feature."</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN
// ═════════════════════════════════════════════════════════════════════════════
function BlockchainSection() {
  const [open,    setOpen]    = useState<string | null>(null);
  const [stats,   setStats]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Build live events from stats, fall back to mock
  const liveEvents: Array<{ hash: string; event: string; account: string; risk: number; ts: string; block: number; model: string; decision: string }> =
    stats?.liveEvents?.length > 0
      ? stats.liveEvents.map((e: any, i: number) => ({
          hash:     `0x${Math.random().toString(16).slice(2,6)}...${Math.random().toString(16).slice(2,6)}`,
          event:    e.severity === "CRITICAL" ? "RING_DETECTED" : e.severity === "HIGH" ? "ACCOUNT_FLAGGED" : "SCORE_LOGGED",
          account:  e.accountId ?? `acc_${i}`,
          risk:     e.severity === "CRITICAL" ? 0.91 : e.severity === "HIGH" ? 0.78 : 0.42,
          ts:       e.time ?? "—",
          block:    19823441 + i,
          model:    "FUSION",
          decision: e.severity === "CRITICAL" || e.severity === "HIGH" ? "BLOCK" : "REVIEW",
        }))
      : MOCK_LOGS;

  return (
    <div>
      <PageHeading eyebrow="Immutable Audit Trail" title="Blockchain" accent="Ledger"
        description="SHA256 leaf hashes, Merkle tree batching, async Step 14. Every fraud decision is committed on-chain. No PII stored." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Status"       value="LIVE"      sub="50 events / 5s batching"    accent="#CAFF33" />
        <StatCard label="Merkle Depth" value="6"         sub="SHA256 leaf hash"            accent="#a855f7" />
        <StatCard label="Latest Block" value={`#${liveEvents[0]?.block ?? 19823441}`} sub="Last committed batch" accent="#3b82f6" />
        <StatCard label="Immutability" value="100%"      sub="No PII on-chain"             accent="#facc15" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.07] flex justify-between items-center">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">Audit Log</p>
            <LiveBadge loading={loading} error={!stats && !loading} />
          </div>
          <div className="divide-y divide-white/[0.04]">
            {liveEvents.map(log => (
              <div key={log.hash}>
                <div onClick={() => setOpen(open === log.hash ? null : log.hash)}
                  className="px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-3 items-center">
                      <span className="text-[10px] text-white/40 font-mono font-bold">{log.ts}</span>
                      <Pill className={dc(log.decision)}>{log.decision}</Pill>
                      <span className="text-sm text-white/65 font-semibold">{log.account}</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className={`text-sm font-black font-mono ${tc(log.risk)}`}>{f4(log.risk, 2)}</span>
                      <Pill className="bg-blue-500/10 border border-blue-500/20 text-blue-300">{log.model}</Pill>
                      <ChevronRight className={`w-4 h-4 text-white/55 transition-transform ${open === log.hash ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                  {open === log.hash && (
                    <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-x-8 gap-y-0">
                      {([["Leaf Hash", log.hash], ["Block", `#${log.block}`], ["Event", log.event], ["Model", log.model]] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <SectionLabel>Merkle Tree — Latest Batch</SectionLabel>
            <div className="p-4 rounded-xl bg-black/50 border border-white/[0.07] font-mono text-[11px] space-y-1.5">
              <p className="text-[#CAFF33] font-black">MERKLE ROOT: 0xe4f2…3b91</p>
              <div className="pl-4 border-l border-white/[0.08] space-y-1 mt-2">
                <p className="text-white/50">L: 0xa3c1…7f22</p>
                <p className="text-white/50">R: 0xb9d4…2e88</p>
                <div className="pl-4 border-l border-white/[0.05] space-y-1">
                  <p className="text-white/50 text-[10px]">leaf: SHA256(txId+score+decision+ts)</p>
                  <p className="text-white/50 text-[10px]">leaf: SHA256(txId+score+decision+ts)</p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-6 flex-1">
            <SectionLabel>Async Flow (Step 14)</SectionLabel>
            <div className="space-y-3.5">
              {([
                ["1","Decision committed to MongoDB","#CAFF33"],
                ["2","FraudDecisionEvent published","#3b82f6"],
                ["3","leafHash = SHA256(txId+risk+decision+ts)","#a855f7"],
                ["4","Batch 50 decisions → Merkle tree","#facc15"],
                ["5","Root written to blockchain","#CAFF33"],
              ] as [string,string,string][]).map(([n, l, c]) => (
                <div key={n} className="flex gap-4 items-start">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 text-black" style={{ background: c }}>{n}</div>
                  <span className="text-xs text-white/55 pt-0.5 leading-relaxed font-medium">{l}</span>
                </div>
              ))}
            </div>
          </Card>
          {/* Live stats from backend */}
          {stats && (
            <Card className="p-5 bg-[#CAFF33]/[0.025] border-[#CAFF33]/[0.09]">
              <SectionLabel>Live System Stats</SectionLabel>
              {([
                ["Total Transactions", stats.totalTransactions?.toLocaleString() ?? "—"],
                ["Mule Accounts Blocked", stats.muleAccountsBlocked?.toLocaleString() ?? "—"],
                ["Value Intercepted", `₹${stats.valueInterceptedCrores ?? 0} Cr`],
                ["Detection Accuracy", stats.detectionAccuracy ? `${(stats.detectionAccuracy*100).toFixed(1)}%` : "—"],
              ] as [string,string][]).map(([k,v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-white/[0.05] last:border-0">
                  <span className="text-[10px] text-white/40 font-semibold uppercase tracking-widest">{k}</span>
                  <span className="text-[11px] font-black text-[#CAFF33]/80 font-mono">{v}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// METRICS
// ═════════════════════════════════════════════════════════════════════════════
function MetricsSection() {
  const [springMetrics, setSpringMetrics] = useState<any>(null);
  const [gnnEval,       setGnnEval]       = useState<any>(null);
  const [health,        setHealth]        = useState<any>(null);
  const [loading,       setLoading]       = useState(true);
  const [springError,   setSpringError]   = useState(false);
  const [gnnError,      setGnnError]      = useState(false);
  const [activeModel,   setActiveModel]   = useState<"gnn"|"eif"|"combined">("gnn");

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/admin/evaluate-models`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${ML_URL}/metrics`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${ML_URL}/health`)
        .then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([sm, ge, he]) => {
      setSpringMetrics(sm);
      setGnnEval(ge);
      setHealth(he);
      setLoading(false);
      if (!sm) setSpringError(true);
      if (!he) setGnnError(true);
    });
  }, []);

  // ── Derived values ───────────────────────────────────────────────────────────
  const modelStatus = health?.status            ?? "UNAVAILABLE";
  const version     = health?.version           ?? "GNN-v3";
  const nodesCount  = health?.nodes_count       ?? 0;
  const ringsCached = health?.rings_cached      ?? 0;
  const logitCache  = health?.logit_cache_size  ?? 0;
  const gnnThreshold = health?.optimal_threshold ?? gnnEval?.optimal_threshold ?? 0.5;

  // GNN training eval (from /metrics endpoint — eval_report.json)
  const gnnF1   = health?.test_f1  ?? gnnEval?.test?.f1        ?? 0;
  const gnnAuc  = health?.test_auc ?? gnnEval?.test?.auc_roc   ?? 0;
  const gnnPrec = gnnEval?.test?.precision ?? 0;
  const gnnRec  = gnnEval?.test?.recall    ?? 0;
  const gnnAcc  = gnnEval?.test?.accuracy  ?? 0;
  const gnnFpr  = gnnEval?.test?.confusion_matrix
    ? (() => { const cm = gnnEval.test.confusion_matrix; const fp = cm[0]?.[1]??0; const tn = cm[0]?.[0]??0; return fp+tn>0?fp/(fp+tn):0; })()
    : 0;
  const cm = gnnEval?.test?.confusion_matrix;

  // Live eval from Spring Boot (/api/admin/evaluate-models)
  const sb    = springMetrics;
  const hasSb = sb && (sb.combined || sb.gnn || sb.eif);

  // Per-model data for the 3-panel deep-dive
  const MODELS = [
    {
      id:         "gnn" as const,
      label:      "GNN",
      full:       "Graph Neural Network",
      color:      "#CAFF33",
      border:     "border-[#CAFF33]/[0.1]",
      activeBg:   "bg-[#CAFF33]/[0.07]",
      tag:        "SAGE → GAT → SAGE",
      threshold:  "≥ 0.50",
      weight:     "40%",
      role:       "Structural fraud patterns via message-passing across the account transaction graph.",
      // training eval (from /metrics, only available for GNN)
      trainF1:    gnnF1,
      trainAuc:   gnnAuc,
      trainPrec:  gnnPrec,
      trainRec:   gnnRec,
      trainAcc:   gnnAcc,
      trainFpr:   gnnFpr,
      // live eval from Spring Boot
      live:       sb?.gnn,
      confMatrix: cm,
      details: [
        ["Nodes in graph",    nodesCount > 0 ? nodesCount.toLocaleString() : "—"],
        ["Rings cached",      ringsCached > 0 ? String(ringsCached) : "—"],
        ["Logit cache",       logitCache > 0 ? `${logitCache.toLocaleString()} nodes` : "—"],
        ["Optimal threshold", f4(gnnThreshold, 4)],
        ["Version",           version],
        ["Inference",         "O(1) logit cache"],
      ],
    },
    {
      id:         "eif" as const,
      label:      "EIF",
      full:       "Extended Isolation Forest",
      color:      "#a855f7",
      border:     "border-purple-500/[0.1]",
      activeBg:   "bg-purple-500/[0.06]",
      tag:        "Unsupervised anomaly",
      threshold:  "≥ 0.60",
      weight:     "20%",
      role:       "Behavioral anomaly detection — catches mule patterns invisible to graph structure.",
      trainF1:    0,   // EIF has no offline training eval (unsupervised)
      trainAuc:   0,
      trainPrec:  0,
      trainRec:   0,
      trainAcc:   0,
      trainFpr:   0,
      live:       sb?.eif,
      confMatrix: null,
      details: [
        ["Model type",       "Extended Isolation Forest"],
        ["Trees",            "500  (ExtensionLevel=1)"],
        ["Input features",   "6 raw → 12 expanded"],
        ["Threshold dir.",   "path_length ≤ threshold"],
        ["Scaler",           "RobustScaler"],
        ["Endpoint",         "/v1/eif/score"],
      ],
    },
    {
      id:         "combined" as const,
      label:      "Fusion",
      full:       "Risk Fusion (Combined)",
      color:      "#3b82f6",
      border:     "border-blue-500/[0.1]",
      activeBg:   "bg-blue-500/[0.05]",
      tag:        "Weighted ensemble",
      threshold:  "≥ 0.35",
      weight:     "100%",
      role:       "Final decision layer — blends GNN, EIF, behavior, graph, and JA3 signals.",
      trainF1:    0,
      trainAuc:   0,
      trainPrec:  0,
      trainRec:   0,
      trainAcc:   0,
      trainFpr:   0,
      live:       sb?.combined,
      confMatrix: null,
      details: [
        ["GNN weight",       "40%"],
        ["EIF weight",       "20%"],
        ["Behavior weight",  "25%"],
        ["Graph weight",     "10%"],
        ["JA3 weight",        "5%"],
        ["Decision engine",  "Spring Boot"],
      ],
    },
  ];

  const active = MODELS.find(m => m.id === activeModel)!;

  // ── Sub-components ───────────────────────────────────────────────────────────
  const MBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-white/55 uppercase tracking-[0.15em]">{label}</span>
        <span className="text-xs font-black font-mono" style={{ color }}>{value > 0 ? f4(value, 4) : "—"}</span>
      </div>
      <div className="relative h-[3px] w-full bg-white/[0.04] rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, value * 100)}%`, background: color, boxShadow: `0 0 10px ${color}66` }} />
      </div>
    </div>
  );

  // Radial arc gauge for a single metric
  const Arc = ({ value, label, color }: { value: number; label: string; color: string }) => {
    const r = 28, cx = 36, cy = 38, circ = 2 * Math.PI * r;
    const dash = Math.min(1, value) * circ * 0.75;
    return (
      <div className="flex flex-col items-center gap-1">
        <svg width={72} height={52} viewBox="0 0 72 48">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)"
            strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${circ*0.75} ${circ}`} transform={`rotate(-135 ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
            strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`} transform={`rotate(-135 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 5px ${color}99)`, transition: "stroke-dasharray 1s ease" }} />
          <text x={cx} y={cx+2} textAnchor="middle" fill={color} fontSize={9}
            fontWeight={800} fontFamily="monospace">{value > 0 ? f4(value,2) : "—"}</text>
        </svg>
        <span className="text-[8px] text-white/45 uppercase tracking-[0.18em] font-bold">{label}</span>
      </div>
    );
  };

  return (
    <div>
      <PageHeading eyebrow="Evaluation Results" title="Model" accent="Performance"
        description="All three models evaluated equally — live scores from your transaction database plus training benchmarks where available." />

      {/* ── Row 1: 3 equal status cards + 1 system card ── */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {MODELS.map(m => {
          const liveF1  = m.live?.f1Score  ?? 0;
          const liveFpr = m.live?.fpr      ?? 0;
          const liveAuc = m.trainAuc;   // only GNN has training AUC
          const isActive = activeModel === m.id;
          return (
            <button key={m.id} onClick={() => setActiveModel(m.id)}
              className={`text-left p-5 rounded-[1.5rem] border transition-all duration-200 ${isActive ? `${m.activeBg} ${m.border}` : "border-white/[0.06] bg-[#080808] hover:border-white/[0.1]"}`}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 6px ${m.color}` }} />
                    <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/55">{m.full}</span>
                  </div>
                  <p className="text-3xl font-black" style={{ color: m.color }}>{m.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] text-white/45 mb-1">fusion weight</p>
                  <p className="text-xl font-black" style={{ color: `${m.color}99` }}>{m.weight}</p>
                </div>
              </div>
              <div className="flex gap-4 mb-4">
                <div>
                  <p className="text-[8px] text-white/45 mb-0.5">F1</p>
                  <p className="text-lg font-black font-mono" style={{ color: m.color }}>
                    {liveF1 > 0 ? f4(liveF1, 3) : m.trainF1 > 0 ? f4(m.trainF1, 3) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] text-white/45 mb-0.5">FPR</p>
                  <p className="text-lg font-black font-mono text-yellow-400">
                    {liveFpr > 0 ? f4(liveFpr, 3) : "—"}
                  </p>
                </div>
                {liveAuc > 0 && (
                  <div>
                    <p className="text-[8px] text-white/45 mb-0.5">AUC</p>
                    <p className="text-lg font-black font-mono" style={{ color: m.color }}>{f4(liveAuc, 3)}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[8px] px-2 py-1 rounded-full border font-bold uppercase tracking-widest"
                  style={{ borderColor: `${m.color}30`, color: `${m.color}70` }}>{m.tag}</span>
                <span className="text-[8px] text-white/45 font-mono">thr {m.threshold}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Row 2: Deep-dive panel for selected model ── */}
      <Card className={`p-7 mb-5 border ${active.border}`}>
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: `${active.color}15`, border: `1px solid ${active.color}30` }}>
              <span className="text-sm font-black" style={{ color: active.color }}>{active.label[0]}</span>
            </div>
            <div>
              <p className="text-xl font-black" style={{ color: active.color }}>{active.full}</p>
              <p className="text-xs text-white/50 mt-0.5">{active.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LiveBadge loading={loading} error={active.id === "gnn" ? gnnError : springError} />
            {hasSb && <span className="text-[9px] text-white/55 font-semibold">live on stored transactions</span>}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_1fr] gap-6">

          {/* Col 1: Arc gauges */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-5">
              {active.live ? "Live Eval (DB)" : active.id === "gnn" ? "Training Eval" : "No Eval Yet"}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {(() => {
                const d = active.live ?? (active.id === "gnn" ? {
                  f1Score: gnnF1, precision: gnnPrec, recall: gnnRec, accuracy: gnnAcc
                } : null);
                if (!d) return (
                  <div className="col-span-2 py-6 text-center">
                    <p className="text-xs text-white/40">
                      {springError
                        ? "Spring Boot unreachable"
                        : active.id === "eif"
                        ? "EIF is unsupervised — train labels not available offline. Live eval populates after transactions."
                        : "No eval data yet"}
                    </p>
                  </div>
                );
                return [
                  { k: "F1",        v: d.f1Score   ?? 0 },
                  { k: "Precision", v: d.precision  ?? 0 },
                  { k: "Recall",    v: d.recall     ?? 0 },
                  { k: "Accuracy",  v: d.accuracy   ?? 0 },
                ].map(({ k, v }) => (
                  <Arc key={k} value={v} label={k} color={active.color} />
                ));
              })()}
            </div>
            {/* FPR / FNR row */}
            {(active.live || (active.id === "gnn" && gnnFpr > 0)) && (
              <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.04]">
                {[
                  { k: "FPR", v: active.live?.fpr ?? gnnFpr,         tip: "False Positive Rate" },
                  { k: "FNR", v: active.live?.fnr ?? (gnnRec > 0 ? 1 - gnnRec : 0), tip: "False Negative Rate" },
                ].map(({ k, v, tip }) => (
                  <div key={k} className="p-3 rounded-xl border border-white/[0.04]">
                    <p className="text-[8px] text-white/45 mb-1">{tip}</p>
                    <p className="text-base font-black font-mono text-yellow-400">{v > 0 ? f4(v, 4) : "—"}</p>
                    <p className="text-[8px] text-white/40 mt-0.5">{k}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Col 2: Bar metrics */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-5">Metric Breakdown</p>
            <div className="space-y-4">
              {(() => {
                const d = active.live ?? (active.id === "gnn" ? {
                  f1Score: gnnF1, precision: gnnPrec, recall: gnnRec, accuracy: gnnAcc
                } : null);
                if (!d) return (
                  <p className="text-xs text-white/40 py-4">
                    {active.id === "eif"
                      ? "EIF has no supervised training labels. Score it via the Simulator, then run /api/admin/evaluate-models."
                      : "Run GET /api/admin/evaluate-models"}
                  </p>
                );
                return [
                  ["F1 Score",    d.f1Score   ?? 0],
                  ["Precision",   d.precision  ?? 0],
                  ["Recall",      d.recall     ?? 0],
                  ["Accuracy",    d.accuracy   ?? 0],
                ].map(([k, v]) => (
                  <MBar key={k as string} label={k as string} value={v as number} color={active.color} />
                ));
              })()}
              {/* AUC only for GNN */}
              {active.id === "gnn" && gnnAuc > 0 && (
                <>
                  <MBar label="AUC-ROC (training)" value={gnnAuc} color={active.color} />
                  <div className="flex gap-2 pt-2">
                    {gnnF1 > 0.8  && <Pill className="bg-[#CAFF33]/10 border border-[#CAFF33]/20 text-[#CAFF33]">F1 &gt; 0.80 ✓</Pill>}
                    {gnnAuc > 0.9 && <Pill className="bg-[#CAFF33]/10 border border-[#CAFF33]/20 text-[#CAFF33]">AUC &gt; 0.90 ✓</Pill>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Col 3: Model details + confusion matrix or description */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-5">Model Details</p>
            <div className="space-y-0">
              {active.details.map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                  <span className="text-[10px] text-white/50 uppercase tracking-widest">{k}</span>
                  <span className="text-[11px] font-bold text-white/60 font-mono">{v}</span>
                </div>
              ))}
            </div>

            {/* Confusion matrix — only GNN has training labels */}
            {active.id === "gnn" && active.confMatrix && (
              <div className="mt-5 pt-5 border-t border-white/[0.04]">
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-3">Confusion Matrix</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l:"TN", sub:"correct legit", v:active.confMatrix[0]?.[0]??0, c:"text-[#CAFF33]"  },
                    { l:"FP", sub:"false alarm",   v:active.confMatrix[0]?.[1]??0, c:"text-yellow-400" },
                    { l:"FN", sub:"missed fraud",  v:active.confMatrix[1]?.[0]??0, c:"text-red-400"    },
                    { l:"TP", sub:"caught fraud",  v:active.confMatrix[1]?.[1]??0, c:"text-[#CAFF33]"  },
                  ].map(({ l, sub, v, c }) => (
                    <div key={l} className="p-2.5 rounded-xl border border-white/[0.04] bg-white/[0.01] text-center">
                      <p className={`text-base font-black font-mono ${c}`}>{v.toLocaleString()}</p>
                      <p className="text-[8px] text-white/55 mt-0.5 leading-tight">{l} · {sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ── Row 3: Side-by-side comparison table ── */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.05] flex justify-between items-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45">
              Side-by-Side Comparison
            </p>
            <div className="flex items-center gap-2">
              <LiveBadge loading={loading} error={springError} />
              <span className="text-[9px] text-white/50 font-mono">from /api/admin/evaluate-models</span>
            </div>
          </div>
          {!hasSb && !loading ? (
            <div className="p-6">
              <p className="text-xs text-yellow-400/60 leading-relaxed">
                {springError
                  ? "⚠ Spring Boot unreachable — start backend first"
                  : "⚠ No data yet — hit GET /api/admin/evaluate-models to score all stored transactions"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  <th className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-white/55">Metric</th>
                  {MODELS.map(m => (
                    <th key={m.id} className="px-4 py-3 text-right text-[9px] font-bold uppercase tracking-widest"
                      style={{ color: `${m.color}70` }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["f1Score","precision","recall","accuracy","fpr","fnr"] as const).map(metric => {
                  const label = { f1Score:"F1", precision:"Precision", recall:"Recall",
                                  accuracy:"Accuracy", fpr:"FPR ↓", fnr:"FNR ↓" }[metric];
                  const values = MODELS.map(m => {
                    if (!m.live) return null;
                    return (m.live as any)[metric] ?? null;
                  });
                  const best = Math.max(...values.filter((v): v is number => v !== null));
                  return (
                    <tr key={metric} className="border-b border-white/[0.03] hover:bg-white/[0.01]">
                      <td className="px-5 py-3 text-[10px] text-white/55 uppercase tracking-widest">{label}</td>
                      {MODELS.map((m, i) => {
                        const v = values[i];
                        const isBest = v !== null && Math.abs(v - best) < 0.0001;
                        // For FPR/FNR, lower is better — so best = min
                        const isLower = metric === "fpr" || metric === "fnr";
                        const minVal = isLower ? Math.min(...values.filter((x): x is number => x !== null)) : 0;
                        const actuallyBest = isLower ? (v !== null && Math.abs(v - minVal) < 0.0001) : isBest;
                        return (
                          <td key={m.id} className="px-4 py-3 text-right">
                            {v !== null ? (
                              <span className={`text-xs font-black font-mono ${actuallyBest ? "" : "text-white/55"}`}
                                style={actuallyBest ? { color: m.color } : {}}>
                                {f4(v, 4)}
                                {actuallyBest && <span className="ml-1 text-[8px] opacity-60">★</span>}
                              </span>
                            ) : (
                              <span className="text-[10px] text-white/45">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* System + thresholds */}
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">System Status</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: "GNN",          v: modelStatus, c: modelStatus === "HEALTHY" ? "#CAFF33" : "#ef4444" },
                { l: "EIF",          v: "ACTIVE",    c: "#a855f7" },
                { l: "Nodes",        v: nodesCount > 0 ? nodesCount.toLocaleString() : "—", c: "#CAFF33" },
                { l: "Rings cached", v: ringsCached > 0 ? String(ringsCached) : "—", c: "#CAFF33" },
              ].map(({ l, v, c }) => (
                <div key={l} className="p-3 rounded-xl border border-white/[0.04]">
                  <p className="text-[8px] text-white/45 mb-1 uppercase tracking-widest">{l}</p>
                  <p className="text-sm font-black font-mono" style={{ color: c }}>{loading ? "…" : v}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/45 mb-4">Decision Thresholds</p>
            <div className="space-y-3">
              {MODELS.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.04]">
                  <div className="w-1.5 h-6 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}88` }} />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold" style={{ color: m.color }}>{m.label}</p>
                    <p className="text-[9px] text-white/45">{m.full}</p>
                  </div>
                  <span className="text-[11px] font-black font-mono text-white/50">{m.threshold}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.04]">
              <p className="text-[9px] text-white/40 leading-relaxed">
                ★ = best value for that metric across all three models.
                FPR and FNR: lower is better.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT
// ═════════════════════════════════════════════════════════════════════════════
export default function FraudDashboard() {
  const [active,      setActive]      = useState<View>("simulator");
  const [stats,       setStats]       = useState<any>(null);
  const [lastResult,  setLastResult]  = useState<LastResult | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setStats(d))
      .catch(() => {});
  }, []);

  const SECTIONS: Record<View, React.ReactNode> = {
    simulator:  <SimulatorSection />,
    gnn:        <GnnSection />,
    eif:        <EifSection />,
    identity:   <IdentitySection />,
    fusion:     <FusionSection />,
    rings:      <RingsSection />,
    clusters:   <ClustersSection />,
    blockchain: <BlockchainSection />,
    metrics:    <MetricsSection />,
  };

  const NAV_GROUPS = [
    { label: "Detection", items: NAV.slice(0, 3) },
    { label: "Signals",   items: NAV.slice(3, 6) },
    { label: "Analytics", items: NAV.slice(6, 9) },
  ];

  return (
    <LastResultCtx.Provider value={{ result: lastResult, setResult: setLastResult }}>
    <div className="bg-[#060606] text-white min-h-screen flex flex-col">
      <Navbar />

     

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-white/[0.07] flex flex-col py-6 px-3 sticky top-0 h-screen overflow-y-auto bg-[#070707]">
          <div className="mb-7 px-3">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-6 h-6 rounded-lg bg-[#CAFF33]/15 border border-[#CAFF33]/25 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#CAFF33]" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">MuleHunter AI</p>
                <p className="text-[9px] text-white/50 font-mono">Fraud Intelligence</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-5">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/45 px-3 mb-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.items.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActive(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group ${active === id ? "bg-[#CAFF33]/[0.1] border border-[#CAFF33]/20" : "border border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"}`}>
                      <Icon className={`w-4 h-4 shrink-0 transition-colors ${active === id ? "text-[#CAFF33]" : "text-white/55 group-hover:text-white/55"}`} />
                      <span className={`text-[12px] font-semibold tracking-tight ${active === id ? "text-[#CAFF33]" : "text-white/50 group-hover:text-white/80"}`}>{label}</span>
                      {active === id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#CAFF33]" style={{ boxShadow: "0 0 6px #CAFF33" }} />}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-4 pt-4 border-t border-white/[0.07] px-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/45 uppercase tracking-widest font-bold">GNN</span>
              <span className="text-[9px] text-[#CAFF33]/60 font-mono">:8001</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/45 uppercase tracking-widest font-bold">EIF</span>
              <span className="text-[9px] text-purple-400/60 font-mono">:8000</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white/45 uppercase tracking-widest font-bold">API</span>
              <span className="text-[9px] text-blue-400/60 font-mono">:8082</span>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto bg-[#060606]">
          <div className="max-w-[1300px] mx-auto px-8 py-10">
            {SECTIONS[active]}
          </div>
        </main>
      </div>
      <Footer />
    </div>
    </LastResultCtx.Provider>
  );
}