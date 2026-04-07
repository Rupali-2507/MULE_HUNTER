"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import * as THREE from "three";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string | number;
  is_anomalous: boolean;
  anomalyScore?: number;   // 0–1, higher = more fraudulent
  volume?: number;
  pagerank?: number;       // 0–1, higher = more central
  role?: "HUB" | "BRIDGE" | "MULE" | "NORMAL";
  clusterId?: number;
  clusterFraudRate?: number;
  ringIds?: number[];
  shapFactors?: { label: string; value: number }[];
  x?: number;
  y?: number;
  z?: number;
  // internal – set by force graph after simulation
  __threeObj?: THREE.Object3D;
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
}

interface TourRing {
  ringId: number;
  label: string;
  shape: "STAR" | "CHAIN" | "CYCLE" | "DENSE";
  members: (string | number)[];
  description: string;
}

interface FraudGraph3DProps {
  onNodeSelect: (node: GraphNode | null) => void;
  selectedNode: GraphNode | null;
  alertedNodeId?: string | number | null;
  // filter state passed down from page
  riskThreshold: number;
  showOnlyFraud: boolean;
  showOnlyRings: boolean;
  searchId: string;
  // lift stats up to sidebar
  onStatsUpdate?: (s: { totalNodes: number; fraudNodes: number; rings: number }) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveId(ep: string | number | GraphNode): string | number {
  return typeof ep === "object" ? ep.id : ep;
}

/** Map anomalyScore 0–1 → THREE.Color on a green→yellow→red scale */
function riskColor(score: number, opacity = 1): THREE.Color {
  // green  #22c55e  → yellow #eab308  → red #ef4444
  if (score < 0.45) {
    // green → yellow
    const t = score / 0.45;
    return new THREE.Color().lerpColors(
      new THREE.Color("#22c55e"),
      new THREE.Color("#eab308"),
      t
    );
  }
  // yellow → red
  const t = (score - 0.45) / 0.55;
  return new THREE.Color().lerpColors(
    new THREE.Color("#eab308"),
    new THREE.Color("#ef4444"),
    t
  );
}

function riskHex(score: number): string {
  return "#" + riskColor(score).getHexString();
}

/** Scale pagerank 0–1 → sphere radius 2–10 */
function nodeRadius(n: GraphNode): number {
  const pr = n.pagerank ?? 0;
  return 2 + pr * 8;
}

// ─── Tour rings (demo data – replace with live data from /detect-rings) ───────

const DEMO_TOUR_RINGS: TourRing[] = [
  {
    ringId: 1,
    label: "Star Ring #1",
    shape: "STAR",
    members: [],
    description:
      "One hub account (HUB) distributes stolen UPI funds to 7 mule accounts before cash-out.",
  },
  {
    ringId: 2,
    label: "Chain Ring #1",
    shape: "CHAIN",
    members: [],
    description:
      "Sequential layering — funds hop A→B→C→D across 4 accounts to obscure trail.",
  },
  {
    ringId: 3,
    label: "Cycle Ring #1",
    shape: "CYCLE",
    members: [],
    description:
      "Circular flow — funds loop between accounts to simulate legitimate transactions.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function FraudGraph3D({
  onNodeSelect,
  selectedNode,
  alertedNodeId,
  riskThreshold,
  showOnlyFraud,
  showOnlyRings,
  searchId,
  onStatsUpdate,
}: FraudGraph3DProps) {
  const fgRef = useRef<any>(null);
const API_BASE = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "";
  // ── Dynamic import of 3-D force graph (client-only) ──
  const [ForceGraph3D, setForceGraph3D] =
    useState<React.ComponentType<any> | null>(null);
  const [mounted, setMounted] = useState(false);

  // ── Data ──
  const [rawGraph, setRawGraph] = useState<RawGraph | null>(null);
  const [loading, setLoading] = useState(true);

  // ── UI state ──
  const [activeNodeId, setActiveNodeId] = useState<string | number | null>(
    null
  );
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<"all" | "fraud" | "rings">("all");
  const [isBundled, setIsBundled] = useState(false);

  // ── Guided tour ──
  const [tourActive, setTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourRings, setTourRings] = useState<TourRing[]>(DEMO_TOUR_RINGS);
  const tourTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Stats overlay ──
  const [stats, setStats] = useState({
    totalNodes: 0,
    fraudNodes: 0,
    totalEdges: 0,
    rings: 0,
  });

  const hasFitted = useRef(false);

  // ── Mount / resize ──
  useEffect(() => {
    setMounted(true);
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    import("react-force-graph-3d").then((mod) =>
      setForceGraph3D(() => mod.default)
    );
  }, []);

  // ── Load graph data ──
  useEffect(() => {
    if (!mounted) return;
    setLoading(true);

    async function loadGraph() {
      try {
       
        const res = await fetch(`${API_BASE}/api/graph`);
const data = await res.json();

console.log("TOTAL NODES:", data.nodes.length);
// console.log("FRAUD NODES:", data.nodes.filter(n => n.is_anomalous).length);

        // ── DEBUG: log first raw node so we can see exact field names ──
        if (data.nodes?.length > 0) {
          console.log("[MuleHunter] Raw node sample:", JSON.stringify(data.nodes[0], null, 2));
          console.log("[MuleHunter] Raw link sample:", JSON.stringify(data.links?.[0], null, 2));
          console.log("[MuleHunter] Top-level keys:", Object.keys(data));
        }

        const nodes: GraphNode[] = data.nodes.map((n: any): GraphNode => {
          // ── is_anomalous: try every known field name ──
          const isAnom = !!(
            n.isAnomalous ?? n.is_anomalous ?? n.anomalous ??
            n.isFraud ?? n.is_fraud ?? n.fraud ?? false
          );

          // ── anomalyScore: EIF returns negative path-length scores, GNN returns 0-1 ──
          // Collect every possible score field
          const candidates = [
            n.anomalyScore, n.gnnScore, n.riskScore, n.score,
            n.fraudScore, n.eifScore, n.risk,
          ].filter((v) => v != null && !isNaN(v));

          let rawScore = candidates.length > 0 ? candidates[0] : 0;

          // EIF scores are typically negative (more negative = more anomalous)
          // Normalise to 0-1 if negative
          if (rawScore < 0) {
            rawScore = Math.min(1, Math.abs(rawScore));
          }

          // If flagged anomalous but score is still near 0, set a visible floor
          const score = isAnom && rawScore < 0.5 ? Math.max(rawScore, 0.82) : rawScore;

          // ── ringIds ──
          let ringIds: number[] = [];
          if (Array.isArray(n.ringIds)) ringIds = n.ringIds.map(Number);
          else if (Array.isArray(n.ring_ids)) ringIds = n.ring_ids.map(Number);
          else if (n.ringId != null) ringIds = [Number(n.ringId)];
          else if (n.ring_id != null) ringIds = [Number(n.ring_id)];
          // Treat anomalous nodes as ring members even without explicit ringIds
          if (isAnom && ringIds.length === 0) {
            const cid = n.clusterId ?? n.cluster_id ?? n.community;
            if (cid != null) ringIds = [Number(cid)];
            else ringIds = [1]; // synthetic — still shows in ring filter
          }

          // ── role ──
          const role: GraphNode["role"] =
            n.role ?? n.nodeRole ?? n.node_role ??
            (isAnom && (n.pagerank ?? n.pageRank ?? 0) > 0.5 ? "HUB" :
             isAnom && ringIds.length > 0 ? "BRIDGE" :
             isAnom ? "MULE" : "NORMAL");

          return {
            id: n.nodeId ?? n.node_id ?? n.id,
            is_anomalous: isAnom,
            anomalyScore: Math.min(1, Math.max(0, score)),
            volume: n.volume ?? n.txCount ?? n.tx_count ?? n.transactionCount ?? 0,
            pagerank: n.pagerank ?? n.pageRank ?? n.page_rank ?? 0,
            role,
            clusterId: n.clusterId ?? n.cluster_id ?? n.community,
            clusterFraudRate: n.clusterFraudRate ?? n.cluster_fraud_rate,
            ringIds,
            shapFactors: n.shapFactors ?? n.shap_factors ?? [],
          };
        });

        const links: GraphLink[] = (data.links ?? data.edges ?? [])
          .filter((l: any) => (l.source ?? l.from) && (l.target ?? l.to))
          .map((l: any) => ({
            source: String(l.source ?? l.from ?? l.sourceId),
            target: String(l.target ?? l.to ?? l.targetId),
          }));

        console.log(`[MuleHunter] Mapped: ${nodes.length} nodes, ${nodes.filter(n=>n.is_anomalous).length} fraud, ${links.length} links`);

        setRawGraph({ nodes, links });
        const fraudCount = nodes.filter((n) => n.is_anomalous).length;
        const ringCount = data.rings ?? data.ringCount ?? data.ring_count ??
          nodes.filter(n => (n.ringIds?.length ?? 0) > 0).length;
        const newStats = {
          totalNodes: nodes.length,
          fraudNodes: fraudCount,
          totalEdges: links.length,
          rings: ringCount,
        };
        setStats(newStats);
        onStatsUpdate?.({ totalNodes: nodes.length, fraudNodes: fraudCount, rings: ringCount });

        // Try to load real ring data for tour
        try {
          const ringRes = await fetch(`${API_BASE}/detect-rings`);
          const ringData = await ringRes.json();
          if (ringData?.rings?.length) {
            const top5: TourRing[] = ringData.rings
              .slice(0, 5)
              .map((r: any, i: number) => ({
                ringId: r.ringId ?? i + 1,
                label: `${r.shape ?? "Ring"} Ring #${r.ringId ?? i + 1}`,
                shape: r.shape ?? "STAR",
                members: r.members ?? [],
                description: r.description ?? `High-risk ${r.shape ?? "ring"} structure detected.`,
              }));
            setTourRings(top5);
          }
        } catch {
          // keep demo rings
        }
      } catch (err) {
        console.error("Graph load failed", err);
        // Generate synthetic demo data so the graph isn't empty
        generateDemoGraph();
      } finally {
        setLoading(false);
      }
    }

    loadGraph();
  }, [mounted, API_BASE]);

  // ── Synthetic demo data (fallback when API is unreachable) ──
  function generateDemoGraph() {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    for (let c = 0; c < 8; c++) {
      const isFraudCluster = c < 3;
      const clusterSize = 15 + Math.floor(Math.random() * 20);

      for (let i = 0; i < clusterSize; i++) {
        const id = `${c}_${i}`;
        const score = isFraudCluster
          ? 0.65 + Math.random() * 0.35   // always clearly red
          : Math.random() * 0.35;          // always clearly green
        const isAnom = score > 0.6;

        const role: GraphNode["role"] =
          i === 0 && isFraudCluster ? "HUB" :
          i < 3 && isFraudCluster ? "BRIDGE" :
          isAnom ? "MULE" : "NORMAL";

        nodes.push({
          id,
          is_anomalous: isAnom,
          anomalyScore: score,
          pagerank: i === 0 ? 0.85 : Math.random() * 0.3,
          role,
          clusterId: c,
          clusterFraudRate: isFraudCluster ? 0.7 : 0.05,
          volume: Math.floor(Math.random() * 200) + 10,
          ringIds: isFraudCluster ? [c + 1] : [],
        });

        if (i > 0) links.push({ source: `${c}_0`, target: id });
      }
      if (isFraudCluster && c > 0) links.push({ source: `${c}_0`, target: `0_0` });
    }

    setRawGraph({ nodes, links });
    const fraudCount = nodes.filter(n => n.is_anomalous).length;
    const newStats = { totalNodes: nodes.length, fraudNodes: fraudCount, totalEdges: links.length, rings: 5 };
    setStats(newStats);
    onStatsUpdate?.({ totalNodes: nodes.length, fraudNodes: fraudCount, rings: 5 });
  }

  // ── Apply filters ──
  const visibleGraph = useMemo<RawGraph | null>(() => {
    if (!rawGraph) return null;

    let nodes = rawGraph.nodes;

    // 1. Risk threshold — only apply to anomalous nodes (don't hide clean nodes by threshold)
    if (riskThreshold > 0) {
      nodes = nodes.filter(
        (n) => !n.is_anomalous || (n.anomalyScore ?? 0) >= riskThreshold
      );
    }

    // 2. Show only fraud
    if (showOnlyFraud || viewMode === "fraud") {
      nodes = nodes.filter((n) => n.is_anomalous);
    }

    // 3. Show only ring members — fallback to anomalous nodes if no ringIds populated
    if (showOnlyRings || viewMode === "rings") {
      const hasRingData = rawGraph.nodes.some((n) => (n.ringIds?.length ?? 0) > 0);
      if (hasRingData) {
        nodes = nodes.filter((n) => (n.ringIds?.length ?? 0) > 0);
      } else {
        // Fallback: treat all anomalous nodes as ring members
        nodes = nodes.filter((n) => n.is_anomalous);
      }
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = rawGraph.links.filter(
      (l) => nodeIds.has(resolveId(l.source)) && nodeIds.has(resolveId(l.target))
    );

    // 4. Cap at 500 highest-risk nodes to avoid hairball
    const sorted = [...nodes].sort(
      (a, b) => (b.anomalyScore ?? 0) - (a.anomalyScore ?? 0)
    );
    const capped = sorted.slice(0, 500);
    const cappedIds = new Set(capped.map((n) => n.id));
    const cappedLinks = links.filter(
      (l) =>
        cappedIds.has(resolveId(l.source)) && cappedIds.has(resolveId(l.target))
    );

    return { nodes: capped, links: cappedLinks };
  }, [rawGraph, riskThreshold, showOnlyFraud, showOnlyRings, viewMode]);

  // ── Focus / neighbour set ──
  const focusData = useMemo<FocusData>(() => {
    if (!activeNodeId || !visibleGraph)
      return { neighborSet: new Set() };

    const neighborSet = new Set<string | number>([activeNodeId]);
    visibleGraph.links.forEach((link) => {
      const s = resolveId(link.source);
      const t = resolveId(link.target);
      if (s === activeNodeId) neighborSet.add(t);
      if (t === activeNodeId) neighborSet.add(s);
    });

    return { neighborSet };
  }, [activeNodeId, visibleGraph]);

  // ── Search effect ──
  useEffect(() => {
    if (!searchId.trim() || !rawGraph) return;
    const node = rawGraph.nodes.find(
      (n) => String(n.id) === searchId.trim()
    );
    if (!node) return;
    setActiveNodeId(node.id);
    onNodeSelect(node);
    setTimeout(() => focusCameraOnNode(node), 400);
  }, [searchId]);

  // ── Camera helpers ──
  const focusCameraOnNode = useCallback((node: GraphNode) => {
    if (!fgRef.current || node.x === undefined) return;
    const distance = 80;
    const mag = Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0) || 1;
    const ratio = 1 + distance / mag;
    fgRef.current.cameraPosition(
      {
        x: (node.x ?? 0) * ratio,
        y: (node.y ?? 0) * ratio,
        z: (node.z ?? 0) * ratio,
      },
      node,
      800
    );
  }, []);

  // ── Guided Tour ──
  const startTour = useCallback(() => {
    setTourActive(true);
    setTourStep(0);
    advanceTour(0);
  }, [tourRings]);

  const advanceTour = useCallback(
    (step: number) => {
      if (step >= tourRings.length) {
        setTourActive(false);
        setTourStep(0);
        return;
      }

      setTourStep(step);
      const ring = tourRings[step];

      // Highlight ring members
      if (ring.members.length > 0) {
        const firstMember = ring.members[0];
        const node = rawGraph?.nodes.find((n) => n.id === firstMember);
        if (node) {
          setActiveNodeId(firstMember);
          setTimeout(() => focusCameraOnNode(node), 300);
        }
      } else {
        // Zoom to a random fraud cluster for demo
        const fraudNode = rawGraph?.nodes.find(
          (n) => n.is_anomalous && n.role === "HUB"
        );
        if (fraudNode) {
          setActiveNodeId(fraudNode.id);
          setTimeout(() => focusCameraOnNode(fraudNode), 300);
        }
      }

      tourTimerRef.current = setTimeout(() => advanceTour(step + 1), 4500);
    },
    [tourRings, rawGraph, focusCameraOnNode]
  );

  const stopTour = useCallback(() => {
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    setTourActive(false);
    setTourStep(0);
    setActiveNodeId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    };
  }, []);

  // ── Node object builder ──
  const buildNodeObject = useCallback(
    (node: GraphNode): THREE.Group => {
      const isActive = node.id === activeNodeId;
      const isNeighbor = focusData.neighborSet.has(node.id);
      const hasSearch = searchId.trim() !== "";
      const matchesSearch = String(node.id).includes(searchId.trim());

      const score = node.anomalyScore ?? 0;
      const color = riskColor(score);
      const radius = nodeRadius(node);

      // Opacity logic
      let opacity = 1;
      if (activeNodeId) {
        opacity = isActive ? 1 : isNeighbor ? 0.75 : 0.08;
      } else if (hasSearch) {
        opacity = matchesSearch ? 1 : 0.1;
      }

      const group = new THREE.Group();

      // Core sphere
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 28, 28),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity,
          roughness: 0.4,
          metalness: 0.2,
          emissive: color,
          emissiveIntensity: score > 0.75 ? 0.3 : 0.08,
        })
      );
      group.add(sphere);

      // Role ring — HUB gets bold outer ring, BRIDGE gets dashed
      if (node.role === "HUB" && (isActive || !activeNodeId)) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 1.55, 0.35, 8, 32),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color("#ef4444"),
            transparent: true,
            opacity: opacity * 0.9,
          })
        );
        group.add(ring);
      } else if (node.role === "BRIDGE" && (isActive || !activeNodeId)) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 1.45, 0.2, 8, 24),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color("#f97316"),
            transparent: true,
            opacity: opacity * 0.75,
          })
        );
        group.add(ring);
      }

      // Selection wireframe
      if (isActive) {
        const wire = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 1.35, 16, 16),
          new THREE.MeshBasicMaterial({
            color: "#60a5fa",
            wireframe: true,
            transparent: true,
            opacity: 0.6,
          })
        );
        group.add(wire);

        // Pulse ring for selected node
        const pulse = new THREE.Mesh(
          new THREE.TorusGeometry(radius * 2, 0.15, 8, 32),
          new THREE.MeshBasicMaterial({
            color: "#3b82f6",
            transparent: true,
            opacity: 0.4,
          })
        );
        group.add(pulse);
      }

      // Tour highlight glow
      if (
        tourActive &&
        tourRings[tourStep]?.members.includes(node.id)
      ) {
        const glow = new THREE.Mesh(
          new THREE.SphereGeometry(radius * 2, 16, 16),
          new THREE.MeshBasicMaterial({
            color: "#facc15",
            transparent: true,
            opacity: 0.18,
          })
        );
        group.add(glow);
      }

      return group;
    },
    [activeNodeId, focusData, searchId, tourActive, tourStep, tourRings]
  );

  // ── Link styling ──
  const getLinkColor = useCallback(
    (link: GraphLink): string => {
      const s = resolveId(link.source);
      const t = resolveId(link.target);

      const sNode =
        typeof link.source === "object"
          ? (link.source as GraphNode)
          : visibleGraph?.nodes.find((n) => n.id === s);
      const tNode =
        typeof link.target === "object"
          ? (link.target as GraphNode)
          : visibleGraph?.nodes.find((n) => n.id === t);

      const isFraudLink = sNode?.is_anomalous && tNode?.is_anomalous;

      if (!activeNodeId) {
        // No selection: fraud→fraud = bright red, rest = bright blue-white so edges are visible
        if (isFraudLink) return "rgba(239,68,68,0.9)";
        return "rgba(100,140,220,0.65)";
      }

      const connected = s === activeNodeId || t === activeNodeId;
      if (!connected) return "rgba(255,255,255,0.04)";
      if (isFraudLink) return "#ef4444";
      return "#60a5fa";
    },
    [activeNodeId, visibleGraph]
  );

  const getLinkWidth = useCallback(
    (link: GraphLink): number => {
      const s = resolveId(link.source);
      const t = resolveId(link.target);
      const sNode =
        typeof link.source === "object"
          ? (link.source as GraphNode)
          : visibleGraph?.nodes.find((n) => n.id === s);
      const tNode =
        typeof link.target === "object"
          ? (link.target as GraphNode)
          : visibleGraph?.nodes.find((n) => n.id === t);
      const isFraudLink = sNode?.is_anomalous && tNode?.is_anomalous;

      if (!activeNodeId) return isFraudLink ? 1.2 : 0.6;
      return (s === activeNodeId || t === activeNodeId) ? 1.5 : 0.08;
    },
    [activeNodeId, visibleGraph]
  );

  // ── Node label tooltip ──
  const getNodeLabel = useCallback((node: GraphNode): string => {
    const score = node.anomalyScore ?? 0;
    const hex = riskHex(score);
    const role = node.role ?? "NORMAL";
    const roleEmoji =
      role === "HUB" ? "🔴" : role === "BRIDGE" ? "🟠" : role === "MULE" ? "⚪" : "🟢";

    return `
      <div style="
        background:rgba(8,10,18,0.97);
        padding:12px 16px;
        border-radius:10px;
        border:1px solid ${hex};
        font-size:12px;
        color:#e5e7eb;
        min-width:180px;
        box-shadow:0 0 20px ${hex}44;
      ">
        <div style="font-weight:700;font-size:13px;color:${hex};margin-bottom:6px;">
          ${roleEmoji} Account ${node.id}
        </div>
        <div style="display:flex;flex-direction:column;gap:3px;">
          <div>Role: <b style="color:${hex}">${role}</b></div>
          <div>Risk Score: <b style="color:${hex}">${(score * 100).toFixed(1)}%</b></div>
          <div>PageRank: <b>${((node.pagerank ?? 0) * 100).toFixed(1)}%</b></div>
          <div>Transactions: <b>${node.volume ?? 0}</b></div>
          ${
            (node.ringIds?.length ?? 0) > 0
              ? `<div style="margin-top:4px;color:#facc15;font-size:11px;">⚠ Ring member</div>`
              : ""
          }
        </div>
      </div>
    `;
  }, []);

  // ── Handlers ──
  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      onNodeSelect(node);
      setActiveNodeId(node.id);
      focusCameraOnNode(node);
    },
    [onNodeSelect, focusCameraOnNode]
  );

  const handleResetView = useCallback(() => {
    setActiveNodeId(null);
    onNodeSelect(null);
    stopTour();
    fgRef.current?.zoomToFit(800);
  }, [onNodeSelect, stopTour]);

  const handleZoomIn = useCallback(() => {
    if (!fgRef.current) return;
    const cam = fgRef.current.camera() as THREE.PerspectiveCamera;
    fgRef.current.cameraPosition({ z: cam.position.z * 0.8 }, undefined, 400);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (!fgRef.current) return;
    const cam = fgRef.current.camera() as THREE.PerspectiveCamera;
    fgRef.current.cameraPosition({ z: cam.position.z * 1.2 }, undefined, 400);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────

  if (!mounted || !ForceGraph3D) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Initialising 3-D Engine…
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400 text-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          Loading transaction graph…
        </div>
      </div>
    );
  }

  const currentTourRing = tourActive ? tourRings[tourStep] : null;

  return (
    <div className="h-full w-full bg-black relative overflow-hidden">

      {/* ── Stats bar (top center) ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-1">
        {[
          { label: "Accounts", value: stats.totalNodes.toLocaleString(), color: "#60a5fa" },
          { label: "Fraud Nodes", value: stats.fraudNodes.toLocaleString(), color: "#ef4444" },
          { label: "Edges", value: stats.totalEdges.toLocaleString(), color: "#94a3b8" },
          { label: "Mule Rings", value: stats.rings.toLocaleString(), color: "#facc15" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="px-3 py-1.5 rounded-md text-center"
            style={{
              background: "rgba(10,12,22,0.85)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="text-xs font-mono" style={{ color }}>
              {value}
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* ── View mode tabs (top right) ── */}
      <div
        className="absolute top-4 right-4 z-20 flex gap-1 rounded-lg p-1"
        style={{
          background: "rgba(10,12,22,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {(
          [
            { id: "all", label: "All" },
            { id: "fraud", label: "Fraud Only" },
            { id: "rings", label: "Ring Members" },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setViewMode(id)}
            className="px-3 py-1.5 text-xs rounded-md transition-all"
            style={{
              background:
                viewMode === id ? "rgba(59,130,246,0.25)" : "transparent",
              color: viewMode === id ? "#60a5fa" : "#6b7280",
              border:
                viewMode === id
                  ? "1px solid rgba(59,130,246,0.4)"
                  : "1px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Guided Tour caption ── */}
      {tourActive && currentTourRing && (
        <div
          className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 max-w-md w-full"
          style={{
            background: "rgba(8,10,18,0.96)",
            border: "1px solid rgba(250,204,21,0.4)",
            borderRadius: "12px",
            padding: "16px 20px",
            backdropFilter: "blur(12px)",
            boxShadow: "0 0 30px rgba(250,204,21,0.15)",
          }}
        >
          {/* Progress dots */}
          <div className="flex gap-1.5 mb-3">
            {tourRings.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all"
                style={{
                  background: i <= tourStep ? "#facc15" : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>
          <div className="flex items-start gap-3">
            <div
              className="text-xs font-mono px-2 py-1 rounded flex-shrink-0"
              style={{
                background: "rgba(250,204,21,0.15)",
                color: "#facc15",
                border: "1px solid rgba(250,204,21,0.3)",
              }}
            >
              {currentTourRing.shape}
            </div>
            <div>
              <div className="text-sm font-semibold text-white mb-1">
                {currentTourRing.label}
              </div>
              <div className="text-xs text-gray-400 leading-relaxed">
                {currentTourRing.description}
              </div>
            </div>
          </div>
          <button
            onClick={stopTour}
            className="mt-3 text-xs text-gray-500 hover:text-gray-300 transition"
          >
            Stop tour ✕
          </button>
        </div>
      )}

      {/* ── Bottom controls ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {/* Guided tour */}
        <button
          onClick={tourActive ? stopTour : startTour}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            background: tourActive
              ? "rgba(250,204,21,0.2)"
              : "rgba(250,204,21,0.1)",
            border: "1px solid rgba(250,204,21,0.4)",
            color: "#facc15",
          }}
        >
          {tourActive
            ? `⏹ Stop Tour (${tourStep + 1}/${tourRings.length})`
            : "▶ Detective Tour"}
        </button>

        {/* Reset */}
        <button
          onClick={handleResetView}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            background: "rgba(30,32,44,0.85)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#9ca3af",
          }}
        >
          ↺ Reset View
        </button>

        {/* Bundle toggle */}
        <button
          onClick={() => {
            setIsBundled((v) => !v);
            hasFitted.current = false;
          }}
          className="px-4 py-2 text-xs font-medium rounded-lg transition-all"
          style={{
            background: isBundled
              ? "rgba(59,130,246,0.2)"
              : "rgba(30,32,44,0.85)",
            border: isBundled
              ? "1px solid rgba(59,130,246,0.5)"
              : "1px solid rgba(255,255,255,0.1)",
            color: isBundled ? "#60a5fa" : "#9ca3af",
          }}
        >
          ⬡ {isBundled ? "Bundled" : "Bundle Layout"}
        </button>
      </div>

      {/* ── Zoom controls ── */}
      <div className="absolute bottom-24 right-4 z-20 flex flex-col gap-2">
        {[
          { label: "+", fn: handleZoomIn },
          { label: "−", fn: handleZoomOut },
        ].map(({ label, fn }) => (
          <button
            key={label}
            onClick={fn}
            className="w-9 h-9 rounded-full text-sm font-bold transition-all"
            style={{
              background: "rgba(10,12,22,0.85)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#9ca3af",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Risk legend ── */}
      <div
        className="absolute bottom-6 left-4 z-20 text-xs"
        style={{
          background: "rgba(10,12,22,0.85)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "10px",
          padding: "12px 14px",
        }}
      >
        <div className="text-gray-500 mb-2 font-mono text-[10px] uppercase tracking-wider">
          Risk Scale
        </div>
        <div
          className="w-28 h-2 rounded-full mb-1.5"
          style={{
            background:
              "linear-gradient(to right, #22c55e, #eab308, #ef4444)",
          }}
        />
        <div className="flex justify-between text-gray-500 text-[10px]">
          <span>Low</span>
          <span>High</span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          {[
            { symbol: "●", color: "#ef4444", label: "HUB — ring organiser" },
            { symbol: "◆", color: "#f97316", label: "BRIDGE — connector" },
            { symbol: "○", color: "#94a3b8", label: "MULE — forwarder" },
          ].map(({ symbol, color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span style={{ color, fontSize: 10 }}>{symbol}</span>
              <span className="text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3D Force Graph ── */}
      <ForceGraph3D
        key={isBundled ? "bundled" : "free"}
        ref={fgRef}
        graphData={visibleGraph ?? { nodes: [], links: [] }}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#050814"
        enableNodeDrag={false}
        linkWidth={getLinkWidth}
        linkColor={getLinkColor}
        nodeLabel={getNodeLabel}
        nodeThreeObject={buildNodeObject}
        nodeThreeObjectExtend={false}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => {
          setActiveNodeId(null);
          onNodeSelect(null);
        }}
        d3AlphaDecay={isBundled ? 0.04 : 0.02}
        d3VelocityDecay={isBundled ? 0.6 : 0.28}
        onEngineStop={() => {
          if (!hasFitted.current) {
            fgRef.current?.zoomToFit(800);
            hasFitted.current = true;
          }
        }}
        d3Force={isBundled ? (forceName: string, force: any) => {
          // In bundle mode: cluster nodes by clusterId using radial positioning
          if (forceName === "charge") force.strength(-60);
          if (forceName === "link") force.distance(30).strength(0.8);
        } : (forceName: string, force: any) => {
          if (forceName === "charge") force.strength(-180);
          if (forceName === "link") force.distance(50).strength(0.5);
        }}
      />
    </div>
  );
}