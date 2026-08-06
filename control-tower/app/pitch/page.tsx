"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Maximize2, Minimize2, ExternalLink } from "lucide-react";

export default function PitchPage() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // sync fullscreen state with browser API
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#04040f] overflow-hidden">
      {/* ── slim header bar ─────────────────────────────────────────── */}
      {!isFullscreen && (
        <header
          className="flex-shrink-0 flex items-center justify-between
                     px-5 py-2.5 bg-[#0a0a18]
                     border-b border-white/[0.06] z-50"
          style={{ height: 44 }}
        >
          {/* left: back + brand */}
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-white/30
                         hover:text-[#BBFF00] transition-colors font-mono tracking-wide"
            >
              <ArrowLeft size={13} />
              Back
            </Link>

            <div className="w-px h-4 bg-white/10" />

            <div className="flex items-center gap-2">
              {/* tiny brand mark */}
              <span
                className="w-4 h-4 rounded flex items-center justify-center"
                style={{ background: "rgba(187,255,0,.12)", border: "1px solid rgba(187,255,0,.3)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-sm"
                  style={{ background: "#BBFF00" }}
                />
              </span>
              <span className="font-mono text-[10px] tracking-[.18em] uppercase text-white/35">
                alertixAI &nbsp;&bull;&nbsp; Team Alertix &nbsp;&bull;&nbsp; NIT Patna
              </span>
            </div>
          </div>

          {/* right: actions */}
          <div className="flex items-center gap-2">
            {/* loading indicator */}
            {!loaded && (
              <span className="font-mono text-[9px] text-[#BBFF00]/40 tracking-widest animate-pulse mr-1">
                Loading…
              </span>
            )}

            <a
              href="/presentation.html"
              target="_blank"
              rel="noopener noreferrer"
              title="Open in new tab"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono
                         text-white/30 border border-white/[0.07]
                         hover:text-[#BBFF00] hover:border-[#BBFF00]/30 transition-all"
            >
              <ExternalLink size={11} />
              New tab
            </a>

            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono
                         text-white/30 border border-white/[0.07]
                         hover:text-[#BBFF00] hover:border-[#BBFF00]/30 transition-all cursor-pointer"
            >
              <Maximize2 size={11} />
              Fullscreen
            </button>
          </div>
        </header>
      )}

      {/* ── iframe — fills remaining height ─────────────────────────── */}
      <div className="flex-1 relative min-h-0">
        {/* shimmer while loading */}
        {!loaded && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#04040f]">
            <div className="flex flex-col items-center gap-5">
              <div
                className="w-12 h-12 rounded-full border-[3px] animate-spin"
                style={{
                  borderColor: "rgba(187,255,0,.15)",
                  borderTopColor: "#BBFF00",
                }}
              />
              <p className="font-mono text-[11px] tracking-[.2em] uppercase text-[#BBFF00]/50">
                Loading presentation
              </p>
            </div>
          </div>
        )}

        <iframe
          src="/presentation.html"
          title="alertixAI Pitch Deck — Team Alertix"
          className="w-full h-full border-0"
          style={{ display: "block" }}
          onLoad={() => setLoaded(true)}
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    </div>
  );
}
