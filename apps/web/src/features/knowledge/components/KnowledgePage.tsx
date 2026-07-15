"use client";

import { DashboardShell } from "@/components/layout";
import {
  Button,
  EmptyState,
  LoadingState,
  useToast,
} from "@/components/ui";
import {
  listChunks,
  listSources,
  type KnowledgeChunk,
  type KnowledgeSource,
  type SourceType,
} from "@/services/knowledge";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { ChunkEditor } from "./ChunkEditor";
import { SourceList } from "./SourceList";
import { SourceUploadForm } from "./SourceUploadForm";

type Stage = "intake" | "detail";

export function KnowledgePage() {
  return (
    <DashboardShell title="Knowledge Base" fillHeight>
      <KnowledgeContent />
    </DashboardShell>
  );
}

function KnowledgeContent() {
  const { getToken, isLoaded } = useAuth();
  const { push } = useToast();
  const [stage, setStage] = useState<Stage>("intake");
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [selected, setSelected] = useState<{
    source_type: SourceType;
    source_name: string;
  } | null>(null);
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  const refreshSources = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    setSourcesLoading(true);
    try {
      const page = await listSources(token, { limit: 50, offset: 0 });
      setSources(page.items);
      setSelected((prev) => {
        if (!prev) return null;
        const still = page.items.find(
          (s) =>
            s.source_type === prev.source_type &&
            s.source_name === prev.source_name,
        );
        return still
          ? {
              source_type: still.source_type,
              source_name: still.source_name,
            }
          : null;
      });
    } catch (err) {
      push(
        "error",
        err instanceof Error ? err.message : "Failed to load sources",
      );
    } finally {
      setSourcesLoading(false);
    }
  }, [getToken, push]);

  const refreshChunks = useCallback(async () => {
    if (!selected || stage !== "detail") {
      setChunks([]);
      return;
    }
    const token = await getToken();
    if (!token) return;
    setChunksLoading(true);
    try {
      const pageSize = 100;
      const first = await listChunks(
        token,
        selected.source_type,
        selected.source_name,
        { limit: pageSize, offset: 0 },
      );
      const all = [...first.items];
      let offset = first.items.length;
      while (offset < first.total) {
        const next = await listChunks(
          token,
          selected.source_type,
          selected.source_name,
          { limit: pageSize, offset },
        );
        all.push(...next.items);
        if (next.items.length === 0) break;
        offset += next.items.length;
      }
      setChunks(all);
    } catch (err) {
      push(
        "error",
        err instanceof Error ? err.message : "Failed to load chunks",
      );
    } finally {
      setChunksLoading(false);
    }
  }, [getToken, push, selected, stage]);

  useEffect(() => {
    if (!isLoaded) return;
    void refreshSources();
  }, [isLoaded, refreshSources]);

  useEffect(() => {
    void refreshChunks();
  }, [refreshChunks]);

  useEffect(() => {
    if (stage === "detail" && !selected && !sourcesLoading) {
      setStage("intake");
    }
  }, [stage, selected, sourcesLoading]);

  function openSource(source: KnowledgeSource) {
    setSelected({
      source_type: source.source_type,
      source_name: source.source_name,
    });
    setStage("detail");
  }

  function backToIntake() {
    setStage("intake");
    setSelected(null);
    setChunks([]);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {stage === "intake" ? (
        <div
          key="intake"
          className="kb-stage grid min-h-0 flex-1 gap-6 lg:grid-cols-2"
        >
          <aside className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            <SourceUploadForm
              onIngested={() => {
                void refreshSources();
              }}
            />
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="mb-3 shrink-0">
              <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-soft-muted">
                Your sources
              </h2>
              <p className="mt-1 font-sans text-sm text-soft-muted">
                Click a card to browse its chunks.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-soft-stone-200 bg-soft-stone-50/40 p-4">
              <SourceList
                variant="intake"
                sources={sources}
                loading={sourcesLoading}
                selected={null}
                onSelect={openSource}
                onChanged={() => {
                  void refreshSources();
                }}
              />
            </div>
          </section>
        </div>
      ) : (
        <div
          key="detail"
          className="kb-stage grid min-h-0 flex-1 gap-6 lg:grid-cols-[17.5rem_minmax(0,1fr)]"
        >
          <aside className="flex min-h-0 flex-col gap-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-soft-muted">
                Sources
              </h2>
              <Button size="sm" variant="secondary" onClick={backToIntake}>
                Add
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <SourceList
                variant="detail"
                sources={sources}
                loading={sourcesLoading}
                selected={selected}
                onSelect={openSource}
                onChanged={() => {
                  void refreshSources().then(() => {
                    /* selected cleared in refreshSources if source gone */
                  });
                }}
              />
            </div>
          </aside>

          <section className="flex min-h-0 flex-col">
            <div className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-soft-muted">
                  Chunks
                </h2>
                <p className="mt-1 truncate font-sans text-lg font-semibold tracking-tight text-soft-stone">
                  {selected?.source_name}
                </p>
              </div>
              {!chunksLoading ? (
                <p className="font-sans text-xs text-soft-muted">
                  {chunks.length} chunk{chunks.length === 1 ? "" : "s"}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-soft-stone-200 bg-white px-4 sm:px-5">
              {chunksLoading ? (
                <div className="py-6">
                  <LoadingState label="Loading chunks" rows={4} />
                </div>
              ) : chunks.length === 0 ? (
                <div className="py-10">
                  <EmptyState
                    title="No chunks"
                    description="This source has no chunks yet."
                  />
                </div>
              ) : (
                <div>
                  {chunks.map((chunk, i) => (
                    <ChunkEditor
                      key={chunk.id}
                      chunk={chunk}
                      index={i}
                      onChanged={() => {
                        void refreshChunks();
                        void refreshSources();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
