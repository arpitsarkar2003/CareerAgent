import { apiRequest } from "@/services/api-client";

export type JobSource = "greenhouse" | "lever" | "ashby" | "manual";

export type SearchConfig = {
  user_id: string;
  role_keywords: string[];
  locations: string[];
  experience_levels: string[];
  greenhouse_boards: string[];
  lever_companies: string[];
  ashby_boards: string[];
  updated_at: string | null;
  created_at: string | null;
};

export type SearchConfigUpdate = {
  role_keywords?: string[];
  locations?: string[];
  experience_levels?: string[];
  greenhouse_boards?: string[];
  lever_companies?: string[];
  ashby_boards?: string[];
};

export type ConnectorRunStatus = "success" | "partial" | "failed" | "skipped";

export type ConnectorRunResult = {
  source: "greenhouse" | "lever" | "ashby";
  status: ConnectorRunStatus;
  fetched: number;
  matched: number;
  inserted: number;
  skipped_duplicates: number;
  message: string | null;
};

export type SearchRunResult = {
  connectors: ConnectorRunResult[];
  total_matched: number;
  total_inserted: number;
  total_skipped_duplicates: number;
  config: {
    role_keywords: string[];
    locations: string[];
    experience_levels: string[];
    greenhouse_boards: string[];
    lever_companies: string[];
    ashby_boards: string[];
  };
};

export type JobPosting = {
  id: string;
  company: string;
  title: string;
  url: string | null;
  raw_text: string;
  source: JobSource | null;
  score: number | null;
  external_id: string | null;
  discovered_at: string | null;
  created_at: string;
  auto_apply_eligible: boolean;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

function auth(token: string) {
  return { token };
}

export async function getSearchConfig(token: string): Promise<SearchConfig> {
  return apiRequest("/api/v1/search/config", auth(token));
}

export async function updateSearchConfig(
  token: string,
  body: SearchConfigUpdate,
): Promise<SearchConfig> {
  return apiRequest("/api/v1/search/config", {
    method: "PUT",
    body,
    ...auth(token),
  });
}

export async function runSearch(token: string): Promise<SearchRunResult> {
  return apiRequest("/api/v1/search/runs", {
    method: "POST",
    ...auth(token),
  });
}

export async function listPostings(
  token: string,
  opts: { limit?: number; offset?: number; source?: JobSource } = {},
): Promise<Paginated<JobPosting>> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  if (opts.source) params.set("source", opts.source);
  const qs = params.toString();
  return apiRequest(`/api/v1/search/postings${qs ? `?${qs}` : ""}`, auth(token));
}
