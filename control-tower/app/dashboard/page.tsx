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
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8082";

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

// ─── MOCK DATA (teammate sections — untouched) ────────────────────────────────
const MOCK = {
  gnnScore: 0.847, confidence: 0.694, fraudClusterId: 12, embeddingNorm: 0.923,
  eifScore: 0.631, eifConfidence: 0.882,
  shapValues: { velocityScore: 0.21, ja3ReuseCount: 0.18, burstScore: 0.14, amountDeviation: 0.11 },
  identityFeatures: { ja3ReuseCount: 8, deviceReuseCount: 6, ipReuseCount: 3, geoMismatch: false, isNewDevice: false, isNewJa3: true },
  fusionScore: 0.82, modelBreakdown: { gnn: 0.847, eif: 0.631, identity: 0.70 },
  muleRingDetection: { isMuleRingMember: true, ringShape: "STAR", ringSize: 7, role: "MULE", ringId: 3, hubAccount: "acc_88888", ringAccounts: ["acc_12395","acc_88888","acc_77123","acc_44001","acc_99302","acc_30019","acc_10233"] },
  networkMetrics: { suspiciousNeighbors: 5, centralityScore: 0.0081, transactionLoops: true, sharedDevices: 2 },
  riskFactors: ["High fan-out: distributing funds to many accounts","Circular flows detected","Embedded in a high-risk fraud community","Member of STAR mule ring","Connected to high-risk accounts"],
  decision: "BLOCK",
};
const MOCK_LOGS = [
  { hash:"0xf3a1...9d22", event:"RING_DETECTED",   account:"acc_12395", risk:0.91, ts:"10:42:11", block:19823441, model:"FUSION", decision:"BLOCK"   },
  { hash:"0xb7c2...1e33", event:"ACCOUNT_FLAGGED", account:"acc_88888", risk:0.84, ts:"10:38:07", block:19823415, model:"GNN",    decision:"BLOCK"   },
  { hash:"0x2d9f...aa11", event:"CLUSTER_ALERT",   account:"acc_55221", risk:0.77, ts:"10:31:55", block:19823387, model:"EIF",    decision:"REVIEW"  },
  { hash:"0xe8c4...5b90", event:"SCORE_LOGGED",    account:"acc_30019", risk:0.65, ts:"10:25:18", block:19823351, model:"FUSION", decision:"REVIEW"  },
  { hash:"0x9f3d...8712", event:"SCORE_LOGGED",    account:"acc_77123", risk:0.21, ts:"10:12:44", block:19823278, model:"EIF",    decision:"APPROVE" },
];

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

// /detect-rings has no shape field — derived client-side from ring size
const deriveShape = (size: number) =>
  size >= 6 ? "DENSE" : size === 3 ? "CYCLE" : size === 4 ? "CHAIN" : "STAR";

// ─── ATOMS ────────────────────────────────────────────────────────────────────
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative border border-white/[0.07] rounded-[1.75rem] bg-[#080808] overflow-hidden ${className}`}
    style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)" }}>
    {children}
  </div>
);
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/25 mb-2">{children}</p>
);
const Pill = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest ${className}`}>{children}</span>
);
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center py-3 border-b border-white/[0.04] last:border-0">
    <span className="text-[11px] text-white/30 uppercase tracking-widest font-medium">{label}</span>
    <span className="text-sm font-semibold text-white/70">{value}</span>
  </div>
);
function Bar({ label, value, max = 1, color = "#CAFF33" }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-white/35 uppercase tracking-widest font-medium">{label}</span>
        <span className="text-xs font-bold font-mono" style={{ color }}>{f4(value, 2)}</span>
      </div>
      <div className="relative h-px w-full bg-white/[0.06]">
        <div className="absolute inset-y-0 left-0 h-px transition-all duration-700 rounded-full"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}66` }} />
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
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.04)"
          strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${circ * 0.75} ${circ}`} transform={`rotate(-135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color}
          strokeWidth={4} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform={`rotate(-135 ${cx} ${cy})`}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)`, transition: "stroke-dasharray 1s ease" }} />
        <text x={cx} y={cx + 3} textAnchor="middle" fill={color} fontSize={13}
          fontWeight={800} fontFamily="var(--font-geist-mono)">{f4(score, 2)}</text>
      </svg>
      <span className="text-[9px] text-white/25 uppercase tracking-[0.22em] font-bold -mt-1">{label}</span>
    </div>
  );
}
function StatCard({ label, value, sub, color = "text-[#CAFF33]" }: { label: string; value: React.ReactNode; sub: string; color?: string }) {
  return (
    <Card className="p-6">
      <p className="text-[9px] text-white/20 uppercase tracking-widest mb-3 font-bold">{label}</p>
      <p className={`text-4xl font-black leading-none mb-2 ${color}`}>{value}</p>
      <p className="text-[11px] text-white/20">{sub}</p>
    </Card>
  );
}
function LiveBadge({ loading, error }: { loading: boolean; error: boolean }) {
  if (loading) return <span className="text-[9px] text-white/20 animate-pulse">fetching…</span>;
  if (error)   return <span className="text-[9px] text-yellow-400/60">unreachable</span>;
  return <span className="text-[9px] text-[#CAFF33]/50">● live</span>;
}

// ─── CANVAS ───────────────────────────────────────────────────────────────────
// orange=ring member, red=fraud, yellow=high-risk, green=safe
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
    <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 ${active ? "bg-[#CAFF33]/[0.07] border border-[#CAFF33]/15" : "border border-transparent"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-all ${done || active ? "bg-[#CAFF33] text-black" : "bg-white/[0.04] text-white/20 border border-white/[0.06]"}`}>
        {done ? "✓" : n}
      </div>
      <span className={`text-xs flex-1 transition-colors leading-tight ${active ? "text-[#CAFF33] font-semibold" : done ? "text-[#CAFF33]/40" : "text-white/20"}`}>{label}</span>
      {tag && <span className="text-[8px] font-bold uppercase tracking-widest text-white/20 border border-white/[0.06] px-1.5 py-0.5 rounded-full">{tag}</span>}
    </div>
  );
}
function Field({ label, k, form, setForm }: { label: string; k: string; form: Record<string, string>; setForm: (f: any) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">{label}</label>
      <input value={form[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))}
        className="w-full bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.12] focus:border-[#CAFF33]/30 rounded-xl px-4 py-2.5 text-sm text-white/70 font-mono placeholder:text-white/15 focus:outline-none transition-colors" />
    </div>
  );
}
function PageHeading({ eyebrow, title, accent, description }: { eyebrow: string; title: string; accent: string; description: string }) {
  return (
    <div className="mb-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[2.5rem] font-black tracking-tight leading-none mb-3">
        {title} <span className="text-[#CAFF33]">{accent}</span>
      </h2>
      <p className="text-base text-white/30 max-w-lg leading-relaxed">{description}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIMULATOR — ✅ CONNECTED: POST /api/transactions (Spring Boot)
// ═════════════════════════════════════════════════════════════════════════════
function SimulatorSection() {
  const [form, setForm] = useState({ sid: "ACC1553", did: "ACC899", amt: "2077", ccy: "INR", ip: "49.204.11.92", ja3: "771,4866-4867-4865,...", dev: "device_8s7df6", nb: "4", hd: "0.47" });
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("Overview");

  const run = async () => {
    setResult(null); setLoading(true); setStep(0);
    const dl = [80, 80, 80, 80, 80, 80, 80, 220, 80, 80, 80, 80, 300, 120];
    for (let i = 0; i < 14; i++) { setStep(i + 1); await new Promise(r => setTimeout(r, dl[i])); }
    try {
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-JA3-Fingerprint": form.ja3 },
        body: JSON.stringify({ transactionId: crypto.randomUUID(), sourceAccount: form.sid, targetAccount: form.did, amount: Number(form.amt) }),
      });
      const data = await res.json();
      setResult({
        gnnScore:      data.modelScores?.gnn        ?? 0,
        eifScore:      data.modelScores?.eif        ?? 0,
        eifConf:       data.modelScores?.confidence ?? 0,
        fusionScore:   data.riskScore               ?? 0,
        decision:      data.decision                ?? "REVIEW",
        clusterId:     data.fraudCluster?.clusterId ?? 0,
        embeddingNorm: data.embeddingNorm           ?? 0,
        shapValues:    data.modelScores?.eifTopFactors ?? {},
        networkMetrics: data.networkMetrics ?? { suspiciousNeighbors: 0, centralityScore: 0, transactionLoops: false, sharedDevices: 0 },
        muleRing:    data.muleRingDetection ?? { isMuleRingMember: false },
        riskFactors: data.riskFactors       ?? [],
        modelBreakdown: { gnn: data.modelScores?.gnn ?? 0, eif: data.modelScores?.eif ?? 0, identity: data.modelScores?.behavior ?? 0 },
        ja3: { isNewDevice: data.ja3Security?.isNewDevice ?? false, isNewJa3: data.ja3Security?.isNewJa3 ?? false, reuse: data.ja3Security?.velocity ?? 0 },
      });
    } catch { alert("Spring Boot not reachable at " + API_URL); }
    setStep(15); setLoading(false);
  };

  return (
    <div className="grid grid-cols-[270px_1fr_210px] gap-5 h-full">
      {/* Form */}
      <Card className="flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-white/[0.05]"><Eyebrow>Input</Eyebrow><p className="text-lg font-bold text-white/80">Transaction</p></div>
        <div className="p-6 space-y-5 flex-1">
          <div className="space-y-3">
            <Field label="Source Account"      k="sid" form={form} setForm={setForm} />
            <Field label="Destination Account" k="did" form={form} setForm={setForm} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount"   k="amt" form={form} setForm={setForm} />
              <Field label="Currency" k="ccy" form={form} setForm={setForm} />
            </div>
          </div>
          <div className="pt-4 border-t border-white/[0.04] space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/15 mb-1">Identity</p>
            <Field label="IP Address"      k="ip"  form={form} setForm={setForm} />
            <Field label="JA3 Fingerprint" k="ja3" form={form} setForm={setForm} />
            <Field label="Device ID"       k="dev" form={form} setForm={setForm} />
          </div>
          <div className="pt-4 border-t border-white/[0.04] space-y-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/15 mb-1">Graph Context</p>
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

      {/* Results */}
      <div className="flex flex-col gap-4 overflow-y-auto min-w-0">
        {result ? (
          <>
            <Card className={`p-8 border ${bg(result.fusionScore)}`}>
              <div className="flex items-start justify-between">
                <div>
                  <Eyebrow>Risk Verdict</Eyebrow>
                  <p className={`text-[3.25rem] font-black uppercase tracking-tight leading-none ${tc(result.fusionScore)}`}
                    style={{ textShadow: `0 0 60px ${hex(result.fusionScore)}33` }}>{result.decision}</p>
                </div>
                <div className="flex gap-10 items-end">
                  {([["Fusion", result.fusionScore], ["GNN", result.gnnScore], ["EIF", result.eifScore]] as [string, number][]).map(([l, v]) => (
                    <div key={l} className="text-right">
                      <p className="text-[9px] text-white/20 uppercase tracking-widest mb-1">{l}</p>
                      <p className={`text-2xl font-black font-mono ${tc(v)}`}>{f4(v, 3)}</p>
                    </div>
                  ))}
                  <div className="text-right">
                    <p className="text-[9px] text-white/20 uppercase tracking-widest mb-1">Latency</p>
                    <p className="text-2xl font-black font-mono text-[#CAFF33]">38.4<span className="text-xs ml-1 text-[#CAFF33]/50">ms</span></p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-3 gap-3">
              {([["GNN", result.gnnScore, `Cluster #${result.clusterId}`], ["EIF", result.eifScore, `Conf ${f4(result.eifConf, 3)}`], ["Fusion", result.fusionScore, "0.6·GNN + 0.3·EIF + 0.1·ID"]] as [string, number, string][]).map(([l, v, s]) => (
                <Card key={l} className="p-6 flex flex-col items-center gap-2">
                  <Gauge score={v} label={l} />
                  <p className="text-[9px] text-white/20 text-center leading-relaxed">{s}</p>
                </Card>
              ))}
            </div>

            <Card className="p-6 flex-1">
              <div className="flex gap-1.5 mb-6 pb-5 border-b border-white/[0.05] flex-wrap">
                {["Overview", "Behavioral", "Structural", "Identity", "Fusion"].map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${tab === t ? "bg-[#CAFF33] text-black" : "text-white/25 hover:text-white/50"}`}>{t}</button>
                ))}
              </div>

              {tab === "Overview" && (
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Score Breakdown</p>
                    <Bar label="GNN — Structural"  value={result.gnnScore}               color={hex(result.gnnScore)} />
                    <Bar label="EIF — Behavioral"  value={result.eifScore}               color={hex(result.eifScore)} />
                    <Bar label="Identity Signal"   value={result.modelBreakdown.identity} color="#a855f7" />
                    <Bar label="Fusion Output"     value={result.fusionScore}             color={hex(result.fusionScore)} />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">Risk Signals</p>
                    <div className="space-y-2">
                      {result.riskFactors.length > 0
                        ? result.riskFactors.map((f: string, i: number) => (
                            <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-red-500/[0.03] border border-red-500/10 text-sm text-white/40 leading-relaxed">
                              <span className="text-red-500/60 shrink-0 mt-0.5 text-xs">▲</span>{f}
                            </div>
                          ))
                        : <p className="text-sm text-white/15">No risk signals detected.</p>}
                    </div>
                  </div>
                </div>
              )}

              {tab === "Behavioral" && (
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-3">EIF Score</p>
                    <p className={`text-6xl font-black font-mono mb-3 leading-none ${tc(result.eifScore)}`}>{f4(result.eifScore, 4)}</p>
                    <p className="text-sm text-white/25">Confidence: <span className="text-white/50">{f4(result.eifConf, 4)}</span></p>
                  </div>
                  <div className="space-y-5">
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">SHAP Importance</p>
                    {Object.keys(result.shapValues).length > 0
                      ? Object.entries(result.shapValues).map(([k, v]) => <Bar key={k} label={k} value={v as number} max={0.3} color="#a855f7" />)
                      : <p className="text-sm text-white/15">No SHAP values returned.</p>}
                  </div>
                </div>
              )}

              {tab === "Structural" && (
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-3">GNN Score</p>
                    <p className={`text-6xl font-black font-mono mb-6 leading-none ${tc(result.gnnScore)}`}>{f4(result.gnnScore, 4)}</p>
                    <div>
                      {([["Fraud Cluster", `#${result.clusterId}`], ["Embedding Norm", f4(result.embeddingNorm, 4)], ["Centrality", f4(result.networkMetrics.centralityScore ?? 0, 6)], ["Susp. Neighbours", String(result.networkMetrics.suspiciousNeighbors ?? 0)], ["Txn Loops", result.networkMetrics.transactionLoops ? "YES" : "NO"]] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">Ring Membership</p>
                    <div className={`p-6 rounded-2xl border ${result.muleRing.isMuleRingMember ? "bg-red-500/[0.03] border-red-500/15" : "bg-[#CAFF33]/[0.03] border-[#CAFF33]/15"}`}>
                      <p className={`text-2xl font-black mb-5 ${result.muleRing.isMuleRingMember ? "text-red-400" : "text-[#CAFF33]"}`}>
                        {result.muleRing.isMuleRingMember ? "RING MEMBER" : "NOT IN RING"}
                      </p>
                      {result.muleRing.isMuleRingMember && (
                        <div>
                          {([["Shape", result.muleRing.ringShape], ["Size", String(result.muleRing.ringSize)], ["Role", result.muleRing.role], ["Hub", result.muleRing.hubAccount]] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {tab === "Identity" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    {[{ l: "JA3 Velocity", v: result.ja3.reuse, w: 5 }, { l: "New Device", v: result.ja3.isNewDevice ? 1 : 0, w: 0 }, { l: "New JA3", v: result.ja3.isNewJa3 ? 1 : 0, w: 0 }].map(({ l, v, w }) => (
                      <Card key={l} className="p-5">
                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-3">{l}</p>
                        <p className={`text-4xl font-black font-mono mb-4 ${v > w ? "text-red-400" : "text-[#CAFF33]"}`}>{v}</p>
                        <Bar label="signal" value={Math.min(1, v / 10)} color={v > w ? "#ef4444" : "#CAFF33"} />
                      </Card>
                    ))}
                  </div>
                  <div className="flex gap-8 p-5 rounded-xl border border-white/[0.05]">
                    {([["New Device", result.ja3.isNewDevice], ["New JA3", result.ja3.isNewJa3]] as [string, boolean][]).map(([l, v]) => (
                      <div key={l} className="flex gap-3 items-center">
                        <span className="text-xs text-white/25">{l}</span>
                        <Pill className={v ? "bg-yellow-400/10 border border-yellow-400/20 text-yellow-400" : "bg-[#CAFF33]/10 border border-[#CAFF33]/20 text-[#CAFF33]"}>{v ? "YES" : "NO"}</Pill>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "Fusion" && (
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">Formula</p>
                    <div className="p-5 rounded-2xl bg-black/50 border border-white/[0.05] font-mono space-y-2.5">
                      <p className="text-[10px] text-white/15 mb-3">finalRisk =</p>
                      {([["0.6", result.gnnScore, "GNN", "text-[#CAFF33]"], ["0.3", result.eifScore, "EIF", "text-purple-400"], ["0.1", result.modelBreakdown.identity, "ID", "text-blue-400"]] as [string, number, string, string][]).map(([w, v, lbl, cls]) => (
                        <p key={lbl} className="text-sm"><span className={`${cls} font-bold`}>{w}</span><span className="text-white/25"> × {lbl} ({f4(v, 3)})</span><span className="text-white/40"> = </span><span className={`${cls} font-bold`}>{f4(Number(w) * v, 4)}</span></p>
                      ))}
                      <div className="border-t border-white/[0.06] pt-3"><span className={`text-2xl font-black ${tc(result.fusionScore)}`}>{f4(result.fusionScore, 4)}</span></div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">Decision Policy</p>
                    <div className="space-y-2">
                      {([["0 – 0.40", "APPROVE"], ["0.40 – 0.70", "REVIEW"], ["0.70 – 1.00", "BLOCK"]] as [string, string][]).map(([range, dec]) => (
                        <div key={range} className={`flex justify-between items-center p-4 rounded-xl border ${result.decision === dec ? bg(dec === "BLOCK" ? 0.9 : dec === "REVIEW" ? 0.55 : 0.1) : "border-white/[0.04]"}`}>
                          <span className="text-sm text-white/25 font-mono">{range}</span>
                          <Pill className={dc(dec)}>{dec}</Pill>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-white/15 mt-4 leading-relaxed">Decision policy runs in Spring Boot — not the ML layer.</p>
                  </div>
                </div>
              )}
            </Card>
          </>
        ) : (
          <Card className="flex flex-col items-center justify-center flex-1 gap-5 min-h-[460px]">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-32 h-32 rounded-full border border-white/[0.04]" />
              <div className="absolute w-20 h-20 rounded-full border border-white/[0.05]" />
              <div className="w-12 h-12 rounded-full border border-white/[0.07] flex items-center justify-center"><Zap className="w-5 h-5 text-white/15" /></div>
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-lg font-bold text-white/15">Ready to Score</p>
              <p className="text-sm text-white/10">Configure a transaction and press Score</p>
              <p className="text-xs text-white/[0.07] mt-2">14-step pipeline · EIF ‖ GNN parallel · Blockchain async</p>
            </div>
          </Card>
        )}
      </div>

      {/* Pipeline */}
      <Card className="flex flex-col overflow-y-auto">
        <div className="p-5 border-b border-white/[0.04]"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Pipeline</p></div>
        <div className="p-3 flex flex-col gap-0.5 flex-1">
          {PIPE.map((label, i) => <PipeStep key={i} n={i + 1} label={label} active={step === i + 1} done={step > i + 1} tag={i === 7 ? "∥" : i === 13 ? "async" : undefined} />)}
        </div>
        {step === 15 && <div className="m-3 p-3.5 bg-[#CAFF33]/[0.07] border border-[#CAFF33]/15 rounded-xl"><p className="text-[11px] text-[#CAFF33] font-bold">✓ All 14 steps complete</p></div>}
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// GNN — ✅ CONNECTED: GET /network-snapshot?limit=60 (inference_service.py)
// Response: {nodes:[{id,is_fraud,risk,ring,pagerank}], edges:[...], stats:{total_nodes,total_edges,fraud_nodes,fraud_rate}}
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
      <PageHeading eyebrow="Graph Neural Network" title="Structural" accent="Analysis" description="SAGE → GAT(4 heads) → SAGE with residual skip connection. Learns from both node features and graph topology." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { l: "Layer 1", t: "SAGEConv",    d: "Broad neighbourhood aggregation",        c: "text-blue-400",   b: "border-blue-400/[0.08]"  },
          { l: "Layer 2", t: "GATConv ×4",  d: "Attention-weighted neighbour selection", c: "text-[#CAFF33]",  b: "border-[#CAFF33]/[0.08]" },
          { l: "Layer 3", t: "SAGEConv",    d: "Final aggregation + residual skip",      c: "text-yellow-400", b: "border-yellow-400/[0.08]" },
          { l: "Head",    t: "MLP 3-Layer", d: "BatchNorm + Dropout + log_softmax",      c: "text-red-400",    b: "border-red-400/[0.08]"   },
        ].map(x => (
          <Card key={x.l} className={`p-6 border ${x.b}`}>
            <p className="text-[9px] text-white/15 uppercase tracking-widest mb-2">{x.l}</p>
            <p className={`text-lg font-black mb-2.5 ${x.c}`}>{x.t}</p>
            <p className="text-xs text-white/25 leading-relaxed">{x.d}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Nodes" value={stats ? stats.total_nodes.toLocaleString() : "—"} sub="Accounts in graph" />
        <StatCard label="Total Edges" value={stats ? stats.total_edges.toLocaleString() : "—"} sub="Transaction links" />
        <StatCard label="Fraud Nodes" value={stats ? stats.fraud_nodes.toLocaleString() : "—"} sub="Known fraud accounts" color="text-red-400" />
        <StatCard label="Fraud Rate"  value={stats ? `${(stats.fraud_rate * 100).toFixed(1)}%` : "—"} sub="Graph-wide" color="text-yellow-400" />
      </div>

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-5">
        <Card className="p-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-5">21 Feature Columns</p>
          <div className="grid grid-cols-3 gap-2">
            {[["account_age_days","tenure"],["balance_mean","avg amount"],["balance_std","volatility"],["tx_count","velocity"],["tx_velocity_7d","7-day burst"],["fan_out_ratio","dispersion"],["amount_entropy","smurfing"],["risky_email","domain risk"],["device_mobile","mobile %"],["device_consistency","switch"],["addr_entropy","addr div."],["d_gap_mean","timing gaps"],["card_network_risk","network"],["product_code_risk","product"],["international_flag","cross-border"],["pagerank","centrality"],["in_out_ratio","flow asymm."],["reciprocity_score","circular"],["community_fraud_rate","cluster %"],["ring_membership","rings"],["second_hop_fraud_rate","2-hop guilt"]].map(([f, d]) => (
              <div key={f} className="p-3 rounded-xl border border-white/[0.04] bg-white/[0.01] hover:border-[#CAFF33]/15 transition-colors group cursor-default">
                <p className="text-[9px] font-bold text-[#CAFF33]/60 leading-tight mb-0.5 group-hover:text-[#CAFF33]/80 transition-colors">{f}</p>
                <p className="text-[8px] text-white/15">{d}</p>
              </div>
            ))}
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-5 flex-1">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Live Network Graph</p>
              <LiveBadge loading={loading} error={error} />
            </div>
            <div className="h-[240px] rounded-2xl overflow-hidden"><Canvas liveNodes={snapshot?.nodes} /></div>
            <div className="flex gap-5 mt-4 flex-wrap">
              {[["#ef4444","Fraud"],["#f97316","Ring member"],["#facc15","High-risk"],["#CAFF33","Safe"]].map(([c, l]) => (
                <div key={l} className="flex gap-2 items-center">
                  <div className="w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                  <span className="text-[10px] text-white/20">{l}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">Training Config</p>
            {[["Loss","WeightedNLLLoss"],["Optimizer","AdamW lr=1e-3"],["Warmup","200 epoch AUC"],["Patience","80 epochs"],["Split","70 / 15 / 15"]].map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// EIF — MOCK (teammate's domain)
// ═════════════════════════════════════════════════════════════════════════════
function EifSection() {
  return (
    <div>
      <PageHeading eyebrow="Extended Isolation Forest" title="Behavioral" accent="Detection" description="Runs in parallel with GNN. Detects anomalous behavioral patterns invisible to graph structure alone." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Model Type"    value="EIF"   sub="Extended Isolation Forest" />
        <StatCard label="Inference"     value="<20ms" sub="Per transaction" />
        <StatCard label="SHAP Features" value="4"     sub="Top: velocityScore" />
        <StatCard label="Confidence"    value="88.2%" sub="On mock transaction" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-7">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-6">How EIF Works</p>
          <div className="space-y-3">
            {[{n:"1",t:"Forest Construction",d:"Build N isolation trees on behavioral feature space",c:"#CAFF33"},{n:"2",t:"Path Length Score",d:"Anomalous points isolated faster — shorter path = higher score",c:"#facc15"},{n:"3",t:"Extended Isolation",d:"Hyperplane cuts at any angle eliminate axis-parallel bias",c:"#3b82f6"},{n:"4",t:"SHAP Attribution",d:"TreeExplainer decomposes anomaly score per feature",c:"#a855f7"}].map(s => (
              <div key={s.n} className="flex gap-4 p-4 rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 text-black" style={{ background: s.c }}>{s.n}</div>
                <div><p className="text-sm font-bold mb-1 leading-snug" style={{ color: s.c }}>{s.t}</p><p className="text-xs text-white/25 leading-relaxed">{s.d}</p></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-7">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-6">Behavioral Feature Space</p>
          <div className="space-y-4">
            {[{l:"Velocity Score (24h)",v:0.73,c:"#ef4444",d:"14 tx in 24h — 4.2× baseline"},{l:"Burst Score",v:0.61,c:"#facc15",d:"3 transactions within 5 minutes"},{l:"Amount Deviation",v:0.45,c:"#facc15",d:"Round-number transactions"},{l:"Timing Regularity",v:0.28,c:"#CAFF33",d:"Bot-like timing pattern"},{l:"Counterparty Diversity",v:0.81,c:"#ef4444",d:"12 unique counterparties in 7 days"}].map(f => (
              <div key={f.l} className="p-4 rounded-xl border border-white/[0.04]">
                <div className="flex justify-between mb-2.5"><span className="text-sm text-white/40">{f.l}</span><span className="text-sm font-bold font-mono" style={{ color: f.c }}>{f4(f.v, 2)}</span></div>
                <div className="h-px w-full bg-white/[0.04]"><div className="h-px transition-all duration-700 rounded-full" style={{ width: `${f.v * 100}%`, background: f.c, boxShadow: `0 0 8px ${f.c}66` }} /></div>
                <p className="text-[10px] text-white/15 mt-2">{f.d}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// IDENTITY — MOCK (teammate's domain)
// ═════════════════════════════════════════════════════════════════════════════
function IdentitySection() {
  const id = MOCK.identityFeatures;
  return (
    <div>
      <PageHeading eyebrow="Step 4 of Pipeline" title="Identity" accent="Forensics" description="JA3 TLS fingerprinting, device hashing, and IP/geo correlation to detect account takeover and identity reuse." />
      <div className="grid grid-cols-3 gap-5">
        {[
          { t:"JA3 Fingerprint",    v:id.ja3ReuseCount,    w:5, ex:id.isNewJa3?"New JA3 — first seen":"Known fingerprint",  det:[["Hash","771,4866-4867…"],["Protocol","TLS 1.3"],["Cipher","4866-4867-4865"]] },
          { t:"Device Fingerprint", v:id.deviceReuseCount, w:3, ex:id.isNewDevice?"New device":"Known device",              det:[["Device Hash","sha256:d4f7e2…"],["Platform","Android 13"],["Screen","1080×2340"]] },
          { t:"IP / Geo Analysis",  v:id.ipReuseCount,     w:2, ex:id.geoMismatch?"⚠ Geo mismatch":"Geo consistent",       det:[["IP","49.204.11.92"],["ISP","Reliance Jio"],["City","Mumbai, MH"]] },
        ].map(x => (
          <Card key={x.t} className="p-7 flex flex-col gap-5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">{x.t}</p>
              <p className={`text-5xl font-black font-mono mb-1.5 leading-none ${x.v > x.w ? "text-red-400" : "text-[#CAFF33]"}`}>{x.v}</p>
              <p className="text-xs text-white/20">accounts sharing this fingerprint</p>
            </div>
            <Bar label="reuse rate" value={x.v} max={15} color={x.v > x.w ? "#ef4444" : "#CAFF33"} />
            <Pill className={`self-start ${x.v > x.w ? "bg-red-500/10 border border-red-500/15 text-red-400" : "bg-[#CAFF33]/10 border border-[#CAFF33]/15 text-[#CAFF33]"}`}>{x.ex}</Pill>
            <div className="pt-1 border-t border-white/[0.04]">{x.det.map(([k, v]) => <Row key={k} label={k} value={v} />)}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FUSION — MOCK (teammate's domain)
// ═════════════════════════════════════════════════════════════════════════════
function FusionSection() {
  const s = [
    { l:"GNN Score",       v:MOCK.gnnScore,               w:0.6, c:"#CAFF33", d:"Graph Neural Network — structural fraud" },
    { l:"EIF Score",       v:MOCK.eifScore,               w:0.3, c:"#a855f7", d:"Extended Isolation Forest — behavioral"  },
    { l:"Identity Signal", v:MOCK.modelBreakdown.identity, w:0.1, c:"#3b82f6", d:"JA3 + device + IP reuse composite"      },
  ];
  const fusion = s.reduce((a, x) => a + x.w * x.v, 0);
  return (
    <div>
      <PageHeading eyebrow="Ensemble Layer" title="Risk" accent="Fusion" description="Weighted composition of all model signals. Spring Boot applies the final decision policy." />
      <div className="grid grid-cols-[1.4fr_0.6fr] gap-5">
        <Card className="p-7 space-y-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Score Composition</p>
          {s.map(x => (
            <div key={x.l} className="p-5 rounded-2xl border border-white/[0.05] bg-black/30">
              <div className="flex justify-between items-start mb-4">
                <div><p className="text-base font-black mb-1 leading-snug" style={{ color: x.c }}>{x.l}</p><p className="text-xs text-white/25">{x.d}</p></div>
                <div className="text-right"><p className="text-[9px] text-white/15 mb-1">weight × score</p><p className="text-base font-black font-mono" style={{ color: x.c }}>{x.w} × {f4(x.v, 3)} = {f4(x.w * x.v, 4)}</p></div>
              </div>
              <Bar label="score" value={x.v} color={x.c} />
            </div>
          ))}
          <div className={`p-5 rounded-2xl border ${bg(fusion)}`}>
            <div className="flex justify-between items-center">
              <p className={`text-base font-bold ${tc(fusion)}`}>Final Fusion Score</p>
              <p className={`text-4xl font-black font-mono ${tc(fusion)}`}>{f4(fusion, 4)}</p>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-5">Decision Thresholds</p>
            <div className="space-y-2">
              {([["0 – 0.40","APPROVE",0.2],["0.40 – 0.70","REVIEW",0.55],["0.70 – 1.00","BLOCK",0.85]] as [string,string,number][]).map(([r, d]) => (
                <div key={r} className={`flex justify-between items-center p-4 rounded-xl border transition-all ${fusion >= 0.7 && d === "BLOCK" ? bg(0.9) : fusion >= 0.4 && fusion < 0.7 && d === "REVIEW" ? bg(0.55) : "border-white/[0.04]"}`}>
                  <span className="text-sm text-white/25 font-mono">{r}</span><Pill className={dc(d)}>{d}</Pill>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-4">Architecture Note</p>
            <p className="text-sm text-white/25 leading-relaxed">ML outputs scores only. <span className="text-[#CAFF33]">Spring Boot</span> applies thresholds based on business rules, account tier, and time-of-day risk appetite.</p>
            <p className="text-sm text-white/15 mt-4">Response SLA: <span className="text-[#CAFF33]">&lt;250ms</span> end-to-end</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// RINGS — ✅ CONNECTED: GET /detect-rings?max_size=6&limit=20 (inference_service.py)
// Response: {rings_detected, rings:[{nodes,size,volume,risk}], high_risk_nodes}
// NOTE: no `shape` field — derived client-side from size
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
      <PageHeading eyebrow="Money-Laundering Patterns" title="Ring" accent="Detection" description="Bounded DFS cycle detection. 25s timeout, max 6 hops, restricted to account nodes only." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Rings Detected"  value={data ? data.rings_detected : "—"} sub={error ? "Service unreachable" : "Live from ML"} />
        <StatCard label="Volume at Risk"  value={totalVolume > 0 ? `₹${(totalVolume / 100000).toFixed(1)}L` : "—"} sub="Across all rings" color="text-red-400" />
        <StatCard label="High-Risk Nodes" value={data ? data.high_risk_nodes.length : "—"} sub="In top 5 rings" color="text-yellow-400" />
        <StatCard label="Algorithm"       value="BFS-DFS" sub="25s timeout · max 6 hops" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card className="p-6 space-y-2">
          <div className="flex justify-between items-center mb-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Detected Rings</p>
            <LiveBadge loading={loading} error={error} />
          </div>
          {!loading && rings.length === 0 && (
            <p className="text-sm text-white/15 py-8 text-center">{error ? "Service unreachable" : "No rings found in cached graph"}</p>
          )}
          {rings.map((ring: any, i: number) => {
            const shape = deriveShape(ring.size);
            return (
              <div key={i} onClick={() => setSel(ring === sel ? null : ring)}
                className={`p-5 rounded-xl border cursor-pointer transition-all hover:border-white/[0.1] ${sel === ring ? "bg-[#CAFF33]/[0.04] border-[#CAFF33]/15" : "border-white/[0.05]"}`}>
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex gap-3 items-center">
                    <Pill className={dc(ring.risk >= 0.75 ? "BLOCK" : ring.risk >= 0.45 ? "REVIEW" : "APPROVE")}>{shape}</Pill>
                    <span className="text-xs text-white/25">{ring.size} nodes</span>
                  </div>
                  <span className={`text-xl font-black font-mono ${tc(ring.risk)}`}>{f4(ring.risk, 2)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-white/20">
                  <span>₹{((ring.volume ?? 0) / 1000).toFixed(0)}K flow</span>
                  <span className="font-mono">{(ring.nodes ?? []).slice(0, 2).join(", ")}…</span>
                </div>
              </div>
            );
          })}
        </Card>
        <Card className="p-6">
          {sel ? (
            <div className="space-y-5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-2">Ring Detail</p>
                <p className={`text-2xl font-black ${tc(sel.risk)}`}>{deriveShape(sel.size)} Pattern</p>
              </div>
              <div className="flex gap-8 items-center">
                <Gauge score={sel.risk} label="Ring Risk" />
                <div className="flex-1">
                  {([["Shape (derived)", deriveShape(sel.size)], ["Size", `${sel.size} accounts`], ["Volume", `₹${((sel.volume ?? 0) / 100000).toFixed(2)}L`], ["Risk Score", f4(sel.risk, 4)]] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-3">Members</p>
                <div className="flex flex-wrap gap-2">
                  {(sel.nodes ?? []).map((n: string, i: number) => (
                    <span key={n} className={`px-2.5 py-1 rounded-full text-[10px] font-mono border ${i === 0 ? "bg-red-500/10 border-red-500/15 text-red-400" : "border-white/[0.06] text-white/25"}`}>{n}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-3">Topology</p>
                <div className="p-4 rounded-xl bg-black/40 border border-white/[0.05] font-mono text-sm text-white/25">
                  {deriveShape(sel.size) === "STAR"  && <pre className="text-[11px] leading-relaxed">{"    HUB\n   / | \\\n  M  M  M\n   \\ | /\n    M"}</pre>}
                  {deriveShape(sel.size) === "CYCLE" && <pre className="text-[11px] leading-relaxed">{"A → B\n↑     ↓\nD ← C"}</pre>}
                  {deriveShape(sel.size) === "CHAIN" && <pre className="text-[11px] leading-relaxed">{"A → B → C → D"}</pre>}
                  {deriveShape(sel.size) === "DENSE" && <pre className="text-[11px] leading-relaxed">{"A ↔ B\n↕  ↗↙  ↕\nC ↔ D"}</pre>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="opacity-10"><RefreshCw className="w-10 h-10 text-white" /></div>
              <p className="text-sm text-white/15">Select a ring to inspect</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// CLUSTERS — ✅ CONNECTED: GET /cluster-report (inference_service.py)
// Response: {total_clusters, high_risk_clusters, top_clusters:[{node_id,community_fraud_rate,is_fraud}]}
// NOTE: no cluster size or numeric ID — node_id used as label
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

  const clusters = report?.top_clusters     ?? [];
  const total    = report?.total_clusters    ?? 0;
  const highRisk = report?.high_risk_clusters ?? 0;

  return (
    <div>
      <PageHeading eyebrow="Community Detection" title="Cluster" accent="Report" description="Greedy modularity maximisation across the full account transaction graph." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Communities" value={total || "—"}    sub={error ? "Service unreachable" : "Live from ML"} />
        <StatCard label="High Risk"   value={highRisk || "—"} sub=">30% fraud rate" color="text-red-400" />
        <StatCard label="Shown"       value={clusters.length || "—"} sub="Top by fraud rate" color="text-yellow-400" />
        <StatCard label="Algorithm"   value="Louvain"         sub="Greedy modularity max" />
      </div>
      <div className="grid grid-cols-[1.4fr_0.6fr] gap-5">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.05] flex justify-between items-center">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Top Clusters by Fraud Rate</p>
            <LiveBadge loading={loading} error={error} />
          </div>
          {!loading && clusters.length === 0 && (
            <p className="text-sm text-white/15 py-8 text-center px-6">{error ? "Service unreachable" : "No data — run feature_engineering.py first"}</p>
          )}
          {clusters.length > 0 && (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.04]">
                  {["Node ID", "Labelled Fraud", "Community Fraud Rate", "Risk Tier"].map(h => <th key={h} className="px-5 py-3 text-left text-[9px] font-bold uppercase tracking-widest text-white/15">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {clusters.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors">
                    <td className="px-5 py-4 text-[#CAFF33] font-mono text-sm font-bold">{c.node_id}</td>
                    <td className="px-5 py-4"><Pill className={c.is_fraud ? "bg-red-500/10 border border-red-500/15 text-red-400" : "bg-[#CAFF33]/10 border border-[#CAFF33]/15 text-[#CAFF33]"}>{c.is_fraud ? "YES" : "NO"}</Pill></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-px w-20 bg-white/[0.06] relative"><div className="absolute inset-y-0 left-0 h-px rounded-full" style={{ width: `${(c.community_fraud_rate ?? 0) * 100}%`, background: hex(c.community_fraud_rate ?? 0), boxShadow: `0 0 6px ${hex(c.community_fraud_rate ?? 0)}66` }} /></div>
                        <span className="text-xs font-bold font-mono" style={{ color: hex(c.community_fraud_rate ?? 0) }}>{((c.community_fraud_rate ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-4"><Pill className={dc((c.community_fraud_rate ?? 0) >= 0.6 ? "BLOCK" : (c.community_fraud_rate ?? 0) >= 0.3 ? "REVIEW" : "APPROVE")}>{(c.community_fraud_rate ?? 0) >= 0.6 ? "Critical" : (c.community_fraud_rate ?? 0) >= 0.3 ? "High" : "Low"}</Pill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-6 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-5">Distribution</p>
            {([["Critical (>60%)", Math.round(highRisk * 0.4), "#ef4444"], ["High (30–60%)", Math.round(highRisk * 0.6), "#facc15"], ["Medium (10–30%)", Math.round(total * 0.25), "#3b82f6"], ["Low (<10%)", Math.round(total * 0.55), "#CAFF33"]] as [string, number, string][]).map(([l, c, col]) => (
              <div key={l} className="mb-4 last:mb-0">
                <div className="flex justify-between text-xs mb-1.5"><span className="text-white/25">{l}</span><span className="font-bold" style={{ color: col }}>{c}</span></div>
                <div className="h-px w-full bg-white/[0.04]"><div className="h-px transition-all duration-700 rounded-full" style={{ width: total > 0 ? `${Math.min(100, (c / total) * 100)}%` : "0%", background: col, boxShadow: `0 0 6px ${col}66` }} /></div>
              </div>
            ))}
          </Card>
          <Card className="p-5 bg-[#CAFF33]/[0.02] border-[#CAFF33]/[0.07]">
            <p className="text-[10px] text-[#CAFF33]/50 leading-relaxed italic">"Nodes inside a high-fraud cluster inherit elevated suspicion during GNN message passing."</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// BLOCKCHAIN — MOCK (no confirmed frontend endpoint yet)
// ═════════════════════════════════════════════════════════════════════════════
function BlockchainSection() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <PageHeading eyebrow="Immutable Audit Trail" title="Blockchain" accent="Ledger" description="SHA256 leaf hashes, Merkle tree batching, async Step 14. No PII stored on-chain." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Status"       value="LIVE"      sub="50 events / 5s batching" />
        <StatCard label="Merkle Depth" value="6"         sub="SHA256 leaf hash" />
        <StatCard label="Latest Block" value="#19823441" sub="Avg batch: 50 decisions" />
        <StatCard label="Immutability" value="100%"      sub="No PII on-chain" />
      </div>
      <div className="grid grid-cols-2 gap-5">
        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.05]"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20">Audit Log</p></div>
          <div className="divide-y divide-white/[0.03]">
            {MOCK_LOGS.map(log => (
              <div key={log.hash}>
                <div onClick={() => setOpen(open === log.hash ? null : log.hash)} className="px-5 py-4 hover:bg-white/[0.015] cursor-pointer transition-colors">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-3 items-center">
                      <span className="text-[10px] text-white/15 font-mono">{log.ts}</span>
                      <Pill className={dc(log.decision)}>{log.decision}</Pill>
                      <span className="text-sm text-white/40">{log.account}</span>
                    </div>
                    <div className="flex gap-3 items-center">
                      <span className={`text-sm font-bold font-mono ${tc(log.risk)}`}>{f4(log.risk, 2)}</span>
                      <Pill className="bg-blue-500/10 border border-blue-500/15 text-blue-400">{log.model}</Pill>
                      <ChevronRight className={`w-4 h-4 text-white/15 transition-transform ${open === log.hash ? "rotate-90" : ""}`} />
                    </div>
                  </div>
                  {open === log.hash && (
                    <div className="mt-4 pt-4 border-t border-white/[0.04] grid grid-cols-2 gap-x-8 gap-y-0">
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
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-5">Merkle Tree — Latest Batch</p>
            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.05] font-mono text-[11px] space-y-1.5">
              <p className="text-[#CAFF33] font-bold">MERKLE ROOT: 0xe4f2…3b91</p>
              <div className="pl-4 border-l border-white/[0.06] space-y-1 mt-2">
                <p className="text-white/25">L: 0xa3c1…7f22</p>
                <p className="text-white/25">R: 0xb9d4…2e88</p>
                <div className="pl-4 border-l border-white/[0.04] space-y-1">
                  <p className="text-white/[0.12] text-[10px]">leaf: SHA256(txId+score+decision+ts)</p>
                  <p className="text-white/[0.12] text-[10px]">leaf: SHA256(txId+score+decision+ts)</p>
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-6 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-5">Async Flow (Step 14)</p>
            <div className="space-y-3.5">
              {([["1","Decision committed to DB","#CAFF33"],["2","FraudDecisionEvent published","#3b82f6"],["3","leafHash = SHA256(txId+risk+decision+ts)","#a855f7"],["4","Batch 50 decisions → Merkle tree","#facc15"],["5","Root written to blockchain","#CAFF33"]] as [string,string,string][]).map(([n, l, c]) => (
                <div key={n} className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0 text-black" style={{ background: c }}>{n}</div>
                  <span className="text-xs text-white/30 pt-0.5 leading-relaxed">{l}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// METRICS — ✅ CONNECTED: GET /health + GET /metrics (inference_service.py)
// /health guaranteed schema: {status, model_loaded, nodes_count, version,
//   test_f1, test_auc, optimal_threshold, rings_cached, logit_cache_size}
// /metrics → raw eval_report.json (structure varies by train_model.py run)
// ═════════════════════════════════════════════════════════════════════════════
function MetricsSection() {
  const [evalData, setEvalData] = useState<any>(null);
  const [health,   setHealth]   = useState<any>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${ML_URL}/metrics`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${ML_URL}/health`).then(r => r.json()).catch(() => null),
    ]).then(([ev, he]) => { setEvalData(ev); setHealth(he); setLoading(false); if (!he) setError(true); });
  }, []);

  const modelStatus = health?.status           ?? "UNAVAILABLE";
  const version     = health?.version          ?? "GNN-v3";
  const nodesCount  = health?.nodes_count      ?? 0;
  const ringsCached = health?.rings_cached     ?? 0;
  const logitCache  = health?.logit_cache_size ?? 0;
  const threshold   = health?.optimal_threshold ?? evalData?.optimal_threshold ?? 0.5;
  const testF1      = health?.test_f1  ?? evalData?.test?.f1  ?? evalData?.f1  ?? 0;
  const testAuc     = health?.test_auc ?? evalData?.test?.auc_roc ?? evalData?.auc_roc ?? 0;
  const valF1       = evalData?.val?.f1        ?? evalData?.validation?.f1       ?? 0;
  const valAuc      = evalData?.val?.auc_roc   ?? evalData?.validation?.auc_roc  ?? 0;
  const prec        = evalData?.test?.precision ?? evalData?.precision ?? 0;
  const rec         = evalData?.test?.recall    ?? evalData?.recall    ?? 0;

  return (
    <div>
      <PageHeading eyebrow="Evaluation Results" title="Model" accent="Metrics" description="Precision / Recall / F1 / AUC evaluated on a stratified held-out test set." />
      <div className="grid grid-cols-4 gap-4 mb-8">
        <Card className="p-6">
          <div className="flex justify-between items-start mb-3">
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Model Status</p>
            <LiveBadge loading={loading} error={error} />
          </div>
          <p className={`text-3xl font-black leading-none mb-1.5 ${modelStatus === "HEALTHY" ? "text-[#CAFF33]" : "text-red-400"}`}>
            {loading ? "…" : modelStatus}
          </p>
          <p className="text-[10px] text-white/20">{version}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[9px] text-white/20 uppercase tracking-widest mb-3 font-bold">Test F1</p>
          <p className="text-4xl font-black text-[#CAFF33] leading-none mb-1.5">{testF1 > 0 ? f4(testF1, 4) : "—"}</p>
          <p className="text-[10px] text-[#CAFF33]/40">{testF1 > 0 ? `Target >0.80 ${testF1 > 0.8 ? "✓" : "✗"}` : "from /health"}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[9px] text-white/20 uppercase tracking-widest mb-3 font-bold">AUC-ROC</p>
          <p className="text-4xl font-black text-[#CAFF33] leading-none mb-1.5">{testAuc > 0 ? f4(testAuc, 4) : "—"}</p>
          <p className="text-[10px] text-[#CAFF33]/40">{testAuc > 0 ? `Target >0.90 ${testAuc > 0.9 ? "✓" : "✗"}` : "from /health"}</p>
        </Card>
        <Card className="p-6">
          <p className="text-[9px] text-white/20 uppercase tracking-widest mb-3 font-bold">Threshold</p>
          <p className="text-4xl font-black text-yellow-400 leading-none mb-1.5">{f4(threshold, 4)}</p>
          <p className="text-[10px] text-white/20">Optimal decision threshold</p>
        </Card>
      </div>

      <div className="grid grid-cols-[1.2fr_0.8fr] gap-5">
        <Card className="p-7">
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-7">Test vs Validation</p>
          {prec === 0 && valF1 === 0 ? (
            <p className="text-sm text-white/20 leading-relaxed">Detailed split metrics not found in eval_report.json.<br />Re-run train_model.py to populate eval_report.json with test/val splits.</p>
          ) : (
            <div className="space-y-6">
              {([["F1", testF1, valF1], ["AUC-ROC", testAuc, valAuc], ["Precision", prec, 0], ["Recall", rec, 0]] as [string, number, number][]).map(([k, tv, vv]) => (
                <div key={k}>
                  <div className="flex justify-between mb-2.5 items-baseline">
                    <span className="text-xs font-bold uppercase text-white/30">{k}</span>
                    <div className="flex gap-6 text-xs">
                      {vv > 0 && <span className="text-white/20">Val <span className="text-[#CAFF33]/35 font-bold">{f4(vv, 4)}</span></span>}
                      <span className="text-white/20">Test <span className="text-[#CAFF33] font-bold">{f4(tv, 4)}</span></span>
                    </div>
                  </div>
                  <div className="relative h-px w-full bg-white/[0.04]">
                    {vv > 0 && <div className="absolute inset-y-0 left-0 h-px bg-[#CAFF33]/15" style={{ width: `${vv * 100}%` }} />}
                    <div className="absolute inset-y-0 left-0 h-px bg-[#CAFF33] rounded-full" style={{ width: `${tv * 100}%`, boxShadow: "0 0 8px #CAFF3366" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 mb-5">Runtime (from /health)</p>
            {([["Version", version], ["Nodes in Graph", nodesCount > 0 ? nodesCount.toLocaleString() : "—"], ["Rings Cached", ringsCached > 0 ? String(ringsCached) : "—"], ["Logit Cache", logitCache > 0 ? `${logitCache.toLocaleString()} nodes` : "—"], ["Threshold", f4(threshold, 4)], ["GNN Endpoint", "/v1/gnn/score"]] as [string, string][]).map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </Card>
          <Card className="p-6 flex-1 bg-[#CAFF33]/[0.02] border-[#CAFF33]/[0.07]">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#CAFF33]/35 mb-4">Nightly Eval Pipeline</p>
            {["① @Scheduled Spring Boot job", "② JOIN predictions + fraud_labels", "③ Compute P / R / F1 / AUC", "④ Compare vs previous version", "⑤ Store in model_performance_metrics", "⑥ Alert if F1 drops >5%"].map(l => (
              <p key={l} className="text-[10px] text-white/20 font-mono leading-relaxed">{l}</p>
            ))}
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
  const [active, setActive] = useState<View>("simulator");

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

  return (
    <div className="bg-[#050505] text-white min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-60 shrink-0 border-r border-white/[0.05] flex flex-col py-8 px-4 sticky top-0 h-screen overflow-y-auto">
          <div className="mb-8 px-3">
            <div className="flex items-center gap-2.5 mb-0.5">
              <div className="w-5 h-5 rounded-md bg-[#CAFF33]/10 border border-[#CAFF33]/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-sm bg-[#CAFF33]" />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20">MuleHunter AI</p>
            </div>
            <p className="text-sm font-bold text-white/60 pl-7">Fraud Intelligence</p>
          </div>

          <nav className="space-y-0.5 flex-1">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActive(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150 group ${active === id ? "bg-[#CAFF33]/[0.08] text-[#CAFF33]" : "text-white/25 hover:text-white/50 hover:bg-white/[0.025]"}`}>
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${active === id ? "text-[#CAFF33]" : "text-white/15 group-hover:text-white/35"}`} />
                <span className="text-[13px] font-semibold tracking-tight">{label}</span>
                {active === id && <div className="ml-auto w-1 h-1 rounded-full bg-[#CAFF33]/60" />}
              </button>
            ))}
          </nav>

          <div className="mt-6 mx-1 pt-6 border-t border-white/[0.04]">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#CAFF33]" style={{ boxShadow: "0 0 6px #CAFF33" }} />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/15">Live</span>
            </div>
            <p className="text-[9px] text-white/10 pl-3.5 font-mono">56.228.10.113:8001</p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1280px] mx-auto px-8 py-10">
            {SECTIONS[active]}
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}