"use client";

import { useState } from "react";
import useExplanations from "../../../hooks/useExplanations";

interface GraphNode {
  id: string | number;
  is_anomalous?: boolean | number;
  anomalyScore?: number;
  volume?: number;
  size?: number;
}

interface NodeInspectorProps {
  node: GraphNode | null;
  onClose: () => void;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

interface MetricProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  color?: "red" | "green";
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

interface ShapSlideProps {
  reasons: string[];
  loading: boolean;
  isAnomalous: boolean;
}

interface AISlideProps {
  aiText: string | null;
  loading: boolean;
  onGenerate: () => void;
}

export default function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const [aiText, setAiText] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);
  const [closing, setClosing] = useState<boolean>(false);
  const [activeSlide, setActiveSlide] = useState<"shap" | "ai">("shap");

  const nodeId = node ? Number(node.id) : null;
  const { explanation, loading } = useExplanations(nodeId);

  if (!node) return null;

  const isAnomalous = node.is_anomalous === true || node.is_anomalous === 1;
  const reasons: string[] = explanation?.reasons ?? [];

  const generateAIExplanation = async () => {
    setLoadingAI(true);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          anomalyScore: node.anomalyScore,
          reasons,
          isAnomalous,
          volume: node.volume,
        }),
      });
      const data = await res.json();
      setAiText(data.explanation);
    } catch {
      setAiText("Failed to generate explanation.");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      setAiText(null);
      setClosing(false);
      onClose();
    }, 250);
  };

  return (
    <aside
      className={`fixed right-0 top-0 pt-10 z-50 w-[380px] h-screen overflow-y-auto
        ${closing ? "animate-slide-out" : "animate-slide-in"}
        ${
          isAnomalous
            ? "bg-zinc-900 border-l border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            : "bg-zinc-900 border-l border-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
        }
      `}
    >
      {/* HEADER */}
      <div className="flex justify-between items-center px-5">
        <h2 className="text-lg font-semibold">
          Node Forensics:{" "}
          <span className={isAnomalous ? "text-red-400" : "text-green-400"}>
            ACC{node.id}
          </span>
        </h2>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* ACCOUNT SUMMARY */}
      <Section title="Account Summary">
        <Metric
          label="Risk Status"
          value={isAnomalous ? "Anomalous" : "Normal"}
          highlight={isAnomalous}
        />
        <Metric
          label="Risk Score"
          value={
            node.anomalyScore !== undefined
              ? Math.abs(node.anomalyScore * 100).toFixed(1)
              : "N/A"
          }
        />
      </Section>

      {/* METRICS */}
      <Section title="Metrics">
        <Metric
          label="Total Transactions"
          value={Math.round(node.volume ?? node.size ?? 0)}
        />
        <Metric label="Suspicious vs Normal" value="40 / 160" />
        <Metric
          label="Connectivity Score"
          value="92"
          color={isAnomalous ? "red" : "green"}
        />
      </Section>

      {/* EXPLAINABILITY */}
      <Section title="Explainability">
        <div className="flex mb-4 rounded-md overflow-hidden border border-zinc-700">
          <TabButton
            active={activeSlide === "shap"}
            onClick={() => setActiveSlide("shap")}
          >
            SHAP Explainability
          </TabButton>
          <TabButton
            active={activeSlide === "ai"}
            onClick={() => setActiveSlide("ai")}
          >
            AI Explanation
          </TabButton>
        </div>

        <div className="min-h-[140px] transition-all">
          {activeSlide === "shap" ? (
            <ShapSlide
              reasons={reasons}
              loading={loading}
              isAnomalous={isAnomalous}
            />
          ) : (
            <AISlide
              aiText={aiText}
              loading={loadingAI}
              onGenerate={generateAIExplanation}
            />
          )}
        </div>
      </Section>

      {/* ACTIONS */}
      <div className="flex gap-3 p-5">
        <button className="flex-1 rounded-md border border-green-500 text-green-400 py-2">
          Mark as Safe
        </button>
        <button className="flex-1 rounded-md bg-red-600 py-2">
          Initiate Freeze
        </button>
      </div>
    </aside>
  );
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="p-5 border-b border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value, highlight, color }: MetricProps) {
  const colorClass =
    color === "red"
      ? "text-red-400"
      : color === "green"
      ? "text-green-400"
      : "";

  return (
    <div className="flex justify-between text-sm mb-2">
      <span className="text-gray-400">{label}</span>
      <span className={`${highlight ? "font-semibold" : ""} ${colorClass}`}>
        {value}
      </span>
    </div>
  );
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-sm font-medium
        ${
          active
            ? "bg-zinc-800 text-white"
            : "bg-zinc-900 text-gray-400 hover:text-white"
        }
      `}
    >
      {children}
    </button>
  );
}

function ShapSlide({ reasons, loading, isAnomalous }: ShapSlideProps) {
  if (loading) return <p className="text-xs text-gray-500">Loading…</p>;

  if (!reasons.length) {
    return (
      <p className="text-xs text-gray-500 italic">
        No strong SHAP signals for this account.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {reasons.map((reason, i) => (
        <li
          key={i}
          className={`flex gap-2 items-start p-2 rounded-md text-sm
            ${
              isAnomalous
                ? "bg-red-950/40 text-red-200"
                : "bg-green-950/40 text-green-200"
            }`}
        >
          <span className="mt-0.5">▸</span>
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}

function AISlide({ aiText, loading, onGenerate }: AISlideProps) {
  return (
    <>
      <div className="min-h-[80px] mb-3">
        {aiText ? (
          <div className="bg-zinc-800 p-3 rounded-md text-sm text-gray-200">
            {aiText}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">
            Generate a natural language explanation based on model signals.
          </p>
        )}
      </div>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="w-full rounded-md bg-white text-black py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? "Generating..." : "Generate AI Summary"}
      </button>
    </>
  );
}