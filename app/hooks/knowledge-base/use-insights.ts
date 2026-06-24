"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InsightGenerationProgress,
  InsightsProgressResponse,
  InsightsResponse,
  InsightsRunResponse,
  ViewKey,
} from "@/app/types";
import { createId, parseJson } from "@/lib/utils";

type UseInsightsParams = {
  activeView: ViewKey;
};

export function useInsights({
  activeView,
}: UseInsightsParams) {
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [insightProgress, setInsightProgress] =
    useState<InsightGenerationProgress | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isRunningInsights, setIsRunningInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const stopInsightProgressPolling = useCallback(() => {
    if (progressPollRef.current) {
      clearInterval(progressPollRef.current);
      progressPollRef.current = null;
    }
  }, []);

  useEffect(() => stopInsightProgressPolling, [stopInsightProgressPolling]);

  const pollInsightProgress = useCallback(async (jobId: string) => {
    try {
      const data = await parseJson<InsightsProgressResponse>(
        await fetch(
          `/api/insights/run-background?jobId=${encodeURIComponent(jobId)}`,
          { cache: "no-store" },
        ),
      );

      if (!data.progress) {
        return;
      }

      setInsightProgress(data.progress);

      if (data.progress.status !== "active") {
        stopInsightProgressPolling();
      }
    } catch {
      // The generation request reports the user-facing error; progress polling is best-effort.
    }
  }, [stopInsightProgressPolling]);

  const startInsightProgressPolling = useCallback((jobId: string) => {
    stopInsightProgressPolling();
    progressPollRef.current = setInterval(() => {
      void pollInsightProgress(jobId);
    }, 900);
    void pollInsightProgress(jobId);
  }, [pollInsightProgress, stopInsightProgressPolling]);

  const refreshInsights = useCallback(async () => {
    setIsLoadingInsights(true);

    try {
      const data = await parseJson<InsightsResponse>(
        await fetch("/api/insights", { cache: "no-store" }),
      );
      setInsights(data);
      setInsightsError(null);
    } catch (error) {
      setInsightsError(
        error instanceof Error ? error.message : "Failed to load insights.",
      );
    } finally {
      setIsLoadingInsights(false);
    }
  }, []);

  const generateInsights = useCallback(async (folderId?: string) => {
    const jobId = createId("insight");

    setIsRunningInsights(true);
    setInsightProgress({
      jobId,
      status: "active",
      percent: 0,
      processedDocuments: 0,
      totalDocuments: 0,
      currentDocumentName: null,
      label: "Preparing generation",
      detail: null,
      updatedAt: Date.now(),
    });
    startInsightProgressPolling(jobId);

    try {
      const result = await parseJson<InsightsRunResponse>(
        await fetch("/api/insights/run-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId, jobId }),
        }),
      );

      await pollInsightProgress(jobId);

      if (result.started || result.changed) {
        await refreshInsights();
      }

      setInsightsError(null);
      setInsightProgress(null);
    } catch (error) {
      await pollInsightProgress(jobId);
      setInsightsError(
        error instanceof Error ? error.message : "Failed to generate insights.",
      );
    } finally {
      stopInsightProgressPolling();
      setIsRunningInsights(false);
    }
  }, [
    pollInsightProgress,
    refreshInsights,
    startInsightProgressPolling,
    stopInsightProgressPolling,
  ]);

  useEffect(() => {
    if (activeView === "insights") {
      void Promise.resolve().then(refreshInsights);
    }
  }, [activeView, refreshInsights]);

  return {
    insights,
    insightProgress,
    isLoadingInsights,
    isRunningInsights,
    insightsError,
    refreshInsights,
    generateInsights,
  };
}
