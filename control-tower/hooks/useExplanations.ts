import { useEffect, useState } from "react";

/* ================= TYPES ================= */

export interface ExplanationData {
  reasons: string[];
  shapFactors: unknown[];
  anomalyScore?: number;
  isAnomalous?: boolean;
}

interface UseExplanationsReturn {
  explanation: ExplanationData | null;
  loading: boolean;
}

/* ================= HOOK ================= */

export default function useExplanations(
  nodeId: number | null
): UseExplanationsReturn {
  const [explanation, setExplanation] =
    useState<ExplanationData | null>(null);

  const [loading, setLoading] =
    useState<boolean>(false);

  const API_BASE =
    process.env.NEXT_PUBLIC_BACKEND_BASE_URL;

  useEffect(() => {
    if (nodeId === null || nodeId === undefined) {
      setExplanation(null);
      return;
    }

    if (!API_BASE) return;

    const controller = new AbortController();

    async function loadExplanation() {
      try {
        setLoading(true);

        const res = await fetch(
          `${API_BASE}/api/graph/node/${nodeId}`,
          { signal: controller.signal }
        );

        const text = await res.text();

        // Safety check: frontend HTML instead of API
        if (text.trim().startsWith("<")) {
          console.error(
            "HTML received instead of JSON"
          );
          return;
        }

        const data = JSON.parse(text);

        const formatted: ExplanationData = {
          reasons: data.reasons ?? [],
          shapFactors:
            data.shap_factors ??
            data.shapFactors ??
            [],
          anomalyScore: data.anomalyScore,
          isAnomalous: data.isAnomalous,
        };

        setExplanation(formatted);
      } catch (err: unknown) {
        if (
          err instanceof Error &&
          err.name !== "AbortError"
        ) {
          console.error(
            "Failed to load explanations:",
            err.message
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadExplanation();

    return () => controller.abort();
  }, [nodeId, API_BASE]);

  return { explanation, loading };
}