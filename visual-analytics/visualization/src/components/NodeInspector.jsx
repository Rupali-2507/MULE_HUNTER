import { useState } from "react";

export default function NodeInspector({ node, explanations, onClose }) {
  const [aiText, setAiText] = useState(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);

  if (!node) return null;
  console.log("Selected Node:", node);
  const isAnomalous = node.is_anomalous === 1;
  const reasons = explanations?.[node.id] || [];

  const generateAIExplanation = async () => {
    setLoading(true);

    setTimeout(() => {
      setAiText(
        `Account ${node.id} shows unusual transaction behavior with high connectivity 
to anomalous accounts. Rapid inflow and outflow patterns indicate potential mule activity.`
      );
      setLoading(false);
    }, 1200);
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
      className={`fixed right-0 top-0 pt-10 z-100 w-95 h-screen overflow-y-auto animate-slide-in
    ${
      isAnomalous
        ? "bg-zinc-900 border-l border-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]"
        : "bg-zinc-900 border-l border-green-600 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
    }
  `}
    >
      {/* Header */}
      <div className="flex justify-between">
        <h2 className="text-lg font-semibold pl-5">
          Node Forensics:{" "}
          <span className={isAnomalous ? "text-red-400" : "text-green-400"}>
            ACC{node.id}
          </span>
        </h2>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-white pr-6 cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Account Summary */}
      <Section title="Account Summary">
        <Metric
          label="Risk Status"
          value={node.is_anomalous === 1 ? "Anomalous" : "Normal"}
          highlight={node.is_anomalous === 1}
        />

        <Metric label="Risk Score" value={(node.height * 100).toFixed(1)} />
      </Section>

      {/* Metrics */}
      <Section title="Metrics">
        <Metric label="Total Transactions" value={Math.round(node.size)} />

        <Metric label="Suspicious vs Normal" value="40 / 160" />
        <Metric
          label="Connectivity Score"
          value="92"
          color={isAnomalous ? "red" : "green"}
        />
      </Section>

      {/* Explainability */}
      <Section title="AI Explainability">
        <p className="text-sm text-gray-400 mb-3">
          Why was this account flagged?
        </p>

        {reasons.length > 0 && (
          <ul className="mb-3 list-disc pl-4 text-sm text-gray-300 space-y-1">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}

        {aiText && (
          <div className="bg-zinc-800 p-3 rounded-md text-sm text-gray-200 mb-3">
            {aiText}
          </div>
        )}

        <button
          onClick={generateAIExplanation}
          disabled={loading}
          className="w-full rounded-md bg-white text-black py-2 text-sm font-medium hover:bg-gray-200"
        >
          {loading ? "Generating..." : "Generate AI Summary"}
        </button>
      </Section>

      {/* Actions */}
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

function Section({ title, children }) {
  return (
    <div className="p-5 border-b border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Metric({ label, value, highlight, color }) {
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
