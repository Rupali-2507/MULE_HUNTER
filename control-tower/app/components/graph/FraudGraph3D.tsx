"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { applyBundleLayout, removeBundleLayout } from "../../lib/bundleLayout";

export interface GraphNode {
  id: string | number;
  is_anomalous: boolean;
  anomalyScore?: number;
  volume?: number;
  x?: number;
  y?: number;
  z?: number;
}

interface GraphLink {
  source: string | number | GraphNode;
  target: string | number | GraphNode;
}

interface RawGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface FocusData {
  neighborSet: Set<string | number>;
  fraudCluster: Set<string | number>;
}

interface FraudGraph3DProps {
  onNodeSelect: (node: GraphNode | null) => void;
  selectedNode: GraphNode | null;
  alertedNodeId?: string | number | null;
}

function resolveId(endpoint: string | number | GraphNode): string | number {
  return typeof endpoint === "object" ? endpoint.id : endpoint;
}

interface LegendDotProps {
  color: string;
  label: string;
}

function LegendDot({ color, label }: LegendDotProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

export default function FraudGraph3D({
  onNodeSelect,
  selectedNode,
  alertedNodeId,
}: FraudGraph3DProps) {
  const fgRef = useRef<any>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

  const [ForceGraph3D, setForceGraph3D] =
    useState<React.ComponentType<any> | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [rawGraph, setRawGraph] = useState<RawGraph | null>(null);
  const [showOnlyFraud, setShowOnlyFraud] = useState<boolean>(false);
  const [isBundled, setIsBundled] = useState<boolean>(false);
  const [activeNodeId, setActiveNodeId] = useState<string | number | null>(
    null
  );
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });
  const [searchId, setSearchId] = useState<string>("");
  const [searchError, setSearchError] = useState<string>("");
  const hasFitted = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  useEffect(() => {
    import("react-force-graph-3d").then((mod) => {
      setForceGraph3D(() => mod.default);
    });
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;

    async function loadGraph() {
      try {
        const res = await fetch(`${API_BASE}/api/graph`);
        const data = await res.json();

        setRawGraph({
          nodes: data.nodes.map(
            (n: {
              nodeId: string | number;
              isAnomalous: boolean;
              anomalyScore: number;
              volume?: number;
            }): GraphNode => ({
              id: n.nodeId,
              is_anomalous: n.isAnomalous,
              anomalyScore: n.anomalyScore,
              volume: n.volume,
            })
          ),
          links: data.links
            .filter((l: any) => l.source && l.target)
            .map((l: any) => ({
              source: String(l.source),
              target: String(l.target),
            })),
        });
      } catch (err) {
        console.error("Graph load failed", err);
      }
    }

    loadGraph();
  }, [mounted, API_BASE]);

  const visibleGraph = useMemo<RawGraph | null>(() => {
    if (!rawGraph) return null;

    let graph = rawGraph;

    if (showOnlyFraud) {
      const fraudIds = new Set(
        rawGraph.nodes.filter((n) => n.is_anomalous).map((n) => n.id)
      );
      graph = {
        nodes: rawGraph.nodes.filter((n) => fraudIds.has(n.id)),
        links: rawGraph.links.filter(
          (l) =>
            fraudIds.has(resolveId(l.source)) &&
            fraudIds.has(resolveId(l.target))
        ),
      };
    }

    return isBundled ? applyBundleLayout(graph) : removeBundleLayout(graph);
  }, [rawGraph, showOnlyFraud, isBundled]);

  const focusData = useMemo<FocusData>(() => {
    if (!activeNodeId || !visibleGraph) {
      return { neighborSet: new Set(), fraudCluster: new Set() };
    }

    const neighborSet = new Set<string | number>([activeNodeId]);
    const fraudCluster = new Set<string | number>();

    visibleGraph.links.forEach((link) => {
      const s = resolveId(link.source);
      const t = resolveId(link.target);
      if (s === activeNodeId) neighborSet.add(t);
      if (t === activeNodeId) neighborSet.add(s);
    });

    visibleGraph.links.forEach((link) => {
      const s = resolveId(link.source);
      const t = resolveId(link.target);
      const sourceNode = typeof link.source === "object" ? link.source : null;
      const targetNode = typeof link.target === "object" ? link.target : null;

      if (
        sourceNode?.is_anomalous &&
        targetNode?.is_anomalous &&
        (neighborSet.has(s) || neighborSet.has(t))
      ) {
        fraudCluster.add(s);
        fraudCluster.add(t);
      }
    });

    return { neighborSet, fraudCluster };
  }, [activeNodeId, visibleGraph]);

  const handleToggleBundle = () => {
    setIsBundled((prev) => !prev);
    hasFitted.current = false;
  };

  const handleSearch = () => {
    if (!searchId.trim()) return;

    const node = rawGraph?.nodes.find(
      (n) => String(n.id) === searchId.trim()
    );

    if (!node) {
      setSearchError("Account not found");
      return;
    }

    setSearchError("");
    onNodeSelect(node);
    setActiveNodeId(node.id);

    setTimeout(() => {
      if (!fgRef.current || node.x === undefined) return;
      const distance = 80;
      const distRatio =
        1 + distance / Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      fgRef.current.cameraPosition(
        {
          x: (node.x ?? 0) * distRatio,
          y: (node.y ?? 0) * distRatio,
          z: (node.z ?? 0) * distRatio,
        },
        node,
        800
      );
    }, 500);
  };

  const handleResetView = () => {
    if (!fgRef.current) return;
    setActiveNodeId(null);
    onNodeSelect(null);
    fgRef.current.zoomToFit(800);
  };

  const handleZoomIn = () => {
    if (!fgRef.current) return;
    const camera = fgRef.current.camera() as THREE.PerspectiveCamera;
    fgRef.current.cameraPosition(
      { z: camera.position.z * 0.85 },
      undefined,
      500
    );
  };

  const handleZoomOut = () => {
    if (!fgRef.current) return;
    const camera = fgRef.current.camera() as THREE.PerspectiveCamera;
    fgRef.current.cameraPosition(
      { z: camera.position.z * 1.15 },
      undefined,
      500
    );
  };

  const handleNodeClick = (node: GraphNode) => {
    onNodeSelect(node);
    setActiveNodeId(node.id);

    const distance = 60;
    const distRatio =
      1 + distance / Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);

    fgRef.current?.cameraPosition(
      {
        x: (node.x ?? 0) * distRatio,
        y: (node.y ?? 0) * distRatio,
        z: (node.z ?? 0) * distRatio,
      },
      node,
      800
    );
  };

  const getLinkColor = (link: GraphLink): string => {
    if (!activeNodeId) return "rgba(48, 72, 105, 1)";

    const s = resolveId(link.source);
    const t = resolveId(link.target);
    const connected = s === activeNodeId || t === activeNodeId;

    const sNode = typeof link.source === "object" ? link.source : null;
    const tNode = typeof link.target === "object" ? link.target : null;
    const fraudToFraud = sNode?.is_anomalous && tNode?.is_anomalous;

    if (fraudToFraud && connected) return "#ef4444";
    if (connected) return "#60a5fa";
    return "rgba(5, 5, 5, 0.01)";
  };

  const getLinkOpacity = (link: GraphLink): number => {
    if (!activeNodeId) return 0.5;
    const s = resolveId(link.source);
    const t = resolveId(link.target);
    return s === activeNodeId || t === activeNodeId ? 1 : 0.02;
  };

  const buildNodeObject = (node: GraphNode): THREE.Group => {
    const isSelected = node.id === activeNodeId;
    const isNeighbor = focusData.neighborSet.has(node.id);

    const baseColor = node.is_anomalous ? "#7f1d1d" : "#14532d";
    let opacity = 1;

    if (activeNodeId) {
      opacity = isSelected || isNeighbor ? 1 : 0.12;
    }

    const group = new THREE.Group();

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(3, 24, 24),
      new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true,
        opacity,
      })
    );
    group.add(sphere);

    if (isSelected) {
      const border = new THREE.Mesh(
        new THREE.SphereGeometry(3.6, 32, 32),
        new THREE.MeshBasicMaterial({ color: "#3b82f6", wireframe: true })
      );
      group.add(border);
    }

    return group;
  };

  const getNodeLabel = (node: GraphNode): string => `
    <div style="
      background: rgba(10, 15, 25, 0.95);
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid ${node.is_anomalous ? "#7f1d1d" : "#14532d"};
      font-size: 12px;
      color: white;
    ">
      <div style="font-weight: 600;">Account ${node.id}</div>
      <div style="margin-top:4px;">
        Status: ${node.is_anomalous ? "Anomalous" : "Normal"}
      </div>
    </div>
  `;

  if (!mounted || !visibleGraph || !ForceGraph3D) {
    return (
      <div className="flex h-screen items-center justify-center text-white">
        Initializing 3D Engine…
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black relative">
      {/* ── Left panel ── */}
      <div
        className="absolute top-6 left-6 z-20
                   bg-zinc-900/80 backdrop-blur-xl
                   border border-zinc-800
                   rounded-lg p-4 w-64 text-sm text-gray-300"
      >
        <h3 className="text-white font-semibold mb-2">
          Fraud Transaction Network
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          Red nodes indicate anomalous accounts.
        </p>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search Account ID..."
            value={searchId}
            onChange={(e) => {
              setSearchId(e.target.value);
              setSearchError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            className="w-full px-3 py-2 text-sm bg-black border border-zinc-700 rounded-md text-white"
          />
          {searchError && (
            <p className="text-red-500 text-xs mt-1">{searchError}</p>
          )}
        </div>

        {/* Fraud filter */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFraud}
            onChange={() => setShowOnlyFraud((v) => !v)}
            className="accent-red-600"
          />
          <span>Show only fraud nodes</span>
        </label>

        {/* Legend */}
        <div className="space-y-2">
          <LegendDot color="#7f1d1d" label="Fraud" />
          <LegendDot color="#14532d" label="Normal" />
          <LegendDot color="rgba(100,140,255,0.5)" label="Transaction" />
        </div>

        {/* Bundle layout legend when active */}
        {isBundled && (
          <div className="mt-3 pt-3 border-t border-zinc-700 space-y-1 text-xs text-gray-400">
            <p className="font-medium text-gray-300 mb-1">Clusters</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-900" />
              <span>Fraud accounts</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-900" />
              <span>Low connectivity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-700" />
              <span>Mid connectivity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>High connectivity</span>
            </div>
          </div>
        )}

        {/* Reset view */}
        <button
          onClick={handleResetView}
          className="mt-4 w-full py-2 text-sm
                     bg-zinc-800 hover:bg-zinc-700
                     border border-zinc-700
                     rounded-md text-gray-300 transition"
        >
          Reset View
        </button>

        {/* Bundle layout toggle */}
        <button
          onClick={handleToggleBundle}
          className={`mt-2 w-full py-2 text-sm rounded-md border transition
            ${
              isBundled
                ? "bg-blue-900/40 border-blue-500 text-blue-300"
                : "bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-gray-300"
            }`}
        >
          {isBundled ? "⬡ Bundle Layout ON" : "⬡ Bundle Layout OFF"}
        </button>
      </div>

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-20 left-6 z-20 flex flex-col gap-3">
        {[
          { label: "+", fn: handleZoomIn },
          { label: "−", fn: handleZoomOut },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="w-12 h-12 rounded-full
                       bg-zinc-900/80 backdrop-blur-xl
                       border border-zinc-800
                       text-white text-xl
                       hover:border-blue-500
                       hover:shadow-[0_0_10px_rgba(59,130,246,0.4)]
                       transition duration-200"
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 3D Graph ── */}
      <ForceGraph3D
        ref={fgRef}
        graphData={visibleGraph}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#050814"
        enableNodeDrag={false}
        linkWidth={0.3}
        d3ForceStrength={isBundled ? 0 : -160}
        d3VelocityDecay={isBundled ? 1 : 0.28}
        nodeLabel={getNodeLabel}
        nodeThreeObject={buildNodeObject}
        linkColor={getLinkColor}
        linkOpacity={getLinkOpacity}
        onNodeClick={handleNodeClick}
        onEngineStop={() => {
          if (!hasFitted.current) {
            fgRef.current?.zoomToFit(800);
            hasFitted.current = true;
          }
        }}
      />
    </div>
  );
}