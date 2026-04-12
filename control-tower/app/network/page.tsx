"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import GraphControls from "../components/graph/GraphControls";
import { NodeInspector } from "../components/graph/NodeInspector";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import type { GraphNode } from "../components/graph/FraudGraph3D";

const FraudGraph3D = dynamic(
  () => import("../components/graph/FraudGraph3D"),
  { ssr: false }
);

export default function NetworkPage() {
  // ── Node selection ──
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // ── Filter state ──
  const [riskThreshold, setRiskThreshold] = useState<number>(0);
  const [showOnlyFraud, setShowOnlyFraud] = useState<boolean>(false);
  const [showOnlyRings, setShowOnlyRings] = useState<boolean>(false);
  const [searchId, setSearchId] = useState<string>("");
  const [searchTrigger, setSearchTrigger] = useState<string>("");

  // ── Stats lifted from graph ──
  const [stats, setStats] = useState({ totalNodes: 0, fraudNodes: 0, rings: 0 });

  const handleSearch = useCallback(() => {
    setSearchTrigger(searchId.trim());
  }, [searchId]);

  const handleReset = useCallback(() => {
    setRiskThreshold(0);
    setShowOnlyFraud(false);
    setShowOnlyRings(false);
    setSearchId("");
    setSearchTrigger("");
    setSelectedNode(null);
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black">
      <Navbar />

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left sidebar */}
        <GraphControls
          riskThreshold={riskThreshold}
          setRiskThreshold={setRiskThreshold}
          showOnlyFraud={showOnlyFraud}
          setShowOnlyFraud={setShowOnlyFraud}
          showOnlyRings={showOnlyRings}
          setShowOnlyRings={setShowOnlyRings}
          searchId={searchId}
          setSearchId={setSearchId}
          onSearch={handleSearch}
          onReset={handleReset}
          totalNodes={stats.totalNodes}
          fraudNodes={stats.fraudNodes}
          rings={stats.rings}
        />

        {/* 3D Graph canvas — fills remaining space */}
        <div className="flex-1 relative min-w-0 min-h-0">
          <FraudGraph3D
            onNodeSelect={setSelectedNode}
            selectedNode={selectedNode}
            riskThreshold={riskThreshold}
            showOnlyFraud={showOnlyFraud}
            showOnlyRings={showOnlyRings}
            searchId={searchTrigger}
            onStatsUpdate={setStats}
          />
        </div>

        {/* Right panel: node inspector */}
        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      <Footer />
    </div>
  );
}