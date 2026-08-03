import PaymentSection from "../components/PaymentSection";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export const metadata = {
  title: "Live Demo — MuleHunter",
  description: "Real-time UPI payment gateway with fraud detection",
};

export default function DemoPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0D0D0D] px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left column — Header / Info */}
          <div className="flex flex-col mt-16 md:mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-[#CAFF33] opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#CAFF33]" />
              </span>
              <span className="text-[#CAFF33] text-[11px] font-mono tracking-widest uppercase">
                Live System
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
              UPI Payment Gateway
              <span className="block text-[#CAFF33]">with Real-Time Fraud Detection</span>
            </h1>

            <p className="text-gray-400 text-xs leading-relaxed max-w-lg mb-6">
              Every transaction runs through the full MuleHunter pipeline — GNN graph scoring,
              Extended Isolation Forest anomaly detection, JA3 fingerprinting, and behavioral
              analysis — before a verdict is returned in under 50ms.
            </p>

            {/* Threshold legend */}
            <div className="flex flex-wrap gap-5 text-[11px] font-mono mb-10">
              <span className="flex items-center gap-1.5 text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                &lt; 0.45 Approve
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                0.45 – 0.75 Review
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                ≥ 0.75 Block
              </span>
            </div>

            {/* Info cards */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-[#12141a] border border-gray-800 rounded-xl p-4">
                <div className="mt-0.5 h-8 w-8 flex items-center justify-center rounded-full bg-[#1a1d24] text-[#CAFF33] text-xs">
                  ⚡
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">Sub-50ms Verdicts</p>
                  <p className="text-gray-500 text-[11px] mt-1">
                    Every request is scored end-to-end before the payment settles.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-[#12141a] border border-gray-800 rounded-xl p-4">
                <div className="mt-0.5 h-8 w-8 flex items-center justify-center rounded-full bg-[#1a1d24] text-[#CAFF33] text-xs">
                  🛡
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">Multi-Signal Fusion</p>
                  <p className="text-gray-500 text-[11px] mt-1">
                    Graph, behavior, and network fingerprinting combined into one score.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — Payment form card */}
          <div className="bg-[#12141a] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/30">
            <PaymentSection currentUserAccount="1553" />
          </div>

        </div>
      </main>
      <Footer />
    </>
  );
}