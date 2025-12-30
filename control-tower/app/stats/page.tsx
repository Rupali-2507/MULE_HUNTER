"use client";

import React from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Activity, ShieldAlert, RefreshCw, Hammer, Zap, TrendingUp, Info, Cpu, Gauge, Layers } from "lucide-react";

export default function StatsPage() {
  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      {/* PSEUDO PAGE WARNING BANNER */}
      <div className="bg-[#CAFF33]/10 border-b border-[#CAFF33]/20 py-2 flex justify-center items-center gap-2">
        <Info className="w-3 h-3 text-[#CAFF33]" />
        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#CAFF33]">
          Simulation Mode Active: Displaying Synthetic Network Metrics for Demonstration
        </span>
      </div>

      <Navbar />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-6 md:px-10 py-12">
        
        {/* TOP LEVEL METRICS (PRIMARY KPIs) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
          <StatCard 
            icon={<Zap className="text-[#CAFF33] w-5 h-5" />} 
            label="Throughput" 
            value="14,208" 
            unit="TPS" 
            subValue="+12% vs last hour" 
          />
          <StatCard 
            icon={<Gauge className="text-[#CAFF33] w-5 h-5" />} 
            label="Avg Detection Latency" 
            value="140" 
            unit="ms" 
            subValue="Real-time Interception" 
          />
          <StatCard 
            icon={<ShieldAlert className="text-red-500 w-5 h-5" />} 
            label="Mule Accounts Blocked" 
            value="3,842" 
            unit="Total" 
            subValue="89 detected today" 
          />
          <StatCard 
            icon={<Layers className="text-blue-400 w-5 h-5" />} 
            label="System Scalability" 
            value="12.5M" 
            unit="TX/Day" 
            subValue="Peak Capacity: 25M" 
          />
        </div>

        {/* DETAILED SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-32 items-start">
          
          {/* Left Side: Performance & Analytics */}
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-2 uppercase tracking-tight">
                Network <span className="text-[#CAFF33]">Performance KPIs</span>
              </h2>
              <p className="text-sm text-gray-500">Detailed analysis of detection accuracy, system latency, and transaction scalability.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {/* Action Distribution */}
              <div className="border border-gray-900 p-6 rounded-3xl bg-[#050505]">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest">Enforcement Distribution</h3>
                <div className="space-y-4">
                  <ProgressBar label="Accounts Frozen" percentage={65} color="bg-[#CAFF33]" />
                  <ProgressBar label="Flagged for Review" percentage={22} color="bg-yellow-500" />
                  <ProgressBar label="Police Referrals" percentage={13} color="bg-red-500" />
                </div>
              </div>

              {/* Accuracy KPI Card */}
              <div className="border border-gray-900 p-6 rounded-3xl bg-[#050505] flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="text-[#CAFF33] w-4 h-4" />
                  <span className="text-xs font-bold uppercase text-gray-400">Detection Accuracy</span>
                </div>
                <div className="text-4xl font-bold">99.4%</div>
                <div className="text-[10px] text-gray-600 mt-2 uppercase tracking-tighter">
                   Target Variance: &lt; 0.5% | False Positive Rate: 0.02%
                </div>
              </div>
            </div>

            {/* Performance Logs */}
            <div className="border border-gray-900 rounded-3xl overflow-hidden bg-[#0A0A0A]">
              <div className="p-4 border-b border-gray-900 bg-gray-900/20 text-xs font-bold uppercase tracking-wider flex justify-between">
                <span>Live Scalability Monitor</span>
                <span className="text-[#CAFF33] animate-pulse">Processing 1M+ Clusters</span>
              </div>
              <div className="p-4 space-y-3">
                <LogItem time="14:02:11" msg="Circular flow detected - 142ms latency" node="ID_0421" risk="CRITICAL" />
                <LogItem time="13:58:45" msg="Mule ring path analysis complete" node="ID_8821" risk="HIGH" />
                <LogItem time="13:55:02" msg="Scalability stress test: 2.1M tx/hr" node="SYSTEM" risk="STABLE" />
              </div>
            </div>
          </div>

          {/* Right Side: KPI Summary List */}
          <div className="flex flex-col gap-6">
            <div className="border border-gray-900 p-8 rounded-3xl bg-[#0A0A0A] flex flex-col gap-6 shadow-2xl relative overflow-hidden">
               {/* Decorative Background Icon */}
              <Cpu className="absolute -right-8 -top-8 w-32 h-32 text-gray-800 opacity-20" />
              
              <h3 className="text-lg font-bold flex items-center gap-2 relative z-10">
                <Activity className="text-[#CAFF33] w-5 h-5" /> Operational Summary
              </h3>
              
              <div className="space-y-6 relative z-10">
                <MetricRow label="Value Intercepted" value="₹4.2 Cr" />
                <MetricRow label="Avg Detection Latency" value="140ms" />
                <MetricRow label="False Positive Rate" value="0.02%" />
                <MetricRow label="Millions of Transactions" value="2.4M" />
                <MetricRow label="Max Scalability" value="25M/Day" />
              </div>

              <div className="mt-4 p-4 bg-[#CAFF33]/10 border border-[#CAFF33]/20 rounded-2xl relative z-10">
                <p className="text-[11px] text-[#CAFF33] leading-relaxed italic">
                  "KPIs calculated across multi-node clusters demonstrating horizontal scalability for national-level transaction volumes."
                </p>
              </div>
              
              <button className="w-full py-3 bg-[#CAFF33] hover:bg-[#b8e62e] text-black font-bold rounded-2xl text-xs transition-all uppercase tracking-widest relative z-10">
                Download Performance Audit
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function LogItem({ time, msg, node, risk }: any) {
  const riskColor = 
    risk === "CRITICAL" ? "text-red-500" : 
    risk === "HIGH" ? "text-orange-500" : 
    risk === "STABLE" ? "text-[#CAFF33]" : "text-yellow-500";
    
  return (
    <div className="flex justify-between items-center text-[11px] border-b border-gray-900 pb-2 last:border-0">
      <div className="flex gap-3">
        <span className="text-gray-700 font-mono">{time}</span>
        <span className="text-gray-300">{msg}</span>
      </div>
      <div className="flex gap-3 items-center">
        <span className="bg-gray-900 px-2 py-0.5 rounded text-gray-500">{node}</span>
        <span className={`font-bold ${riskColor}`}>{risk}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center border-b border-gray-900 pb-3 last:border-0">
      <span className="text-xs text-gray-500 uppercase font-bold tracking-tighter">{label}</span>
      <span className="text-lg font-bold text-gray-200">{value}</span>
    </div>
  );
}

function StatCard({ icon, label, value, unit, subValue }: any) {
  return (
    <div className="border border-gray-900 p-6 rounded-3xl bg-[#0A0A0A] flex flex-col gap-2 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-[10px] text-gray-600 font-bold uppercase">{unit}</span>
      </div>
      <div className="text-[10px] text-[#CAFF33] font-mono">{subValue}</div>
    </div>
  );
}

function ProgressBar({ label, percentage, color }: any) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
        <span>{label}</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-900 h-1.5 rounded-full overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all duration-1000`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}