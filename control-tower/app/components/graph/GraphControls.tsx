"use client";

import React from "react";

interface GraphControlsProps {
  // filter state (owned by parent page)
  riskThreshold: number;
  setRiskThreshold: (v: number) => void;
  showOnlyFraud: boolean;
  setShowOnlyFraud: (v: boolean) => void;
  showOnlyRings: boolean;
  setShowOnlyRings: (v: boolean) => void;
  searchId: string;
  setSearchId: (v: string) => void;
  onSearch: () => void;
  onReset: () => void;
  // stats
  totalNodes: number;
  fraudNodes: number;
  rings: number;
}

export default function GraphControls({
  riskThreshold,
  setRiskThreshold,
  showOnlyFraud,
  setShowOnlyFraud,
  showOnlyRings,
  setShowOnlyRings,
  searchId,
  setSearchId,
  onSearch,
  onReset,
  totalNodes,
  fraudNodes,
  rings,
}: GraphControlsProps) {
  const fraudPct =
    totalNodes > 0 ? ((fraudNodes / totalNodes) * 100).toFixed(1) : "0";

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col gap-0 overflow-y-auto"
      style={{
        background: "rgba(8,10,18,0.92)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="text-[10px] font-mono uppercase tracking-widest mb-1"
          style={{ color: "#4b5563" }}
        >
          alertixAI
        </div>
        <div className="text-sm font-semibold text-white">
          Transaction Network
        </div>
        <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
          Graph intelligence layer
        </div>
      </div>

      {/* Cluster stats */}
      <div
        className="grid grid-cols-3 gap-px"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {[
          { label: "Nodes", value: totalNodes.toLocaleString(), color: "#60a5fa" },
          { label: "Fraud", value: fraudNodes.toLocaleString(), color: "#ef4444" },
          { label: "Rings", value: rings.toString(), color: "#facc15" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex flex-col items-center py-3"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <span className="text-sm font-mono font-bold" style={{ color }}>
              {value}
            </span>
            <span className="text-[10px] mt-0.5" style={{ color: "#4b5563" }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Search */}
      <div
        className="px-4 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <SectionLabel>Search Account</SectionLabel>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            placeholder="Account ID…"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="flex-1 px-3 py-2 text-xs rounded-md text-white placeholder-gray-600 outline-none transition"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          />
          <button
            onClick={onSearch}
            className="px-3 py-2 text-xs rounded-md transition"
            style={{
              background: "rgba(59,130,246,0.2)",
              border: "1px solid rgba(59,130,246,0.4)",
              color: "#60a5fa",
            }}
          >
            ↵
          </button>
        </div>
      </div>

      {/* Risk threshold */}
      <div
        className="px-4 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex justify-between items-center mb-2">
          <SectionLabel>Risk Threshold</SectionLabel>
          <span className="text-xs font-mono" style={{ color: "#ef4444" }}>
            {(riskThreshold * 100).toFixed(0)}%+
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={riskThreshold}
          onChange={(e) => setRiskThreshold(Number(e.target.value))}
          className="w-full accent-red-500"
          style={{ cursor: "pointer" }}
        />
        {/* Color bar */}
        <div className="flex mt-1.5 gap-px rounded-full overflow-hidden h-1.5">
          {Array.from({ length: 20 }).map((_, i) => {
            const pct = i / 19;
            const active = pct >= riskThreshold;
            return (
              <div
                key={i}
                className="flex-1 transition-opacity"
                style={{
                  background: `hsl(${120 - pct * 120}, 80%, 45%)`,
                  opacity: active ? 1 : 0.18,
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] mt-1" style={{ color: "#4b5563" }}>
          <span>All nodes</span>
          <span>High risk only</span>
        </div>
      </div>

      {/* Filter toggles */}
      <div
        className="px-4 py-4 flex flex-col gap-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <SectionLabel>Filters</SectionLabel>

        <Toggle
          checked={showOnlyFraud}
          onChange={setShowOnlyFraud}
          color="#ef4444"
          label="Fraud nodes only"
          sublabel="Hide all clean accounts"
        />
        <Toggle
          checked={showOnlyRings}
          onChange={setShowOnlyRings}
          color="#facc15"
          label="Ring members only"
          sublabel="Show mule ring participants"
        />
      </div>

      {/* Legend */}
      <div
        className="px-4 py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <SectionLabel>Node Roles</SectionLabel>
        <div className="mt-2 space-y-2.5">
          {[
            {
              color: "#ef4444",
              border: "#ef4444",
              label: "HUB",
              desc: "Ring organiser, high PageRank",
            },
            {
              color: "#f97316",
              border: "#f97316",
              label: "BRIDGE",
              desc: "Connects sub-clusters",
            },
            {
              color: "#94a3b8",
              border: "#94a3b8",
              label: "MULE",
              desc: "Leaf forwarder account",
            },
            {
              color: "#22c55e",
              border: "#22c55e",
              label: "NORMAL",
              desc: "Low risk account",
            },
          ].map(({ color, border, label, desc }) => (
            <div key={label} className="flex items-start gap-2.5">
              <div
                className="mt-0.5 flex-shrink-0 w-3 h-3 rounded-full"
                style={{
                  background: `${color}33`,
                  border: `1.5px solid ${border}`,
                }}
              />
              <div>
                <div className="text-xs font-medium" style={{ color }}>
                  {label}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: "#4b5563" }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk scale legend */}
      <div className="px-4 py-4">
        <SectionLabel>Risk Color Scale</SectionLabel>
        <div
          className="mt-2 h-2 rounded-full"
          style={{
            background: "linear-gradient(to right, #22c55e, #eab308, #ef4444)",
          }}
        />
        <div
          className="flex justify-between text-[10px] mt-1"
          style={{ color: "#4b5563" }}
        >
          <span>0% — Safe</span>
          <span>100% — Fraud</span>
        </div>
      </div>

      {/* Reset */}
      <div className="px-4 pb-5 mt-auto">
        <button
          onClick={onReset}
          className="w-full py-2 text-xs rounded-lg transition"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#6b7280",
          }}
        >
          ↺ Reset All Filters
        </button>
      </div>
    </aside>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-[10px] font-mono uppercase tracking-widest"
      style={{ color: "#4b5563" }}
    >
      {children}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
  label: string;
  sublabel?: string;
}

function Toggle({ checked, onChange, color, label, sublabel }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      {/* Custom toggle */}
      <div className="relative flex-shrink-0 mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-8 h-4.5 rounded-full transition-all"
          style={{
            background: checked ? `${color}44` : "rgba(255,255,255,0.08)",
            border: checked ? `1px solid ${color}` : "1px solid rgba(255,255,255,0.12)",
            width: 32,
            height: 18,
          }}
        >
          <div
            className="absolute top-0.5 rounded-full transition-all"
            style={{
              width: 14,
              height: 14,
              background: checked ? color : "#4b5563",
              transform: checked ? "translateX(15px)" : "translateX(2px)",
            }}
          />
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-300 group-hover:text-white transition">
          {label}
        </div>
        {sublabel && (
          <div className="text-[10px] mt-0.5" style={{ color: "#4b5563" }}>
            {sublabel}
          </div>
        )}
      </div>
    </label>
  );
}