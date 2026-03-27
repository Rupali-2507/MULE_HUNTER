"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import NodeInspector from "../components/graph/NodeInspector";
import Navbar from "../components/Navbar";
import type { GraphNode } from "../components/graph/FraudGraph3D";
import Footer from "../components/Footer";

const FraudGraph3D = dynamic(
  () => import("../components/graph/FraudGraph3D"),
  { ssr: false }
);

export default function NetworkPage() {
 
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [alertedNodeId, setAlertedNodeId] = useState<string | number | null>(null);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black">
      <Navbar />
      <div className="flex-1 relative overflow-hidden flex">
        <div className="flex-1">
          <FraudGraph3D
            onNodeSelect={setSelectedNode}
            selectedNode={selectedNode}
            alertedNodeId={alertedNodeId}
          />
        </div>
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