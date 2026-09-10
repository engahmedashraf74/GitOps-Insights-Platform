"use client";

import { ApiError } from "@/services/api";
import {
  enrichApplications,
  loadWorkspaceSnapshot,
  type EnrichedApplication,
} from "@/services/workspace";
import type { WorkspaceSnapshot } from "@/lib/metrics";
import { useCallback, useEffect, useState } from "react";

interface WorkspaceState {
  loading: boolean;
  error: string | null;
  snapshot: WorkspaceSnapshot | null;
  applications: EnrichedApplication[];
  reload: () => void;
}

export function useWorkspace(enabled = true): WorkspaceState {
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadWorkspaceSnapshot()
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Workspace data could not be loaded.";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, tick]);

  return {
    loading,
    error,
    snapshot,
    applications: snapshot ? enrichApplications(snapshot) : [],
    reload,
  };
}
