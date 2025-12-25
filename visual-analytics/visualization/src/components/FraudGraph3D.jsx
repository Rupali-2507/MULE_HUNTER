import React, { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

export default function FraudGraph3D({
  onNodeSelect,
  selectedNode,
  alertedNodeId,
  token,
}) {
  const fgRef = useRef();
  const containerRef = useRef();

  const ZOOM_STEP = 120;
  const MIN_Z = 150;
  const MAX_Z = 1800;

  const [rawGraph, setRawGraph] = useState(null);
  const [showOnlyFraud, setShowOnlyFraud] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState(null);
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");
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

    // Smooth camera focus
    fgRef.current.cameraPosition(
      {
        x: node.x * 1.4,
        y: node.y * 1.4,
        z: node.z * 1.4 + 150,
      },
      node,
      1200
    );
  };

  const zoomCamera = (direction) => {
    if (!fgRef.current) return;

    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();

    const currentZ = camera.position.z;
    let targetZ =
      direction === "in" ? currentZ - ZOOM_STEP : currentZ + ZOOM_STEP;

    targetZ = Math.max(MIN_Z, Math.min(MAX_Z, targetZ));

    fgRef.current.cameraPosition(
      {
        x: camera.position.x,
        y: camera.position.y,
        z: targetZ,
      },
      controls.target,
      500
    );
  };

  // LOAD GRAPH DATA (CORRECT + SAFE)
  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Unauthorized
      </div>
    );
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadGraph() {
      try {
        const res = await fetch(`http://localhost:8080/api/graph`, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const text = await res.text();

        if (text.trim().startsWith("<")) {
          console.error("HTML received instead of JSON:", text);
          return;
        }

        const data = JSON.parse(text);

        // NORMALIZE Backend DATA

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
  }, []);

  useEffect(() => {
    const onResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // FRAUD-ONLY FILTER

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

  // CAMERA DEFAULT

  useEffect(() => {
    if (!fgRef.current || !rawGraph) return;
    fgRef.current.cameraPosition(
      { x: 0, y: 0, z: 900 },
      { x: 0, y: 0, z: 0 },
      0
    );
  }, [rawGraph]);

  // CAMERA ON NODE SELECT

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

  // LOADING STATE

  if (!visibleGraph) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Loading Fraud Network…
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-linear-to-br from-black via-slate-900 to-black">
      {/* HEADER */}
      <div className="absolute top-6 left-6 z-10 max-w-md">
        <h1 className="text-xl font-semibold text-white">
          Fraud Transaction Network (3D)
        </h1>
        <p className="text-sm text-gray-400">
          Red nodes indicate anomalous / high-risk accounts detected via EIF
        </p>
      </div>
      {/* SEARCH BAR */}
      <div className="absolute top-60 left-6 z-10 w-64 rounded-xl bg-black/70 p-3 backdrop-blur">
        <input
          type="text"
          placeholder="Search Account ID"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="w-full rounded bg-gray-900 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-red-500"
        />

        <button
          onClick={handleSearch}
          className="mt-2 w-full rounded bg-red-600 py-1.5 text-xs font-semibold hover:bg-red-700"
        >
          Focus Node
        </button>

        {searchError && (
          <p className="mt-2 text-xs text-red-400">{searchError}</p>
        )}
      </div>

      {/* LEGEND + FILTER */}
      <div className="absolute top-20 left-6 z-10 rounded-xl bg-black/70 p-4 text-sm text-gray-200 backdrop-blur">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFraud}
            onChange={(e) => setShowOnlyFraud(e.target.checked)}
            className="accent-red-500"
          />
          Show only fraud nodes
        </label>

        <div className="mt-4 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            Fraud / Anomalous
          </div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            Normal
          </div>
          <div className="flex items-center gap-2">
            <span className="h-[0.5px] w-6 bg-gray-700" />
            Transaction
          </div>
        </div>
      </div>

      {/* GRAPH */}
      <div ref={containerRef} className="h-full w-full">
        <ForceGraph3D
          width={dimensions.width}
          height={dimensions.height}
          ref={fgRef}
          graphData={visibleGraph}
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
          nodeLabel={(n) =>
            `Account ${n.id}
Anomaly Score: ${n.height.toFixed(2)}
Status: ${n.is_anomalous ? "Fraud" : "Normal"}`
          }
          linkColor={(link) => {
            if (!activeNodeId) return "rgba(180,180,180,0.35)";

            const src = link.source.id ?? link.source;
            const tgt = link.target.id ?? link.target;

            if (src !== activeNodeId && tgt !== activeNodeId)
              return "rgba(180,180,180,0.15)";

            const activeNode = visibleGraph.nodes.find(
              (n) => n.id === activeNodeId
            );

            return activeNode?.is_anomalous
              ? "rgba(255,80,80,0.9)"
              : "rgba(180,180,180,0.35)";
          }}
          linkWidth={(l) => {
            if (!selectedNode) return Math.min(1.2, Math.log(l.amount + 1));
            const src = l.source.id ?? l.source;
            const tgt = l.target.id ?? l.target;
            return src === selectedNode.id || tgt === selectedNode.id
              ? 2.5
              : 0.2;
          }}
          linkDirectionalParticles={1}
          linkDirectionalParticleWidth={1.6}
          linkDirectionalParticleSpeed={0.005}
        />
      </div>

      {/* ZOOM CONTROLS */}
      <div className="absolute bottom-24 left-6 z-10 flex flex-col gap-2">
        <button
          onClick={() => zoomCamera("in")}
          title="Zoom In"
          aria-label="Zoom In"
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-xs bg-black/70  text-white backdrop-blur hover:bg-black active:scale-95"
        >
          zoom in
        </button>

        <button
          onClick={() => zoomCamera("out")}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm bg-black/70  text-white backdrop-blur hover:bg-black active:scale-95"
        >
          zoom out
        </button>
      </div>

      {/* FOOTER */}
      <div className="absolute bottom-4 w-full text-center text-xs text-white">
        Left-click rotate · Scroll zoom · Right-click pan
      </div>

      {/* ALERT PING */}
      {alertedNodeId && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 h-32 w-32 animate-ping rounded-full border-2 border-red-500 opacity-75" />
        </div>
      )}
    </div>
  );
}
