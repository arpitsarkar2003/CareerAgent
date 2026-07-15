"use client";

import { Button, Modal, Textarea, useToast } from "@/components/ui";
import {
  deleteChunk,
  updateChunk,
  type KnowledgeChunk,
} from "@/services/knowledge";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type ChunkEditorProps = {
  chunk: KnowledgeChunk;
  index: number;
  onChanged: () => void;
};

export function ChunkEditor({ chunk, index, onChanged }: ChunkEditorProps) {
  const { getToken } = useAuth();
  const { push } = useToast();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState(chunk.content);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setContent(chunk.content);
    setEditing(false);
  }, [chunk.id, chunk.content]);

  async function save() {
    const token = await getToken();
    if (!token) return;
    setBusy(true);
    try {
      await updateChunk(token, chunk.id, content);
      push("success", "Chunk saved and re-embedded");
      setEditing(false);
      onChanged();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const token = await getToken();
    if (!token) return;
    setBusy(true);
    try {
      await deleteChunk(token, chunk.id);
      push("success", "Chunk deleted");
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  }

  const label =
    [chunk.metadata?.role, chunk.metadata?.company, chunk.metadata?.section]
      .filter(Boolean)
      .map(String)
      .join(" · ") || `Chunk ${index + 1}`;

  const long = chunk.content.length > 220;
  const shown =
    expanded || editing || !long
      ? chunk.content
      : `${chunk.content.slice(0, 220).trimEnd()}…`;

  return (
    <>
      <article className="group relative border-b border-soft-stone-200/80 py-4 last:border-b-0">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 w-7 shrink-0 font-sans text-xs tabular-nums text-soft-stone-400">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="truncate font-sans text-xs font-medium uppercase tracking-wide text-soft-muted">
                {label}
              </p>
              <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {editing ? (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={save}
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setContent(chunk.content);
                        setEditing(false);
                      }}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(true)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>

            {editing ? (
              <Textarea
                className="mt-2"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
              />
            ) : (
              <>
                <p className="mt-1.5 whitespace-pre-wrap font-sans text-sm leading-relaxed text-soft-stone">
                  {shown}
                </p>
                {long ? (
                  <button
                    type="button"
                    className="mt-1 font-sans text-xs font-medium text-soft-muted underline-offset-2 hover:text-soft-stone hover:underline"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? "Show less" : "Show more"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </article>

      <Modal
        open={confirmDelete}
        title="Delete chunk?"
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        confirmLabel="Delete"
        busy={busy}
      >
        This removes the chunk permanently. You can re-ingest the source later.
      </Modal>
    </>
  );
}
