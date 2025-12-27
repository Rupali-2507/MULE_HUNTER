"use client";
import { useEffect, useRef } from "react";

type VisualAnalyticsCardProps = {
  vaStatus: "idle" | "running" | "done" | "failed";
  vaEvents: any[];
};

export default function VisualAnalyticsCard({
  vaStatus,
  vaEvents,
}: VisualAnalyticsCardProps) {
  if (vaStatus === "idle") {
    return (
      <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl">
        <p className="text-gray-500 italic">
          Submit a transaction to start Visual-Analytics
        </p>
      </div>
    );
  }


// Inside the component:
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [vaEvents]);
  

  return (
    <div className="h-full p-4 bg-gray-900 rounded-xl border border-gray-800 flex flex-col">
      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-orange-400">
          🟠 Visual-Analytics — Unsupervised ML
        </h3>

        <span
          className={`text-xs px-2 py-1 rounded-full ${
            vaStatus === "running"
              ? "bg-yellow-500/20 text-yellow-400"
              : vaStatus === "done"
              ? "bg-green-500/20 text-green-400"
              : "bg-red-500/20 text-red-400"
          }`}
        >
          {vaStatus.toUpperCase()}
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-1 shrink-0">
        Graph-based · Population-aware · Explainable (EIF + SHAP)
      </p>

      {/* ================= SUMMARY (FIXED) ================= */}
      <div className="mt-3 space-y-2 text-sm text-gray-300 shrink-0">
        {vaEvents.map((e, i) => (
          <div key={i}>
            {e.stage === "population_loaded" && (
              <>📐 Loaded {e.data?.total_nodes} reference accounts</>
            )}

            {e.stage === "scoring_started" && (
              <>🧬 Constructing graph feature vector</>
            )}

            {e.stage === "eif_result" && (
              <>
                📉 EIF Score <b>{e.data?.score}</b>{" "}
                {e.data?.is_anomalous ? (
                  <span className="text-red-500">→ ANOMALOUS</span>
                ) : (
                  <span className="text-green-400">→ NORMAL</span>
                )}
              </>
            )}

            {e.stage === "shap_started" && (
              <>🧠 Running SHAP explainability</>
            )}

            {e.stage === "shap_completed" && (
              <>
                🧠 Top contributing features:
                <ul className="list-disc list-inside text-xs text-gray-400 mt-1">
                  {e.data?.top_factors?.map((f: any, idx: number) => (
                    <li key={idx}>
                      {f.feature} (impact {f.impact})
                    </li>
                  ))}
                </ul>
              </>
            )}

            {e.stage === "shap_skipped" && (
              <>🧠 SHAP skipped — normal behavior</>
            )}

            {e.stage === "unsupervised_completed" && (
              <div className="mt-2 font-semibold text-green-400">
                ✅ Visual-Analytics completed
              </div>
            )}

            {e.stage === "unsupervised_failed" && (
              <div className="text-red-500">
                ❌ Visual-Analytics failed
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ================= LIVE STREAM (SCROLLABLE) ================= */}
      <div className="mt-4 flex-1 bg-[#0f172a] border border-gray-700 rounded-xl p-3 overflow-y-auto" ref={scrollRef}>
        <h3 className="text-[#caff33] font-semibold mb-2 flex items-center gap-2 sticky top-0 bg-[#0f172a] py-1 z-10">
          🧠 Visual ML (Live)
          {vaStatus === "running" && (
            <span className="text-xs text-yellow-400 animate-pulse">
              ● streaming
            </span>
          )}
        </h3>

        {vaEvents.length === 0 ? (
          <p className="text-xs text-gray-500 italic">
            Waiting for ML events…
          </p>
        ) : (
          <ul className="space-y-2 text-xs font-mono text-gray-300">
            {vaEvents.map((e, i) => (
              <li key={i} className="bg-black/40 rounded-md p-2">
                <span className="text-blue-400">
                  {e.stage || e.event}
                </span>
                <div className="text-gray-400 break-words">
                  {JSON.stringify(e.data)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {vaStatus === "running" && (
        <div className="mt-2 text-xs text-gray-500 italic">
          Analyzing behavioral patterns…
        </div>
      )}
    </div>
  );
}
