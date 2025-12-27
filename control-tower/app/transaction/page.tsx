"use client";

import { useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import VisualAnalyticsCard from "../components/VisualAnalyticsCard";

type ActiveTab = "unsupervised" | "ja3" | "supervised";

export default function FakeTransactionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null); // Stores Your Supervised Data

  const [vaEvents, setVaEvents] = useState<any[]>([]);
  const [vaStatus, setVaStatus] =
    useState<"idle" | "running" | "done" | "failed">("idle");

  const [activeTab, setActiveTab] = useState<ActiveTab>("unsupervised");

  const [form, setForm] = useState({
    source: "",
    target: "",
    amount: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const sendTransaction = async () => {
    //  Validate first
    if (!form.source || !form.target || !form.amount) {
      alert("Source, Target and Amount are required");
      return;
    }

    setLoading(true);
    setResult(null);
    setVaEvents([]);
    setVaStatus("idle");

    const transactionData = {
      sourceAccount: form.source,
      targetAccount: form.target,
      amount: Number(form.amount),
    };

    try {
      // ================= TRANSACTION (POST to Java -> Python) =================
      const txResponse = await fetch("http://localhost:8080/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });

      if (!txResponse.ok) {
        throw new Error("Transaction API failed");
      }

      let txData: any = null;
      const contentType = txResponse.headers.get("content-type");

      if (contentType?.includes("application/json")) {
        txData = await txResponse.json();
      }

      // 🛡️ MUSKAN'S DATA MAPPING (Connecting Real Backend Data)
      setResult({
         // 🧬 Feature Engineering
         features: {
           before: { out_degree: "N/A", risk_ratio: "N/A" }, 
           after: { 
             out_degree: txData.outDegree !== undefined ? txData.outDegree : 0,  
             risk_ratio: txData.riskRatio !== undefined ? txData.riskRatio.toFixed(2) : "0.00" 
           },
           populationSize: txData.populationSize || "Unknown"
         },
         // 🔗 JA3 / Device
         correlation: {
           ja3Detected: txData.ja3Detected || false,
           linkedAccounts: txData.linkedAccounts || [] 
         },
         // 🟠 Behavioral (Mocked/Simulated)
         unsupervised: {
           model: txData.unsupervisedModelName || "Isolation Forest",
           score: txData.unsupervisedScore ? txData.unsupervisedScore.toFixed(4) : "0.0000",
           isAnomalous: (txData.unsupervisedScore || 0) > 0.5
         },
         // 🚨 Final Verdict
         final: {
           riskLevel: txData.verdict || "Analyzing...", 
           confidence: ((txData.riskScore || 0) * 100).toFixed(1) + "%",
           isHighRisk: (txData.riskScore || 0) > 0.5
         }
      });

      const transactionId =
        txData?.id ?? `local-${Date.now()}`; 

      // ================= VISUAL ANALYTICS SSE (Rupali's Part) =================
      setVaStatus("running");
      
      // Default behavior: Stay on Unsupervised to show graph, 
      // User clicks "Supervised" to see your Red Cards.
      setActiveTab("unsupervised"); 

      const es = new EventSource(
        `http://127.0.0.1:8000/visual-analytics/api/visual/stream/unsupervised?transactionId=${transactionId}&nodeId=${form.source}`
      );

      // Generic handler
      const handleEvent = (event: MessageEvent) => {
        const parsed = JSON.parse(event.data);
        setVaEvents(prev => [...prev, {
          stage: event.type,
          data: parsed
        }]);
      };

      // Listen to ALL pipeline events
      [
        "population_loaded",
        "scoring_started",
        "eif_result",
        "shap_started",
        "shap_completed",
        "shap_skipped",
      ].forEach(stage => {
        es.addEventListener(stage, handleEvent);
      });

      // FINAL EVENT
      es.addEventListener("unsupervised_completed", (event) => {
        const parsed = JSON.parse(event.data);
        setVaEvents(prev => [...prev, {
          stage: "unsupervised_completed",
          data: parsed
        }]);

        setVaStatus("done");   
        es.close();
      });

      // FAILURE
      es.onerror = () => {
        console.error("Visual Analytics SSE connection closed");
        setVaStatus(prev =>
          prev === "done" ? "done" : "failed"
        );
        es.close();
      };

    } catch (err) {
      console.error(err);
      alert("Transaction failed. Check backend logs.");
      setVaStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <Navbar />

      <main className="flex-1 overflow-hidden p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          {/* LEFT */}
          <div className="border border-gray-800 rounded-2xl p-6 bg-[#0A0A0A]">
            <h2 className="text-xl font-bold mb-6">
              Fake Transaction (Graph Edge)
            </h2>

            <div className="flex flex-col gap-4">
              <input
                name="source"
                placeholder="Source Account ID"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700 focus:border-[#caff33] outline-none transition"
                onChange={handleChange}
              />
              <input
                name="target"
                placeholder="Target Account ID"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700 focus:border-[#caff33] outline-none transition"
                onChange={handleChange}
              />
              <input
                name="amount"
                type="number"
                placeholder="Amount (₹)"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700 focus:border-[#caff33] outline-none transition"
                onChange={handleChange}
              />

              <button
                onClick={sendTransaction}
                disabled={loading}
                className="mt-4 bg-[#caff33] hover:bg-[#b8e62e] transition text-black p-3 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Send Transaction"}
              </button>
            </div>
          </div>

          {/* RIGHT */}
          <div className="border border-gray-800 rounded-2xl p-6 bg-[#0A0A0A] flex flex-col">
            <h2 className="text-xl font-bold mb-4">
              Investigation Dashboard
            </h2>

            {/* TABS */}
            <div className="flex gap-2 mb-4">
              {[
                ["unsupervised", "🟠 Unsupervised", "bg-orange-500"],
                ["ja3", "🔗 JA3 Fingerprinting", "bg-red-500"],
                ["supervised", "🔵 Supervised", "bg-blue-500"],
              ].map(([key, label, color]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as ActiveTab)}
                  className={`px-3 py-1 rounded-lg text-sm font-semibold transition ${
                    activeTab === key
                      ? `${color} text-black`
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* CONTENT */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              
              {/* TAB 1: RUPALI'S PART */}
              {activeTab === "unsupervised" && (
                <VisualAnalyticsCard
                  vaStatus={vaStatus}
                  vaEvents={vaEvents}
                />
              )}

              {/* TAB 2: JA3 */}
              {activeTab === "ja3" && (
                <div className="p-4 bg-gray-900 rounded-xl border border-gray-800 animate-in fade-in">
                   <h3 className="font-semibold mb-2 text-red-400">
                      🔗 Device & Pattern Correlation
                   </h3>
                   {!result ? (
                      <p className="text-gray-500 italic">No transaction data yet.</p>
                   ) : !result.correlation.ja3Detected ? (
                      <p className="text-sm text-gray-400">
                        No shared device fingerprint or coordinated activity detected.
                      </p>
                   ) : (
                      <>
                        <p className="text-sm text-gray-300">
                          Shared device fingerprint detected across accounts:
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-300 mt-2">
                          {result.correlation.linkedAccounts.map((a: string, i: number) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </>
                   )}
                </div>
              )}

              {/* TAB 3: SUPERVISED (YOUR PART - Cleaned Up) */}
              {activeTab === "supervised" && (
                <>
                  {!result ? (
                     <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-800 rounded-xl">
                       <p className="text-gray-500 italic">
                         Submit a transaction to trigger Supervised Analysis
                       </p>
                     </div>
                  ) : (
                    <div className="space-y-4">
                      
                      {/* 🚨 CARD 1: FINAL DECISION (TOP PRIORITY) */}
                      <div className="p-4 bg-gray-900 rounded-xl border border-gray-800 animate-in fade-in slide-in-from-bottom-2">
                        <h3 className="font-semibold mb-2 text-white">
                          🚨 Final Risk Assessment
                        </h3>
                        <div className="text-lg text-gray-300">
                          Verdict:{" "}
                          <span className={`font-black text-xl ${result.final.isHighRisk ? "text-red-500" : "text-green-500"}`}>
                            {result.final.riskLevel.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          Confidence: {result.final.confidence}
                        </div>
                      </div>

                      {/* 🧬 CARD 2: Feature Engineering */}
                      <div className="p-4 bg-gray-900 rounded-xl border border-gray-800 animate-in fade-in slide-in-from-bottom-3">
                        <h3 className="font-semibold mb-2 text-[#caff33]">
                          🧬 Feature Engineering
                        </h3>
                        <p className="text-sm text-gray-400 mb-2">
                          Graph-based features constructed for this account
                        </p>
                        <div className="text-xs text-gray-300 space-y-1">
                          <div>Out-degree: {result.features.before.out_degree} → <span className="text-white font-bold">{result.features.after.out_degree}</span></div>
                          <div>Risk Ratio: {result.features.before.risk_ratio} → <span className="text-white font-bold">{result.features.after.risk_ratio}</span></div>
                          <div>Compared against {result.features.populationSize} accounts</div>
                        </div>
                      </div>

                       {/* 🟠 CARD 3: Model Details */}
                      <div className="p-4 bg-gray-900 rounded-xl border border-gray-800 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="font-semibold mb-2 text-orange-400">
                          🟠 Behavioral Anomaly Detection
                        </h3>
                        <p className="text-sm text-gray-400">
                          Model: {result.unsupervised.model}
                        </p>
                        <div className="mt-2 text-sm">
                          Anomaly Score: <span className="font-bold">{result.unsupervised.score}</span>
                        </div>
                        <div className={`mt-1 text-sm font-semibold ${
                          result.unsupervised.isAnomalous
                            ? "text-red-500"
                            : "text-green-400"
                        }`}>
                          {result.unsupervised.isAnomalous
                            ? "Anomalous Behavior Detected"
                            : "Behavior Within Normal Range"}
                        </div>
                      </div>
                      
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="shrink-0">
        <Footer />
      </footer>
    </div>
  );
}