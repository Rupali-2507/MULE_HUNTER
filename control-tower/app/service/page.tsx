"use client";

import React, { useState, useRef } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Shield, Zap, Send, Check } from "lucide-react";
import emailjs from "@emailjs/browser";

export default function ServicePage() {
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleFormSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!formRef.current) return;

  setIsPending(true);

  try {
    const result = await emailjs.sendForm(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!, 
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!, 
      formRef.current,
      process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
    );

    if (result.text === "OK") {
      alert("Service request sent successfully!");
      formRef.current.reset();
    }
  } catch (error: any) {
    alert("Failed to send: " + (error?.text || "Check console"));
  } finally {
    setIsPending(false);
  }
};

  return (
    <div className="bg-black text-white min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 lg:py-0">
        <div className="w-full max-w-[1600px] mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-16 lg:gap-48">
          
          {/* Left Side: Content */}
          <div className="flex flex-col justify-center items-start gap-4 order-2 lg:order-1">
            <div className="p-3 bg-gray-900 rounded-3xl flex gap-3 text-xs">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-lime-500 shrink-0">
                <Check className="w-3 h-3 text-black" strokeWidth={3} />
              </span>
              {/* <h2 className="flex items-center font-bold uppercase tracking-wider">
                Institutional Grade | Fraud Intelligence
              </h2> */}
            </div>

            <div className="pt-3 text-2xl md:text-3xl font-helvitica-neue leading-tight">
              <h2>Securing the Future of</h2>
              <h2 className="text-[#CAFF33]">Digital Payments</h2>
              <h3 className="text-gray-400 text-lg md:text-xl mt-2">Enterprise Solutions & Consultation</h3>
            </div>

            <div className="text-gray-500 max-w-2xl leading-relaxed text-sm md:text-base">
              MuleHunter provides specialized consultancy and integration services for 
              high-volume payment providers.
            </div>

            <div className="grid grid-cols-1 gap-4 mt-6 w-full max-w-md">
              <AboutServiceItem 
                icon={<Shield className="w-5 text-[#CAFF33]" />}
                title="Infrastructure Audit"
                desc="Deep-dive analysis of your current transaction monitoring systems."
              />
              <AboutServiceItem 
                icon={<Zap className="w-5 text-[#CAFF33]" />}
                title="Custom Model Training"
                desc="Bespoke ML models trained on your specific regional data patterns."
              />
            </div>
          </div>

          {/* Right Side: Request Form */}
          <div className="flex justify-center lg:justify-start items-center order-1 lg:order-2">
            <div className="border w-full max-w-md flex flex-col gap-6 p-6 md:p-8 border-gray-900 rounded-3xl bg-[#0A0A0A] shadow-xl">
              <div>
                <h1 className="text-lg font-bold">Request Services</h1>
                <p className="text-xs text-gray-500">Submit your details for a technical consultation.</p>
              </div>

              {/* Added ref and reverted to onSubmit for EmailJS */}
              <form ref={formRef} onSubmit={handleFormSubmit} className="flex flex-col gap-4">
                <div className="space-y-4">
                  <input 
                    name="from_name" // Match these names to your EmailJS Template {{from_name}}
                    type="text" 
                    placeholder="Full Name" 
                    required
                    className="w-full bg-transparent border border-gray-800 p-3 rounded-xl text-sm focus:border-[#CAFF33] outline-none text-white" 
                  />
                  <input 
                    name="reply_to" // Match {{reply_to}}
                    type="email" 
                    placeholder="Work Email" 
                    required
                    className="w-full bg-transparent border border-gray-800 p-3 rounded-xl text-sm focus:border-[#CAFF33] outline-none text-white" 
                  />
                  
                  <select 
                    name="service_type" // Match {{service_type}}
                    required
                    defaultValue=""
                    className="w-full bg-black border border-gray-800 p-3 rounded-xl text-sm focus:border-[#CAFF33] outline-none text-gray-400 cursor-pointer"
                  >
                    <option value="" disabled>Select a Service</option>
                    <option value="Network Visualization Setup">Network Visualization Setup</option>
                    <option value="Mule Detection API">Mule Detection API</option>
                    <option value="Institutional Consultation">Institutional Consultation</option>
                    <option value="Real-time Transaction Scoring">Real-time Transaction Scoring</option>
                    <option value="AML/KYC Compliance Audit">AML/KYC Compliance Audit</option>
                    <option value="Custom ML Model Training">Custom ML Model Training</option>
                    <option value="Other">Other Inquiry</option>
                  </select>

                  <textarea 
                    name="message" // Match {{message}}
                    placeholder="Tell us about your organization's needs..."
                    required
                    className="w-full bg-transparent border border-gray-800 p-3 rounded-xl text-sm h-24 focus:border-[#CAFF33] outline-none resize-none text-white"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-[#CAFF33] hover:bg-[#b8e62e] text-black font-bold py-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Sending..." : "Submit Request"}
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function AboutServiceItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex gap-4 p-4 border border-gray-900 rounded-2xl hover:bg-gray-950 transition-colors">
      <div className="mt-1 shrink-0">{icon}</div>
      <div>
        <h4 className="text-sm font-bold text-gray-200">{title}</h4>
        <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}