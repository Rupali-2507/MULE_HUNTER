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
  const [selectedNode, setSelectedNode] =
    useState<GraphNode | null>(null);

  return (
    <>
     <Navbar />
    <div className="h-screen w-full bg-black flex relative overflow-hidden">
      
      <div className="flex-1">
        <FraudGraph3D
          onNodeSelect={setSelectedNode}
          selectedNode={selectedNode}
        />
      </div>

      {selectedNode && (
        <NodeInspector
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
      
    </div>
    <Footer/>
    </>
  );
}