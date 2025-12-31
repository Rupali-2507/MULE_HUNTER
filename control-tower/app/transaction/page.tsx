"use client";

import { useState, useEffect } from "react";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL!;

if (!BACKEND_BASE_URL) {
  throw new Error("NEXT_PUBLIC_BACKEND_BASE_URL is not defined");
}

type AlertType = "shield" | "brain" | "net" | "safe";
type AlertSeverity = "blocked" | "high" | "medium" | "safe";

interface Alert {
  id: string;
  timestamp: Date;
  layer: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  details: string;
  icon: string;
}

interface AISystemStatus {
  status: string;
  model_loaded: boolean;
  nodes_count: number;
  version: string;
}

export default function TransactionMonitor() {
  const [form, setForm] = useState({ source: "", target: "", amount: "" });
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [result, setResult] = useState<any>(null);
  
  // AI Health
  const [aiHealth, setAiHealth] = useState<AISystemStatus | null>(null);
  const [aiChecking, setAiChecking] = useState(true);

  // Visual Analytics
  const [vaEvents, setVaEvents] = useState<any[]>([]);
  const [vaStatus, setVaStatus] = useState<"idle" | "running" | "done" | "failed">("idle");

  // Check AI System Health
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    
    const checkAiHealth = async () => {
      try {
        const response = await fetch(`${BACKEND_BASE_URL}/api/health/ai`);
        const data = await response.json();
        setAiHealth(data);
        setAiChecking(false);
        
        if (data.status === "HEALTHY" && data.model_loaded) {
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("AI Health check failed:", error);
        setAiHealth(null);
      }
    };

    checkAiHealth();
    pollInterval = setInterval(checkAiHealth, 2000);
    return () => clearInterval(pollInterval);
  }, []);

  const addAlert = (alert: Omit<Alert, "id" | "timestamp">) => {
    setAlerts(prev => [{
      ...alert,
      id: `alert-${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    }, ...prev].slice(0, 20));
  };

  const sendTransaction = async () => {
    if (!form.source || !form.target || !form.amount) {
      alert("Source, Target and Amount are required");
      return;
    }

    setLoading(true);
    setResult(null);
    setAlerts([]); // Clear previous alerts
    setVaEvents([]);
    setVaStatus("idle");

    const transactionData = {
      sourceAccount: form.source,
      targetAccount: form.target,
      amount: Number(form.amount),
    };

    try {
      // Add initial processing alert
      addAlert({
        layer: "System",
        type: "safe",
        severity: "safe",
        title: "Transaction Initiated",
        details: `${form.source} → ${form.target} (₹${form.amount})`,
        icon: "⚡"
      });

      const txResponse = await fetch(`${BACKEND_BASE_URL}/api/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transactionData),
      });

      if (!txResponse.ok) throw new Error("Transaction API failed");

      const contentType = txResponse.headers.get("content-type");
      let txData: any = null;

      if (contentType?.includes("application/json")) {
        txData = await txResponse.json();
      }

      // Store complete result for detailed view
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
          riskScore: txData.riskScore || 0,
          isHighRisk: (txData.riskScore || 0) > 0.5
        }
      });

      // Generate defense layer alerts
      // LAYER 1: JA3 Shield
      if (txData.ja3Detected) {
        addAlert({
          layer: "Layer 1: JA3 Shield",
          type: "shield",
          severity: "blocked",
          title: "Bot Signature Detected",
          details: `Shared device fingerprint across ${txData.linkedAccounts?.length || 0} accounts`,
          icon: "🛡️"
        });
      } else {
        addAlert({
          layer: "Layer 1: JA3 Shield",
          type: "shield",
          severity: "safe",
          title: "Device Fingerprint Valid",
          details: "No suspicious TLS patterns detected",
          icon: "✓"
        });
      }

      // LAYER 2: GNN Brain
      const isHighRisk = (txData.riskScore || 0) > 0.5;
      if (isHighRisk) {
        addAlert({
          layer: "Layer 2: GNN Brain",
          type: "brain",
          severity: "high",
          title: "Fraud Topology Detected",
          details: `Risk Score: ${((txData.riskScore || 0) * 100).toFixed(1)}% | Verdict: ${txData.verdict}`,
          icon: "🧠"
        });
      } else {
        addAlert({
          layer: "Layer 2: GNN Brain",
          type: "brain",
          severity: "safe",
          title: "Graph Pattern Normal",
          details: `Risk Score: ${((txData.riskScore || 0) * 100).toFixed(1)}%`,
          icon: "✓"
        });
      }

      // LAYER 3: EIF Safety Net
      const isAnomalous = (txData.unsupervisedScore || 0) > 0.5;
      addAlert({
        layer: "Layer 3: EIF Safety Net",
        type: "net",
        severity: isAnomalous ? "medium" : "safe",
        title: isAnomalous ? "Behavioral Anomaly" : "Behavior Normal",
        details: `Anomaly Score: ${txData.unsupervisedScore?.toFixed(4) || "0.0000"}`,
        icon: isAnomalous ? "⚠️" : "✓"
      });

      // Start Visual Analytics Stream
      const transactionId = txData?.id ?? `local-${Date.now()}`;
      setVaStatus("running");

      const es = new EventSource(
        `${BACKEND_BASE_URL}/api/visual/stream/unsupervised` +
        `?transactionId=${transactionId}&nodeId=${form.source}`
      );

      es.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setVaEvents(prev => [...prev, { stage: "message", data: parsed }]);
        } catch (e) {
          console.error("Invalid SSE payload:", event.data);
        }
      };

      const handleEvent = (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data);
          setVaEvents(prev => [...prev, { stage: event.type, data: parsed }]);
        } catch (e) {
          console.error("Invalid SSE payload:", event.data);
        }
      };

      ["population_loaded", "scoring_started", "eif_result", "shap_started", 
       "shap_completed", "shap_skipped"].forEach(stage => {
        es.addEventListener(stage, handleEvent);
      });

      es.addEventListener("unsupervised_completed", (event) => {
        const parsed = JSON.parse(event.data);
        setVaEvents(prev => [...prev, { stage: "unsupervised_completed", data: parsed }]);
        setVaStatus("done");
        es.close();
      });

      es.onerror = () => {
        console.error("Visual Analytics SSE connection closed");
        setVaStatus(prev => prev === "done" ? "done" : "failed");
        es.close();
      };

    } catch (err) {
      console.error(err);
      alert("Transaction failed. Check backend logs.");
      setVaStatus("failed");
      
      addAlert({
        layer: "System",
        type: "shield",
        severity: "blocked",
        title: "Processing Error",
        details: "Backend connection failed",
        icon: "❌"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case "blocked": return "from-red-600 to-red-700 border-red-500";
      case "high": return "from-orange-600 to-orange-700 border-orange-500";
      case "medium": return "from-yellow-600 to-yellow-700 border-yellow-500";
      case "safe": return "from-green-600 to-green-700 border-green-500";
    }
  };

  const getSeverityText = (severity: AlertSeverity) => {
    switch (severity) {
      case "blocked": return "text-red-300";
      case "high": return "text-orange-300";
      case "medium": return "text-yellow-300";
      case "safe": return "text-green-300";
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="text-4xl">🎯</span>
          <span className="bg-gradient-to-r from-lime-400 to-emerald-400 text-transparent bg-clip-text">
            MULE HUNTER
          </span>
        </h1>
        <p className="text-gray-400">Real-Time Transaction Monitoring • Defense in Depth</p>
      </div>

      {/* AI Status Banner */}
      <div className="mb-6">
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
                    ? "Training neural network (30-60 seconds)"
                    : "Loading model weights and graph topology"}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* LEFT: Transaction Input */}
        <div className="lg:col-span-1">
          <div className="border border-gray-800 rounded-2xl p-6 bg-gradient-to-br from-gray-900 to-black sticky top-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span>📤</span>
              Create Transaction
            </h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Source Account</label>
                <input
                  name="source"
                  placeholder="e.g., 50"
                  value={form.source}
                  onChange={(e) => setForm({...form, source: e.target.value})}
                  disabled={!aiHealth?.model_loaded}
                  className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:border-lime-400 outline-none transition disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Target Account</label>
                <input
                  name="target"
                  placeholder="e.g., 100"
                  value={form.target}
                  onChange={(e) => setForm({...form, target: e.target.value})}
                  disabled={!aiHealth?.model_loaded}
                  className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:border-lime-400 outline-none transition disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-2 block">Amount (₹)</label>
                <input
                  name="amount"
                  type="number"
                  placeholder="e.g., 5000"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                  disabled={!aiHealth?.model_loaded}
                  className="w-full bg-gray-800 p-3 rounded-lg border border-gray-700 focus:border-lime-400 outline-none transition disabled:opacity-50"
                />
              </div>

              <button
                onClick={sendTransaction}
                disabled={loading || !aiHealth?.model_loaded}
                className="w-full mt-6 bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-500 hover:to-emerald-600 transition text-black p-4 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-lime-500/20"
              >
                {!aiHealth?.model_loaded 
                  ? "⏳ Waiting for AI..."
                  : loading 
                  ? "🔍 Analyzing..." 
                  : "🚀 Send Transaction"}
              </button>
              
              {!aiHealth?.model_loaded && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  AI system is initializing...
                </p>
              )}
            </div>

            {/* Visual Analytics Status */}
            {vaStatus !== "idle" && (
              <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="text-sm font-semibold text-purple-300 mb-2">
                  🔬 Visual Analytics
                </div>
                <div className="text-xs text-gray-400">
                  Status: <span className="text-purple-400 font-mono">{vaStatus.toUpperCase()}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Events: <span className="text-purple-400 font-mono">{vaEvents.length}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Alert Feed + Detailed Analysis */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Live Threat Detection Feed */}
          <div className="border border-gray-800 rounded-2xl p-6 bg-gradient-to-br from-gray-900 to-black">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>🚨</span>
                Live Threat Detection
              </h2>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Monitoring Active</span>
              </div>
            </div>

            {/* Defense Architecture Overview */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/30 rounded-lg p-3">
                <div className="text-2xl mb-1">🛡️</div>
                <div className="text-xs font-semibold text-red-400">Layer 1: Shield</div>
                <div className="text-xs text-gray-500">JA3 Fingerprinting</div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-lg p-3">
                <div className="text-2xl mb-1">🧠</div>
                <div className="text-xs font-semibold text-blue-400">Layer 2: Brain</div>
                <div className="text-xs text-gray-500">Graph Neural Network</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/30 rounded-lg p-3">
                <div className="text-2xl mb-1">🕸️</div>
                <div className="text-xs font-semibold text-orange-400">Layer 3: Net</div>
                <div className="text-xs text-gray-500">Isolation Forest</div>
              </div>
            </div>

            {/* Alert Feed */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {alerts.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-xl">
                  <div className="text-6xl mb-4 opacity-20">🎯</div>
                  <p className="text-gray-500 text-center">
                    Submit a transaction to see<br />real-time threat detection
                  </p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id}
                    className={`bg-gradient-to-r ${getSeverityColor(alert.severity)} border rounded-xl p-4 animate-in fade-in slide-in-from-right-5 shadow-lg`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{alert.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-white/60">
                            {alert.timestamp.toLocaleTimeString()}
                          </span>
                          <span className="text-xs font-semibold text-white/80">
                            {alert.layer}
                          </span>
                        </div>
                        <div className={`font-bold ${getSeverityText(alert.severity)} mb-1`}>
                          {alert.title}
                        </div>
                        <div className="text-sm text-white/70">
                          {alert.details}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Detailed Analysis Cards (From Old Design) */}
          {result && (
            <div className="border border-gray-800 rounded-2xl p-6 bg-gradient-to-br from-gray-900 to-black">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>📊</span>
                Detailed Forensic Analysis
              </h3>
              
              <div className="space-y-4">
                
                {/* 🚨 CARD 1: FINAL DECISION */}
                <div className="p-5 bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl border-2 border-gray-700 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-lg text-white flex items-center gap-2">
                      <span className="text-2xl">🚨</span>
                      Final Risk Assessment
                    </h4>
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
                <div className="p-5 bg-gray-800 rounded-xl border border-gray-700">
                  <h4 className="font-semibold mb-3 text-[#caff33] flex items-center gap-2">
                    <span>🧬</span>
                    Graph-Based Feature Engineering
                  </h4>
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
                  <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400 text-center">
                    Benchmarked against <span className="text-[#caff33] font-semibold">{result.features.populationSize}</span>
                  </div>
                </div>

                {/* 🔗 CARD 3: Linked Accounts */}
                <div className="p-5 bg-gray-800 rounded-xl border border-gray-700">
                  <h4 className="font-semibold mb-3 text-purple-400 flex items-center gap-2">
                    <span>🔗</span>
                    Connected Account Network
                  </h4>
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
                <div className="p-5 bg-gray-800 rounded-xl border border-gray-700">
                  <h4 className="font-semibold mb-3 text-orange-400 flex items-center gap-2">
                    <span>🟠</span>
                    Behavioral Anomaly Detection
                  </h4>
                  
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Anomaly Score</span>
                      <span className="font-mono">{result.unsupervised.score}</span>
                    </div>
                    <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
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
                <details className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300 transition font-mono">
                    🔍 View Raw API Response
                  </summary>
                  <pre className="mt-3 p-3 bg-black rounded text-xs text-green-400 overflow-x-auto font-mono">
{JSON.stringify(result, null, 2)}
                  </pre>
                </details>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}