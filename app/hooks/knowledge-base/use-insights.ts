"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  InsightsResponse,
  InsightsRunResponse,
  ViewKey,
} from "@/app/types";
import { parseJson } from "@/lib/utils";

const IDLE_DELAY_MS = 60000;
const BACKGROUND_POLL_MS = 10000;

type UseInsightsParams = {
  activeView: ViewKey;
  indexedDocumentsLength: number;
  isBusy: boolean;
};

export function useInsights({
  activeView,
  indexedDocumentsLength,
  isBusy,
}: UseInsightsParams) {
  const lastActivityRef = useRef(0);
  const isRunningRef = useRef(false);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isRunningInsights, setIsRunningInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

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

  const updateFolderInstruction = useCallback(
    async (folderId: string, instruction: string) => {
      const data = await parseJson<InsightsResponse>(
        await fetch("/api/insights", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ folderId, instruction }),
        }),
      );

      setInsights(data);
      setInsightsError(null);
    },
    [],
  );

  const generateInsights = useCallback(async (folderId?: string) => {
    setIsRunningInsights(true);

    try {
      const result = await parseJson<InsightsRunResponse>(
        await fetch("/api/insights/run-background", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: true, folderId }),
        }),
      );

      if (result.started || result.changed) {
        await refreshInsights();
      }

      setInsightsError(null);
    } catch (error) {
      setInsightsError(
        error instanceof Error ? error.message : "Failed to generate insights.",
      );
    } finally {
      setIsRunningInsights(false);
    }
  }, [refreshInsights]);

  useEffect(() => {
    if (activeView === "insights") {
      void Promise.resolve().then(refreshInsights);
    }
  }, [activeView, refreshInsights]);

  useEffect(() => {
    lastActivityRef.current = Date.now();

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];

    for (const eventName of events) {
      window.addEventListener(eventName, markActivity);
    }

    document.addEventListener("visibilitychange", markActivity);

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, markActivity);
      }

      document.removeEventListener("visibilitychange", markActivity);
    };
  }, []);

  useEffect(() => {
    const runIfIdle = async () => {
      if (
        isBusy ||
        isRunningRef.current ||
        indexedDocumentsLength === 0 ||
        document.visibilityState !== "visible" ||
        Date.now() - lastActivityRef.current < IDLE_DELAY_MS
      ) {
        return;
      }

      isRunningRef.current = true;
      setIsRunningInsights(true);

      try {
        const result = await parseJson<InsightsRunResponse>(
          await fetch("/api/insights/run-background", { method: "POST" }),
        );

        if (result.changed && activeView === "insights") {
          await refreshInsights();
        }

        setInsightsError(null);
      } catch (error) {
        setInsightsError(
          error instanceof Error ? error.message : "Failed to generate insights.",
        );
      } finally {
        isRunningRef.current = false;
        setIsRunningInsights(false);
      }
    };

    const interval = window.setInterval(() => {
      void runIfIdle();
    }, BACKGROUND_POLL_MS);

    return () => window.clearInterval(interval);
  }, [activeView, indexedDocumentsLength, isBusy, refreshInsights]);

  return {
    insights,
    isLoadingInsights,
    isRunningInsights,
    insightsError,
    refreshInsights,
    generateInsights,
    updateFolderInstruction,
  };
}
