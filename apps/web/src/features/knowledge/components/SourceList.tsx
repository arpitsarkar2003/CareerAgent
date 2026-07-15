"use client";

import {
  Button,
  EmptyState,
  LoadingState,
  Modal,
  useToast,
} from "@/components/ui";
import {
  deleteSource,
  type KnowledgeSource,
  type SourceType,
} from "@/services/knowledge";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";

const TYPE_LABEL: Record<SourceType, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  project: "Project",
  note: "Note",
};

type SourceListProps = {
  sources: KnowledgeSource[];
  loading: boolean;
  selected: { source_type: SourceType; source_name: string } | null;
  onSelect: (source: KnowledgeSource) => void;
  onChanged: () => void;
  /** intake = larger cards; detail = compact rail */
  variant?: "intake" | "detail";
};

export function SourceList({
  sources,
  loading,
  selected,
  onSelect,
  onChanged,
  variant = "detail",
}: SourceListProps) {
  const { getToken } = useAuth();
  const { push } = useToast();
  const [pending, setPending] = useState<KnowledgeSource | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!pending) return;
    const token = await getToken();
    if (!token) return;
    setBusy(true);
    try {
      await deleteSource(token, pending.source_type, pending.source_name);
      push("success", "Source deleted");
      setPending(null);
      onChanged();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingState label="Loading sources" rows={2} />;
  }

  if (sources.length === 0) {
    return (
      <EmptyState
        title="No sources yet"
        description="Ingest a resume or note on the left — it will show up here."
      />
    );
  }

  if (variant === "intake") {
    return (
      <>
        <ul className="flex w-full flex-col gap-3">
          {sources.map((source) => (
            <li
              key={`${source.source_type}:${source.source_name}`}
              className="w-full"
            >
              <div className="group relative flex w-full flex-col rounded-2xl border border-soft-stone-200 bg-white p-4 transition-colors hover:border-soft-coral hover:bg-soft-coral-soft/30">
                <div className="flex w-full items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelect(source)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-sans text-sm font-semibold text-soft-stone">
                      {source.source_name}
                    </p>
                    <p className="mt-2 font-sans text-xs text-soft-muted">
                      {TYPE_LABEL[source.source_type]} · {source.chunk_count}{" "}
                      chunk{source.chunk_count === 1 ? "" : "s"}
                    </p>
                    <p className="mt-3 font-sans text-xs font-medium text-soft-stone-400 transition-colors group-hover:text-soft-stone">
                      Open chunks →
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="danger"
                    className="shrink-0"
                    onClick={() => setPending(source)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <Modal
          open={pending != null}
          title="Delete entire source?"
          onClose={() => setPending(null)}
          onConfirm={confirmDelete}
          confirmLabel="Delete source"
          busy={busy}
        >
          {pending
            ? `This deletes all chunks for “${pending.source_name}”.`
            : null}
        </Modal>
      </>
    );
  }

  return (
    <>
      <ul className="divide-y divide-soft-stone-200 overflow-hidden rounded-2xl border border-soft-stone-200 bg-white">
        {sources.map((source) => {
          const active =
            selected?.source_type === source.source_type &&
            selected?.source_name === source.source_name;
          return (
            <li key={`${source.source_type}:${source.source_name}`}>
              <div
                className={`flex items-center gap-2 px-3 py-3 transition-colors ${
                  active ? "bg-soft-coral-soft/50" : "hover:bg-soft-stone-50"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(source)}
                >
                  <p className="truncate font-sans text-sm font-medium text-soft-stone">
                    {source.source_name}
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-soft-muted">
                    {TYPE_LABEL[source.source_type]} · {source.chunk_count}{" "}
                    chunk{source.chunk_count === 1 ? "" : "s"}
                  </p>
                </button>
                <Button
                  size="sm"
                  variant="danger"
                  className="shrink-0"
                  onClick={() => setPending(source)}
                >
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={pending != null}
        title="Delete entire source?"
        onClose={() => setPending(null)}
        onConfirm={confirmDelete}
        confirmLabel="Delete source"
        busy={busy}
      >
        {pending
          ? `This deletes all chunks for “${pending.source_name}”.`
          : null}
      </Modal>
    </>
  );
}
