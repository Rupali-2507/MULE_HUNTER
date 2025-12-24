"use client";

import { useState } from "react";

export default function FakeTransactionPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [form, setForm] = useState({
    source: "",
    target: "",
    amount: "",
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const sendTransaction = async () => {
    setLoading(true);
    setResult(null);

    const payload = {
      source: form.source,
      target: form.target,
      amount: Number(form.amount),
      timestamp: Date.now(),
    };

    try {
      // 1️⃣ Send transaction (graph edge)
      await fetch("http://localhost:8080/api/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // 2️⃣ Fetch AI decision for source node
      const res = await fetch(
        `/backend/api/risk-scores/${form.source}`
      );
      const data = await res.json();

      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 min-h-screen bg-black text-white">

      {/* LEFT PANEL */}
      <div className="border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6">
          Fake Transaction (Graph Edge)
        </h2>

        <div className="flex flex-col gap-4">
          <input
            name="source"
            placeholder="Source Account ID"
            className="bg-gray-900 p-3 rounded-lg"
            onChange={handleChange}
          />

          <input
            name="target"
            placeholder="Target Account ID"
            className="bg-gray-900 p-3 rounded-lg"
            onChange={handleChange}
          />

          <input
            name="amount"
            type="number"
            placeholder="Amount (₹)"
            className="bg-gray-900 p-3 rounded-lg"
            onChange={handleChange}
          />

          <div className="text-xs text-gray-500">
            Timestamp will be auto-generated
          </div>

          <button
            onClick={sendTransaction}
            disabled={loading}
            className="mt-4 bg-red-600 hover:bg-red-700 transition p-3 rounded-xl font-semibold"
          >
            {loading ? "Analyzing..." : "Send Transaction"}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="border border-gray-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-6">
          AI Decision Panel
        </h2>

        {!result && (
          <p className="text-gray-500">
            Submit a transaction to trigger AI analysis
          </p>
        )}

        {result && (
          <div className="flex flex-col gap-6">
            <div className="p-4 bg-gray-900 rounded-xl">
              <div className="text-sm text-gray-400">Risk Score</div>
              <div className="text-3xl font-bold text-red-500">
                {result.risk_score}
              </div>
            </div>

            <div className="p-4 bg-gray-900 rounded-xl">
              <div className="text-sm text-gray-400 mb-2">
                Why flagged?
              </div>
              <ul className="list-disc list-inside text-sm text-gray-300">
                {result.reasons?.map((r: string, i: number) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
