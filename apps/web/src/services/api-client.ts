/**
 * Browser → apps/api HTTP client.
 * All feature services call through here — never fetch() from UI components.
 */

const DEFAULT_API_BASE = "http://localhost:8000";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = "http_error",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  /** Clerk session token (or other bearer). */
  token?: string | null;
  /** When true, send body as FormData / raw without JSON stringify. */
  rawBody?: boolean;
};

type Envelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
};

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers, token, rawBody, ...rest } = options;
  const url = `${getApiBaseUrl().replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const isForm =
    typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(url, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined && !isForm && !rawBody
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : isForm || rawBody
          ? (body as BodyInit)
          : JSON.stringify(body),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    if (!res.ok) {
      throw new ApiError(`API ${path} failed`, res.status);
    }
    return undefined as T;
  }

  const envelope = payload as Envelope<T>;
  if (
    envelope &&
    typeof envelope === "object" &&
    "ok" in envelope &&
    ("data" in envelope || "error" in envelope)
  ) {
    if (!envelope.ok || !res.ok) {
      throw new ApiError(
        envelope.error?.message ?? `API ${path} failed`,
        res.status,
        envelope.error?.code ?? "http_error",
      );
    }
    return envelope.data as T;
  }

  // Legacy / health routes without envelope
  if (!res.ok) {
    throw new ApiError(`API ${path} failed`, res.status);
  }
  return payload as T;
}
