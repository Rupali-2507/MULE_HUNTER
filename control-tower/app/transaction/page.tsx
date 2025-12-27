"use client";

import { useState } from "react";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import VisualAnalyticsCard from "../components/VisualAnalyticsCard";

type ActiveTab = "unsupervised" | "ja3" | "supervised";

export default function FakeTransactionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

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
      // ================= TRANSACTION =================
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

      const transactionId =
        txData?.id ?? `local-${Date.now()}`; //  SAFE FALLBACK

      setResult({
        risk_score: txData?.riskScore ?? null,
        reasons: [txData?.verdict ?? "Transaction stored"],
      });

      // ================= VISUAL ANALYTICS SSE =================
      setVaStatus("running");
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

      // FINAL EVENT (IMPORTANT)
      es.addEventListener("unsupervised_completed", (event) => {
        const parsed = JSON.parse(event.data);
        setVaEvents(prev => [...prev, {
          stage: "unsupervised_completed",
          data: parsed
        }]);

        setVaStatus("done");   
        es.close();
      });

      // REAL FAILURE ONLY
      es.onerror = () => {
        console.error("Visual Analytics SSE connection closed");

        //  DO NOT mark failed if already done
        setVaStatus(prev =>
          prev === "done" ? "done" : "failed"
        );

        es.close();
      };


       

     

      es.onerror = () => {
        console.error("Visual Analytics SSE error");
        setVaStatus("failed");
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
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
                onChange={handleChange}
              />
              <input
                name="target"
                placeholder="Target Account ID"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
                onChange={handleChange}
              />
              <input
                name="amount"
                type="number"
                placeholder="Amount (₹)"
                className="bg-gray-900 p-3 rounded-lg border border-gray-700"
                onChange={handleChange}
              />

              <button
                onClick={sendTransaction}
                disabled={loading}
                className="mt-4 bg-[#caff33] text-black p-3 rounded-xl font-bold disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Send Transaction"}
              </button>
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
                  className={`px-3 py-1 rounded-lg text-sm font-semibold ${
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
            <div className="flex-1 overflow-y-auto">
              {activeTab === "unsupervised" && (
                <VisualAnalyticsCard
                  vaStatus={vaStatus}
                  vaEvents={vaEvents}
                />
              )}

              {activeTab === "ja3" && (
                <div className="text-gray-400 italic">
                  JA3 analysis not enabled in demo
                </div>
              )}

              {activeTab === "supervised" && (
                <div className="text-gray-400 italic">
                  Supervised model not enabled in demo
                </div>
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
