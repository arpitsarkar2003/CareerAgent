"use client";

import {
  checkApiReachable,
  type ApiReachability,
} from "@/services/health";
import { useEffect, useState } from "react";

export type ApiStatus = "checking" | ApiReachability;

export function useApiHealth(): ApiStatus {
  const [status, setStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    checkApiReachable().then((result) => {
      if (!cancelled) setStatus(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
