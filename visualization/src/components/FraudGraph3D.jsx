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

  const ZOOM_STEP = 120;
  const MIN_Z = 150;
  const MAX_Z = 1800;

  const [mounted, setMounted] = useState(false);
  const [ForceGraph3D, setForceGraph3D] = useState(null);

  const [rawGraph, setRawGraph] = useState(null);
  const [showOnlyFraud, setShowOnlyFraud] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);

  const [dimensions, setDimensions] = useState({
    width: 0,
    height: 0,
  });

  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");

  // ---------- CLIENT MOUNT ----------
  useEffect(() => {
    setMounted(true);
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, []);

  // ---------- LOAD FORCE GRAPH SAFELY (CRITICAL FIX) ----------
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

    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted]);

  // ---------- LOAD GRAPH DATA ----------
  // if (!token) {
  //   return (
  //     <div className="flex h-screen items-center justify-center text-white">
  //       Unauthorized
  //     </div>
  //   );
  // }

  useEffect(() => {
    if (!mounted) return;

    const controller = new AbortController();

    async function loadGraph() {
      try {
        const res = await fetch(`${API_BASE}/api/graph`, {
          signal: controller.signal,
          /*headers: {
            Authorization: `Bearer ${token}`,
          },*/
        });

        const text = await res.text();
        if (text.trim().startsWith("<")) {
          console.error("HTML received instead of JSON:", text);
          return;
        }

        const data = JSON.parse(text);

        const normalized = {
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
        };

        setRawGraph(normalized);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Could not load graph data:", err);
        }
      }
    }

    loadGraph();
    return () => controller.abort();
  }, [mounted, API_BASE]);

  // ---------- FRAUD FILTER ----------
  const visibleGraph = useMemo(() => {
    if (!rawGraph) return null;
    if (!showOnlyFraud) return rawGraph;

    const fraudIds = new Set(
      rawGraph.nodes.filter((n) => n.is_anomalous).map((n) => n.id)
    );

    return {
      nodes: rawGraph.nodes.filter((n) => fraudIds.has(n.id)),
      links: rawGraph.links.filter((l) => {
        const src = typeof l.source === "object" ? l.source.id : l.source;
        const tgt = typeof l.target === "object" ? l.target.id : l.target;
        return fraudIds.has(src) && fraudIds.has(tgt);
      }),
    };
  }, [rawGraph, showOnlyFraud]);

  // ---------- CAMERA DEFAULT ----------
  useEffect(() => {
    if (!fgRef.current || !rawGraph) return;
    fgRef.current.cameraPosition(
      { x: 0, y: 0, z: 900 },
      { x: 0, y: 0, z: 0 },
      0
    );
  }, [rawGraph]);

  // ---------- CAMERA ON SELECT ----------
  useEffect(() => {
    if (!selectedNode || !fgRef.current) return;
    fgRef.current.cameraPosition(
      {
        x: selectedNode.x * 1.3,
        y: selectedNode.y * 1.3,
        z: selectedNode.z * 1.3 + 120,
      },
      selectedNode,
      1500
    );
  }, [selectedNode]);

  // ---------- SEARCH ----------
  const handleSearch = () => {
    if (!visibleGraph || !fgRef.current) return;

    const node = visibleGraph.nodes.find(
      (n) => String(n.id) === searchId.trim()
    );

    if (!node) {
      setSearchError("Account not found in current view");
      return;
    }

    setSearchError("");
    setActiveNodeId(node.id);
    onNodeSelect(node);

    fgRef.current.cameraPosition(
      { x: node.x * 1.4, y: node.y * 1.4, z: node.z * 1.4 + 150 },
      node,
      1200
    );
  };

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
    <div className="relative h-screen w-full bg-black">
      <div ref={containerRef} className="h-full w-full">
        <ForceGraph3D
          ref={fgRef}
          graphData={visibleGraph}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          enableNodeDrag={false}
          warmupTicks={120}
          cooldownTicks={0}
          onNodeClick={(node) => {
            onNodeSelect(node);
            setActiveNodeId(node.id);
          }}
          nodeThreeObject={(node) => {
            const isSelected =
              selectedNode?.id === node.id || activeNodeId === node.id;
            const isAlerted = alertedNodeId === node.id;

            const geometry = new THREE.SphereGeometry(
              isAlerted ? 7 : isSelected ? 6 : 3,
              18,
              18
            );

            const material = new THREE.MeshStandardMaterial({
              color: node.color,
              emissive: isSelected ? node.color : "#000000",
              emissiveIntensity: isSelected ? 0.9 : 0,
            });

            return new THREE.Mesh(geometry, material);
          }}
        />
      </div>
    </div>
  );
}
