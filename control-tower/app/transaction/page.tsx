"use client";

import { useState, useEffect } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import VisualAnalyticsCard from "../components/VisualAnalyticsCard";

type ActiveTab = "unsupervised" | "ja3" | "supervised";

interface AISystemStatus {
  status: string;
  model_loaded: boolean;
  nodes_count: number;
  version: string;
}

export default function FakeTransactionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [vaEvents, setVaEvents] = useState<any[]>([]);
  const [vaStatus, setVaStatus] =
    useState<"idle" | "running" | "done" | "failed">("idle");

  const [activeTab, setActiveTab] = useState<ActiveTab>("unsupervised");
  
  // AI System Health Monitoring
  const [aiHealth, setAiHealth] = useState<AISystemStatus | null>(null);
  const [aiChecking, setAiChecking] = useState(true);

  const [form, setForm] = useState({
    source: "",
    target: "",
    amount: "",
  });

  // Check AI System Health on Mount
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const checkAiHealth = async () => {
      try {
        const response = await fetch("http://13.60.91.248:8082/api/health/ai");
        const data = await response.json();
        setAiHealth(data);
        setAiChecking(false);
        
        // Stop polling once healthy
        if (data.status === "HEALTHY" && data.model_loaded) {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("AI Health check failed:", error);
        setAiHealth(null);
        // Keep checking...
      }
    };

    // Initial check
    checkAiHealth();
    
    // Poll every 2 seconds until ready
    pollInterval = setInterval(checkAiHealth, 2000);

    return () => clearInterval(pollInterval);
  }, []);

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const sendTransaction = async () => {
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
      const txResponse = await fetch("http://13.60.91.248:8082/api/transactions", {
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

      setResult({
         features: {
           before: { out_degree: "N/A", risk_ratio: "N/A" }, 
           after: { 
             out_degree: txData.outDegree !== undefined ? txData.outDegree : 0,  
             risk_ratio: txData.riskRatio !== undefined ? txData.riskRatio.toFixed(2) : "0.00" 
           },
           populationSize: txData.populationSize || "Unknown"
         },
         correlation: {
           ja3Detected: txData.ja3Detected || false,
           linkedAccounts: txData.linkedAccounts || [] 
         },
         unsupervised: {
           model: txData.unsupervisedModelName || "Isolation Forest",
           score: txData.unsupervisedScore ? txData.unsupervisedScore.toFixed(4) : "0.0000",
           isAnomalous: (txData.unsupervisedScore || 0) > 0.5
         },
         final: {
           riskLevel: txData.verdict || "Analyzing...", 
           confidence: ((txData.riskScore || 0) * 100).toFixed(1) + "%",
           isHighRisk: (txData.riskScore || 0) > 0.5
         }
      });

      const transactionId = txData?.id ?? `local-${Date.now()}`; 

      setVaStatus("running");
      setActiveTab("unsupervised"); 

      const es = new EventSource(
        `http://127.0.0.1:8000/visual-analytics/api/visual/stream/unsupervised?transactionId=${transactionId}&nodeId=${form.source}`
      );

      const handleEvent = (event: MessageEvent) => {
        const parsed = JSON.parse(event.data);
        setVaEvents(prev => [...prev, {
          stage: event.type,
          data: parsed
        }]);
      };

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

      es.addEventListener("unsupervised_completed", (event) => {
        const parsed = JSON.parse(event.data);
        setVaEvents(prev => [...prev, {
          stage: "unsupervised_completed",
          data: parsed
        }]);

        setVaStatus("done");   
        es.close();
      });

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
    <div className="flex flex-col min-h-screen bg-black text-white">
      <Navbar />

      {/* AI SYSTEM STATUS BANNER */}
      <div className="px-6 lg:px-8 pt-6">
        {aiChecking ? (
          <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 border border-yellow-700/50 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-ping"></div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-yellow-400">
                  🔍 Checking AI System Status...
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Connecting to MuleSAGE Neural Network
                </div>
              </div>
            </div>
          </div>
        ) : aiHealth?.status === "HEALTHY" && aiHealth.model_loaded ? (
          <div className="bg-gradient-to-r from-green-900/20 to-emerald-900/20 border border-green-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-green-400">
                  ✅ AI System Ready
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {aiHealth.version} • {aiHealth.nodes_count.toLocaleString()} nodes loaded • Model active
                </div>
              </div>
              <div className="text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded-full font-mono">
                ONLINE
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-400">
                  🧠 AI System Initializing...
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {aiHealth?.model_loaded === false 
                    ? "Training neural network (this may take 30-60 seconds on first run)"
                    : "Loading model weights and graph topology"}
                </div>
              </div>
              <div className="flex gap-1">
                <div className="w-1.5 h-4 bg-blue-500 rounded animate-pulse" style={{animationDelay: '0ms'}}></div>
                <div className="w-1.5 h-4 bg-blue-500 rounded animate-pulse" style={{animationDelay: '150ms'}}></div>
                <div className="w-1.5 h-4 bg-blue-500 rounded animate-pulse" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 p-6 lg:p-8">
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
                disabled={!aiHealth?.model_loaded}
              />
              <input
                name="target"
                placeholder="Target Account ID"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700 focus:border-[#caff33] outline-none transition"
                onChange={handleChange}
                disabled={!aiHealth?.model_loaded}
              />
              <input
                name="amount"
                type="number"
                placeholder="Amount (₹)"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700 focus:border-[#caff33] outline-none transition"
                onChange={handleChange}
                disabled={!aiHealth?.model_loaded}
              />

              <button
                onClick={sendTransaction}
                disabled={loading || !aiHealth?.model_loaded}
                className="mt-4 bg-[#caff33] hover:bg-[#b8e62e] transition text-black p-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!aiHealth?.model_loaded 
                  ? "⏳ Waiting for AI System..."
                  : loading 
                  ? "Analyzing..." 
                  : "Send Transaction"}
              </button>
              
              {!aiHealth?.model_loaded && (
                <p className="text-xs text-gray-500 text-center">
                  AI system is initializing. Please wait...
                </p>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="border border-gray-800 rounded-2xl p-6 bg-[#0A0A0A] flex flex-col h-[80vh] sticky top-8">
            <h2 className="text-xl font-bold mb-4 shrink-0">
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

              {/* TAB 3: SUPERVISED (YOUR PART) */}
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
                      
                      {/* 🚨 CARD 1: FINAL DECISION */}
                      <div className="p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border-2 border-gray-700 shadow-lg animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-lg text-white flex items-center gap-2">
                            <span className="text-2xl">🚨</span>
                            Final Risk Assessment
                          </h3>
                          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                            {result.final.confidence}
                          </span>
                        </div>
                        <div className="text-center p-4 bg-black/30 rounded-lg">
                          <div className="text-sm text-gray-400 mb-1">Verdict</div>
                          <div className={`text-3xl font-black tracking-tight ${
                            result.final.isHighRisk 
                              ? "text-red-500" 
                              : result.final.riskLevel === "SUSPICIOUS"
                              ? "text-yellow-500"
                              : "text-green-500"
                          }`}>
                            {result.final.riskLevel.toUpperCase()}
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-gray-400 text-center">
                          Model: {result.unsupervised.model}
                        </div>
                      </div>

                      {/* 🧬 CARD 2: Feature Engineering */}
                      <div className="p-5 bg-gray-900 rounded-xl border border-gray-700 animate-in fade-in slide-in-from-bottom-3">
                        <h3 className="font-semibold mb-3 text-[#caff33] flex items-center gap-2">
                          <span>🧬</span>
                          Graph-Based Feature Engineering
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-black/40 p-3 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Out-Degree</div>
                            <div className="text-2xl font-bold text-white">
                              {result.features.after.out_degree}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {result.features.after.out_degree > 10 ? "High Activity" : "Normal"}
                            </div>
                          </div>
                          
                          <div className="bg-black/40 p-3 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1">Risk Ratio</div>
                            <div className="text-2xl font-bold text-white">
                              {result.features.after.risk_ratio}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {parseFloat(result.features.after.risk_ratio) > 1.5 ? "Elevated" : "Balanced"}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-800 text-xs text-gray-400 text-center">
                          Benchmarked against <span className="text-[#caff33] font-semibold">{result.features.populationSize}</span>
                        </div>
                      </div>

                      {/* 🔗 CARD 3: Linked Accounts */}
                      <div className="p-5 bg-gray-900 rounded-xl border border-gray-700 animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="font-semibold mb-3 text-purple-400 flex items-center gap-2">
                          <span>🔗</span>
                          Connected Account Network
                        </h3>
                        {result.correlation.linkedAccounts.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No linked accounts detected</p>
                        ) : (
                          <>
                            <p className="text-xs text-gray-400 mb-2">
                              Found {result.correlation.linkedAccounts.length} connected accounts:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {result.correlation.linkedAccounts.map((acc: string, i: number) => (
                                <span 
                                  key={i}
                                  className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-mono border border-purple-500/30"
                                >
                                  {acc}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                        {result.correlation.ja3Detected && (
                          <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                            ⚠️ Shared device fingerprint detected
                          </div>
                        )}
                      </div>

                      {/* 🟠 CARD 4: Anomaly Detection */}
                      <div className="p-5 bg-gray-900 rounded-xl border border-gray-700 animate-in fade-in slide-in-from-bottom-5">
                        <h3 className="font-semibold mb-3 text-orange-400 flex items-center gap-2">
                          <span>🟠</span>
                          Behavioral Anomaly Detection
                        </h3>
                        
                        <div className="mb-3">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>Anomaly Score</span>
                            <span className="font-mono">{result.unsupervised.score}</span>
                          </div>
                          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                result.unsupervised.isAnomalous 
                                  ? "bg-gradient-to-r from-orange-500 to-red-500" 
                                  : "bg-gradient-to-r from-green-500 to-blue-500"
                              }`}
                              style={{ width: `${Math.min(parseFloat(result.unsupervised.score) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className={`text-center p-3 rounded-lg font-semibold text-sm ${
                          result.unsupervised.isAnomalous
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-green-500/20 text-green-400 border border-green-500/30"
                        }`}>
                          {result.unsupervised.isAnomalous
                            ? "⚠️ Anomalous Behavior Detected"
                            : "✓ Behavior Within Normal Range"}
                        </div>
                      </div>

                      {/* 📊 CARD 5: Raw API Response */}
                      <details className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition font-mono">
                          🔍 View Raw API Response
                        </summary>
                        <pre className="mt-3 p-3 bg-black rounded text-xs text-green-400 overflow-x-auto font-mono">
{JSON.stringify(result, null, 2)}
                        </pre>
                      </details>
                      
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