import { apiRequest } from "@/services/api-client";

export type HealthResponse = {
  status: string;
};

export type DbHealthResponse = {
  status: string;
  db: string;
};

/** GET /health — process liveness */
export async function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}

/** GET /health/db — Supabase connectivity */
export async function getDbHealth(): Promise<DbHealthResponse> {
  return apiRequest<DbHealthResponse>("/health/db");
}

export type ApiReachability = "ok" | "down";

/** True if the API process responds OK (does not require DB). */
export async function checkApiReachable(): Promise<ApiReachability> {
  try {
    const data = await getHealth();
    return data.status === "ok" ? "ok" : "down";
  } catch {
    return "down";
  }
}
