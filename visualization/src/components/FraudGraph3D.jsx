import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

export default function FraudGraph3D({
  onNodeSelect,
  selectedNode,
  alertedNodeId,
  token,
}) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const API_BASE = import.meta.env.VITE_API_BASE_URL;

  const [mounted, setMounted] = useState(false);
  const [ForceGraph3D, setForceGraph3D] = useState(null);

  const [rawGraph, setRawGraph] = useState(null);
  const [showOnlyFraud, setShowOnlyFraud] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");

  // ---------- MOUNT ----------
  useEffect(() => {
    setMounted(true);
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  // ---------- SAFE RUNTIME LOAD (CRITICAL FIX) ----------
  useEffect(() => {
    let cancelled = false;

    import("react-force-graph-3d").then((mod) => {
      if (!cancelled) {
        setForceGraph3D(() => mod.default);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- RESIZE ----------
  useEffect(() => {
    if (!mounted) return;
    const onResize = () =>
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted]);

  // ---------- LOAD GRAPH ----------
  useEffect(() => {
    if (!mounted) return;

    const controller = new AbortController();

    async function loadGraph() {
      try {
        const res = await fetch(`${API_BASE}/api/graph`, {
          signal: controller.signal,
        });

        const text = await res.text();
        if (text.trim().startsWith("<")) return;

        const data = JSON.parse(text);

        setRawGraph({
          nodes: data.nodes.map((n) => ({
            id: n.nodeId,
            is_anomalous: n.isAnomalous,
            height: n.anomalyScore,
            volume: n.volume ?? 1,
            color: n.isAnomalous ? "#ff4d4d" : "#22c55e",
          })),
          links: data.links
            .filter((l) => l.source && l.target)
            .map((l) => ({
              source: l.source,
              target: l.target,
              amount: Number(l.amount ?? 1),
            })),
        });
      } catch {}
    }

    loadGraph();
    return () => controller.abort();
  }, [mounted, API_BASE]);

  // ---------- FILTER ----------
  const visibleGraph = useMemo(() => {
    if (!rawGraph) return null;
    if (!showOnlyFraud) return rawGraph;

    const fraudIds = new Set(
      rawGraph.nodes.filter((n) => n.is_anomalous).map((n) => n.id)
    );

    return {
      nodes: rawGraph.nodes.filter((n) => fraudIds.has(n.id)),
      links: rawGraph.links.filter((l) => {
        const s = typeof l.source === "object" ? l.source.id : l.source;
        const t = typeof l.target === "object" ? l.target.id : l.target;
        return fraudIds.has(s) && fraudIds.has(t);
      }),
    };
  }, [rawGraph, showOnlyFraud]);

  // ---------- HARD GUARD ----------
  if (!mounted || !visibleGraph || !ForceGraph3D) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Initializing 3D Engine…
      </div>
    );
  }

  // ---------- RENDER ----------
  return (
    <div className="h-screen w-full bg-black">
      <div ref={containerRef} className="h-full w-full">
        <ForceGraph3D
          ref={fgRef}
          graphData={visibleGraph}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          enableNodeDrag={false}
          onNodeClick={(node) => {
            onNodeSelect(node);
            setActiveNodeId(node.id);
          }}
          nodeThreeObject={(node) => {
            const isSelected =
              selectedNode?.id === node.id || activeNodeId === node.id;
            const isAlerted = alertedNodeId === node.id;

            return new THREE.Mesh(
              new THREE.SphereGeometry(
                isAlerted ? 7 : isSelected ? 6 : 3,
                18,
                18
              ),
              new THREE.MeshStandardMaterial({
                color: node.color,
                emissive: isSelected ? node.color : "#000",
                emissiveIntensity: isSelected ? 0.9 : 0,
              })
            );
          }}
        />
      </div>
    </div>
  );
}
