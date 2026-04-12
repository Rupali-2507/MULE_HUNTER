"use client";

import React, { useEffect, useState } from "react";
import type { GraphNode } from "./FraudGraph3D";

// ── Raw MongoDB field names (snake_case) from ReactiveMongoTemplate ───────────

interface NodeData {
  _id: any;
  node_id: number;
  is_fraud: string;
  account_age_days: string;
  balance: string;
  in_out_ratio: string;
  pagerank: string;
  tx_velocity: string;
  in_degree: string;
  out_degree: string;
  total_incoming: string;
  total_outgoing: string;
  risk_ratio: string;
  anomaly_score: number;
  is_anomalous: number;
  reasons?: string[];
  shap_factors?: { feature: string; impact: number }[];
}

interface NodeInspectorProps {
  node: GraphNode;
  onClose: () => void;
}

function riskColor(score: number): string {
  if (score >= 0.75) return "#ef4444";
  if (score >= 0.45) return "#f97316";
  if (score >= 0.2)  return "#eab308";
  return "#22c55e";
}

function roleColor(role: string | undefined): string {
  switch (role) {
    case "HUB":    return "#ef4444";
    case "BRIDGE": return "#f97316";
    case "MULE":   return "#94a3b8";
    default:       return "#22c55e";
  }
}

function fmt(val: string | number | undefined | null, decimals = 2): string {
  const n = Number(val);
  if (val === null || val === undefined || val === "" || isNaN(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function Row({ label, value, valueColor }: {
  label: string; value: React.ReactNode; valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center py-2"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-xs font-medium text-white opacity-70">{label}</span>
      <span className="text-xs font-mono font-bold" style={{ color: valueColor ?? "#fff" }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[11px] font-mono uppercase tracking-widest mb-2 font-semibold"
        style={{ color: "rgba(255,255,255,0.35)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function RiskGauge({ score }: { score: number }) {
  const r = 50, cx = 60, cy = 60;
  const arcLen = Math.PI * r;
  const offset = arcLen - arcLen * Math.max(0, Math.min(1, score));
  const color  = riskColor(score);
  const d      = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg width={120} height={72} viewBox="0 0 120 72">
      <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round"
        strokeDasharray={`${arcLen} ${arcLen}`} strokeDashoffset={offset}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={24} fontWeight="bold"
        fontFamily="monospace" fill={color}>{(score * 100).toFixed(0)}%</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={9}
        fontFamily="monospace" fill="rgba(255,255,255,0.4)" letterSpacing={1.5}>ANOMALY SCORE</text>
    </svg>
  );
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.08)" }}>
      <div className="h-full rounded-full"
        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88` }} />
    </div>
  );
}

function ShapBar({ feature, impact, maxAbs }: { feature: string; impact: number; maxAbs: number }) {
  const pct   = maxAbs > 0 ? (Math.abs(impact) / maxAbs) * 100 : 0;
  const color = impact > 0 ? "#ef4444" : "#22c55e";
  const label = feature.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-xs font-medium text-white">{label}</span>
        <span className="text-xs font-mono font-bold" style={{ color }}>
          {impact > 0 ? "+" : ""}{impact.toFixed(4)}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <div className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}88` }} />
      </div>
    </div>
  );
}

export function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const [nodeData, setNodeData] = useState<NodeData | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "http://localhost:8080";

  useEffect(() => {
    if (!node?.id) return;
    setNodeData(null);
    setError(null);
    setLoading(true);

    const url = `${API_BASE}/api/nodes/node/${node.id}`;
    console.log("[NodeInspector] Fetching:", url);

    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: NodeData) => { console.log("[NodeInspector] Data:", data); setNodeData(data); })
      .catch(err => { console.error("[NodeInspector] Error:", err.message); setError(err.message); })
      .finally(() => setLoading(false));
  }, [node?.id, API_BASE]);

  // Use snake_case fields from raw MongoDB response
  const anomalyScore = nodeData?.anomaly_score  ?? node.anomalyScore  ?? 0;
  const isAnomalous  = nodeData ? nodeData.is_anomalous === 1 : node.is_anomalous;
  const isFraud      = nodeData?.is_fraud === "1";
  const role         = node.role ?? "NORMAL";

  const inDeg      = Number(nodeData?.in_degree      ?? 0);
  const outDeg     = Number(nodeData?.out_degree     ?? 0);
  const maxDeg     = Math.max(inDeg, outDeg, 1);
  const txVelocity = Number(nodeData?.tx_velocity    ?? 0);
  const inOutRatio = Number(nodeData?.in_out_ratio   ?? 0);
  const riskRatio  = Number(nodeData?.risk_ratio     ?? 0);
  const totalIn    = Number(nodeData?.total_incoming ?? 0);
  const totalOut   = Number(nodeData?.total_outgoing ?? 0);
  const balance    = Number(nodeData?.balance        ?? 0);
  const pagerank   = Number(nodeData?.pagerank       ?? node.pagerank ?? 0);
  const acctAge    = Number(nodeData?.account_age_days ?? 0);

  const shapFactors = nodeData?.shap_factors ?? [];
  const maxAbs = shapFactors.reduce((m, s) => Math.max(m, Math.abs(s.impact)), 0);
  const reasons = nodeData?.reasons ?? [];

  return (
    <aside className="w-80 flex-shrink-0 flex flex-col overflow-y-auto"
      style={{ background: "rgba(8,10,18,0.97)", borderLeft: "1px solid rgba(255,255,255,0.09)", backdropFilter: "blur(14px)" }}>

      {/* Header */}
      <div className="px-4 py-4 flex items-start justify-between"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest mb-1 font-semibold"
            style={{ color: "rgba(255,255,255,0.4)" }}>Node Inspector</div>
          <div className="text-base font-bold text-white font-mono">Account #{String(node.id)}</div>
          {nodeData && (
            <div className="text-[11px] font-mono mt-0.5 opacity-30 text-white">
              node_id: {nodeData.node_id}
            </div>
          )}
        </div>
        <button onClick={onClose}
          className="text-white opacity-40 hover:opacity-90 transition text-xl leading-none mt-1">✕</button>
      </div>

      {/* Gauge + badges */}
      <div className="flex flex-col items-center py-5 gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <RiskGauge score={anomalyScore} />
        <div className="flex gap-2 flex-wrap justify-center">
          <div className="px-3 py-1 rounded-full text-xs font-mono font-bold"
            style={{
              background: isAnomalous ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)",
              border: `1px solid ${isAnomalous ? "#ef444466" : "#22c55e66"}`,
              color: isAnomalous ? "#ef4444" : "#22c55e",
            }}>
            {isAnomalous ? "⚠ ANOMALOUS" : "✓ CLEAN"}
          </div>
          <div className="px-3 py-1 rounded-full text-xs font-mono font-bold"
            style={{
              background: isFraud ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.12)",
              border: `1px solid ${isFraud ? "#ef444466" : "#22c55e66"}`,
              color: isFraud ? "#ef4444" : "#22c55e",
            }}>
            {isFraud ? "FRAUD" : "LEGIT"}
          </div>
          <div className="px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider"
            style={{
              background: `${roleColor(role)}1a`,
              border: `1px solid ${roleColor(role)}55`,
              color: roleColor(role),
            }}>
            {role}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="px-4 py-6 flex items-center gap-2 text-white opacity-40">
          <span className="animate-spin text-sm">⟳</span>
          <span className="text-xs font-mono">Fetching node data…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-3 mx-4 my-3 rounded-lg text-xs font-mono"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="text-red-400">⚠ {error}</div>
          <div className="text-white opacity-30 mt-1">Showing graph data only</div>
        </div>
      )}

      {/* Account overview */}
      {nodeData && (
        <Section title="Account Overview">
          <Row label="Account Age"
            value={`${fmt(acctAge, 0)} days`}
            valueColor={acctAge < 30 ? "#f97316" : "#fff"} />
          <Row label="Balance"
            value={`₹ ${fmt(balance)}`}
            valueColor={balance < 0 ? "#ef4444" : "#fff"} />
          <Row label="PageRank" value={pagerank.toFixed(6)} valueColor="#60a5fa" />
        </Section>
      )}

      {/* Transaction flow */}
      {nodeData && (
        <Section title="Transaction Flow">
          <Row label="Total Incoming" value={`₹ ${fmt(totalIn)}`}  valueColor="#22c55e" />
          <Row label="Total Outgoing" value={`₹ ${fmt(totalOut)}`} valueColor="#ef4444" />
          <Row label="In / Out Ratio"
            value={fmt(inOutRatio, 3)}
            valueColor={inOutRatio > 2 ? "#ef4444" : inOutRatio > 1 ? "#f97316" : "#fff"} />
          <Row label="Tx Velocity"
            value={fmt(txVelocity, 0)}
            valueColor={txVelocity > 50 ? "#ef4444" : "#fff"} />
        </Section>
      )}

      {/* Graph topology */}
      <Section title="Graph Topology">
        {nodeData && (
          <>
            <div className="mb-1">
              <Row label="In-Degree" value={fmt(inDeg, 0)} valueColor={inDeg > 50 ? "#ef4444" : "#fff"} />
              <StatBar value={inDeg} max={maxDeg} color="#60a5fa" />
            </div>
            <div className="mb-1">
              <Row label="Out-Degree" value={fmt(outDeg, 0)} valueColor={outDeg > 50 ? "#ef4444" : "#fff"} />
              <StatBar value={outDeg} max={maxDeg} color="#f97316" />
            </div>
          </>
        )}
        <Row label="PageRank" value={pagerank.toFixed(4)} valueColor="#60a5fa" />
        <Row label="Volume"   value={node.volume ?? 0} />
        {node.clusterId !== undefined && <Row label="Cluster ID" value={String(node.clusterId)} />}
        {node.clusterFraudRate !== undefined && (
          <Row label="Cluster Fraud Rate"
            value={`${((node.clusterFraudRate ?? 0) * 100).toFixed(1)}%`}
            valueColor={riskColor(node.clusterFraudRate ?? 0)} />
        )}
        {node.ringIds && node.ringIds.length > 0 && (
          <Row label="Ring IDs" value={node.ringIds.join(", ")} valueColor="#facc15" />
        )}
      </Section>

      {/* Risk signals */}
      {nodeData && (
        <Section title="Risk Signals">
          <Row label="Anomaly Score"
            value={`${(anomalyScore * 100).toFixed(2)}%`}
            valueColor={riskColor(anomalyScore)} />
          <Row label="Risk Ratio"
            value={fmt(riskRatio, 4)}
            valueColor={riskRatio > 0.5 ? "#ef4444" : riskRatio > 0.2 ? "#f97316" : "#fff"} />
          <StatBar value={riskRatio} max={1} color={riskColor(riskRatio)} />
        </Section>
      )}

      {/* SHAP factors */}
      {shapFactors.length > 0 && (
        <Section title="SHAP Risk Factors">
          {shapFactors
            .slice().sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
            .map(s => <ShapBar key={s.feature} feature={s.feature} impact={s.impact} maxAbs={maxAbs} />)
          }
        </Section>
      )}

      {/* Reasons */}
      {reasons.length > 0 && (
        <Section title="Risk Reasons">
          <div className="space-y-1.5 mt-1">
            {reasons.map((r, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-[10px]" style={{ color: "#ef4444" }}>▸</span>
                <span className="text-xs text-white leading-snug">{r}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      
    </aside>
  );
}

export default NodeInspector;