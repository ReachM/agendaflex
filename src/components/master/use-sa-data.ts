"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

export function useSAData<T>(url: string, options?: { refreshInterval?: number }) {
  const refreshInterval = options?.refreshInterval;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<T>(url);
      setData(result);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(() => void reload(), refreshInterval);
    return () => clearInterval(id);
  }, [refreshInterval, reload]);

  return { data, error, loading, reload };
}
