import { apiRequest } from "@/services/api-client";

export type SourceType = "resume" | "cover_letter" | "project" | "note";

export type KnowledgeSource = {
  source_type: SourceType;
  source_name: string;
  chunk_count: number;
  created_at: string;
};

export type KnowledgeChunk = {
  id: string;
  source_type: SourceType;
  source_name: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};

export type IngestResult = {
  source_type: SourceType;
  source_name: string;
  chunk_count: number;
  chunks: KnowledgeChunk[];
};

function auth(token: string) {
  return { token };
}

export async function listSources(
  token: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Paginated<KnowledgeSource>> {
  const params = new URLSearchParams();
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return apiRequest(`/api/v1/knowledge/sources${qs ? `?${qs}` : ""}`, auth(token));
}

export async function ingestText(
  token: string,
  body: { source_type: SourceType; source_name: string; text: string },
): Promise<IngestResult> {
  return apiRequest("/api/v1/knowledge/sources", {
    method: "POST",
    body,
    ...auth(token),
  });
}

export async function ingestUpload(
  token: string,
  fields: {
    source_type: SourceType;
    source_name: string;
    text?: string;
    file?: File | null;
  },
): Promise<IngestResult> {
  const form = new FormData();
  form.set("source_type", fields.source_type);
  form.set("source_name", fields.source_name);
  if (fields.text) form.set("text", fields.text);
  if (fields.file) form.set("file", fields.file);
  return apiRequest("/api/v1/knowledge/sources", {
    method: "POST",
    body: form,
    ...auth(token),
  });
}

export async function deleteSource(
  token: string,
  source_type: SourceType,
  source_name: string,
): Promise<{ source_type: SourceType; source_name: string; deleted: boolean }> {
  const params = new URLSearchParams({ source_type, source_name });
  return apiRequest(`/api/v1/knowledge/sources?${params}`, {
    method: "DELETE",
    ...auth(token),
  });
}

export async function listChunks(
  token: string,
  source_type: SourceType,
  source_name: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<Paginated<KnowledgeChunk>> {
  const params = new URLSearchParams({ source_type, source_name });
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.offset != null) params.set("offset", String(opts.offset));
  return apiRequest(`/api/v1/knowledge/chunks?${params}`, auth(token));
}

export async function updateChunk(
  token: string,
  chunkId: string,
  content: string,
): Promise<KnowledgeChunk> {
  return apiRequest(`/api/v1/knowledge/chunks/${chunkId}`, {
    method: "PATCH",
    body: { content },
    ...auth(token),
  });
}

export async function deleteChunk(
  token: string,
  chunkId: string,
): Promise<{ id: string; deleted: boolean }> {
  return apiRequest(`/api/v1/knowledge/chunks/${chunkId}`, {
    method: "DELETE",
    ...auth(token),
  });
}
