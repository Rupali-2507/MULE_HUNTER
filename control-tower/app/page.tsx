"use client";
import Navbar from "./components/Navbar";
import {Check, Network, AlertTriangle, Brain, UserX, Activity, Lightbulb, ArrowLeftRight, GitBranch, FileSearch} from "lucide-react";
import { IndianRupee, Banknote, Landmark, Wallet, Building2 } from "lucide-react";
import TransactionCard from "./components/TransactionCard";
import GreenIconCircle from "./components/GreenIconCircle";
import CapabilityCard from "./components/CapabilityCard";
import Link from "next/link";
import Footer from "./components/Footer";

export default function Page() {
  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <Navbar />

      {/* HERO SECTION - Using the 1.2 : 0.8 Ratio with large gap */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-48 p-8 lg:h-screen">
          
          {/* Left side content */}
          <div className="flex flex-col justify-center items-start gap-4 pb-10">
            <div className="p-3 bg-gray-900 rounded-3xl flex gap-3 text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-lime-500">
                <Check className="w-3 h-3 text-black" strokeWidth={3} />
              </span>
              <h2 className="flex items-center font-bold">AI-Powered | Real-Time Financial Crime Detection</h2>
            </div>

            <div className="pt-3 text-3xl font-helvitica-neue">
              <h2>Welcome to MuleHunter</h2>
              <h2>Detecting Financial Fraud Before It Spreads</h2>
              <h3 className="text-[#CAFF33]">Fraud Networks</h3>
            </div>

            <div className="text-gray-500 max-w-2xl leading-relaxed">
              MuleHunter is an intelligent fraud detection and visual analytics platform designed to identify mule accounts, collusive transaction rings, and anomalous financial behavior in large-scale payment ecosystems like UPI.
              <br /><br />
              By combining graph analytics, machine learning, and explainable AI, MuleHunter empowers investigators to detect, analyze, and act on financial crime with speed and confidence.
            </div>

            <Link href="/network" target="_blank" rel="noopener noreferrer">
              <button className="bg-[#caff33] hover:bg-[#b8e62e] text-black text-sm p-3 cursor-pointer px-6 rounded-3xl transition-all font-bold">
                Explore Fraud Network
              </button>
            </Link>
          </div>

          {/* Right side content */}
          <div className="flex flex-col justify-center items-center gap-4">
            <div className="border w-full max-w-md flex flex-col gap-3 p-5 border-gray-900 rounded-2xl text-xs bg-[#0A0A0A]">
              <h1 className="text-xs font-bold">Live Fraud Activity</h1>
              <TransactionCard nodeId={1024} risk="HIGH" amount={68000} />
              <TransactionCard nodeId={1871} risk="MEDIUM" amount={41500} />
              <TransactionCard nodeId={449} risk="LOW" amount={2300} />
              
              <h2 className="text-xs font-bold mt-2">Risk Signals</h2>
              <div className="flex flex-col justify-between items-start border-gray-900 border p-3 gap-3 rounded-xl">
                <h3>Detected Indicators</h3>
                <h3 className="text-sm">🔺 High Velocity Transfers</h3>
                <h3 className="text-sm">🔺 Multiple Inbound Sources</h3>
                <h3 className="text-sm">🔺 Circular Transaction Pattern</h3>
              </div>
              <div className="px-4 py-3 bg-[#2f361e] rounded-xl items-center flex justify-center text-[#98b830] font-bold cursor-pointer hover:bg-[#3a4425] transition-all">
                Explain Why This Is Fraud
              </div>
            </div>

            <div className="p-4 border border-gray-900 rounded-3xl flex items-center gap-3 justify-between w-full max-w-md">
              <div className="text-xs text-gray-400">Supported Networks</div>
              <div className="flex gap-2">
                <GreenIconCircle icon={IndianRupee} size="xs" />
                <GreenIconCircle icon={Banknote} size="xs" />
                <GreenIconCircle icon={Landmark} size="xs" />
                <GreenIconCircle icon={Wallet} size="xs" />
                <GreenIconCircle icon={Building2} size="xs" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CORE CAPABILITIES - Balanced Container */}
      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-10 py-20 flex gap-4 flex-col">
        <div>
          <span className="text-2xl font-bold">Core </span>
          <span className="text-2xl font-bold text-[#caff33]">Capabilities</span>
        </div>
        <div className="text-sm text-gray-600 max-w-2xl">
          MuleHunter provides a unified intelligence layer for detecting, analyzing, and explaining financial fraud networks at scale.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 py-8 gap-6">
          <CapabilityCard icon={Network} title="Graph-Based Fraud Detection" points={[
            "Detect mule rings and collusive behavior using transaction graph analysis",
            "Identify hidden communities and circular money flows",
          ]} />
          <CapabilityCard icon={AlertTriangle} title="Anomaly & Risk Scoring" points={[
            "Machine learning models flag high-risk nodes and transactions",
            "Velocity, volume, and behavioral deviation analysis",
          ]} />
          <CapabilityCard icon={Brain} title="Explainable AI (XAI)" points={[
            "SHAP-powered feature attribution",
            "Human-readable AI explanations for investigators and auditors",
          ]} />
        </div>
      </div>

      {/* USE CASES - Restructured for the same ratio feel */}
      <div className="w-full max-w-[1600px] mx-auto px-6 md:px-10 py-20 flex gap-3 flex-col border-t border-gray-900">
        <div>
          <span className="text-2xl font-bold">Use </span>
          <span className="text-2xl font-bold text-[#caff33]">Cases</span>
        </div>
        <div className="text-sm text-gray-600 max-w-2xl">
          MuleHunter is built for investigators and institutions to uncover mule networks, explain risk, and act on financial fraud with confidence.
        </div>

        {/* Section 1: Financial Institutions */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.8fr_1.2fr] gap-12 lg:gap-48 items-center py-12">
          <div className="grid grid-cols-2 gap-4 p-4 border border-gray-900 rounded-2xl font-bold bg-[#050505]">
            <UseCaseIcon icon={UserX} label="Mule Identification" />
            <UseCaseIcon icon={Network} label="Ring Detection" />
            <UseCaseIcon icon={Activity} label="Anomaly Detection" />
            <UseCaseIcon icon={Lightbulb} label="Explainable Decisions" />
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">For Financial Institutions</h2>
            <p className="text-sm text-gray-500 max-w-md">Banks and FinTechs leverage MuleHunter to reduce fraud losses and regulatory risk.</p>
            <div className="grid grid-cols-3 gap-4">
              <StatBlock value="78%" label="Faster detection" />
              <StatBlock value="63%" label="Less False Positives" />
              <StatBlock value="91%" label="Confidence" />
            </div>
          </div>
        </div>

        {/* Section 2: Operational Benefits (Reversed for visual variety) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-48 items-center py-12 border-t border-gray-900/50">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-bold">For Operational Benefits</h2>
            <p className="text-sm text-gray-500 max-w-md">payment Platforms leverage MuleHunter to automate manual review workloads.</p>
            <div className="grid grid-cols-3 gap-4">
              <StatBlock value="65%" label="Less Workload" />
              <StatBlock value="70%" label="Faster Resolution" />
              <StatBlock value="45%" label="Cost Savings" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 border border-gray-900 rounded-2xl font-bold bg-[#050505]">
            <UseCaseIcon icon={FileSearch} label="Case Investigation" />
            <UseCaseIcon icon={ArrowLeftRight} label="Path Analysis" />
            <UseCaseIcon icon={GitBranch} label="Network Expansion" />
            <UseCaseIcon icon={Brain} label="AI Narratives" />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

// Helper Components for cleaner code
function UseCaseIcon({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 text-[10px] p-4 border border-gray-800 rounded-2xl hover:border-[#caff33] transition-all">
      <Icon className="w-5 text-[#caff33]" />
      <div className="text-center">{label}</div>
    </div>
  );
}

function StatBlock({ value, label }: { value: string, label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-[#caff33]">{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-tighter leading-tight">{label}</div>
    </div>
  );
}