"use client";

import { Button, Input, Textarea, useToast } from "@/components/ui";
import {
  ingestText,
  ingestUpload,
  type SourceType,
} from "@/services/knowledge";
import { useAuth } from "@clerk/nextjs";
import { useState, type FormEvent } from "react";

const SOURCE_OPTIONS: { value: SourceType; label: string }[] = [
  { value: "resume", label: "Resume" },
  { value: "cover_letter", label: "Cover letter" },
  { value: "project", label: "Project" },
  { value: "note", label: "Note" },
];

type SourceUploadFormProps = {
  onIngested: () => void;
};

export function SourceUploadForm({ onIngested }: SourceUploadFormProps) {
  const { getToken } = useAuth();
  const { push } = useToast();
  const [sourceType, setSourceType] = useState<SourceType>("resume");
  const [sourceName, setSourceName] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"paste" | "upload">("upload");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = await getToken();
    if (!token) {
      push("error", "Sign in required");
      return;
    }
    if (!sourceName.trim()) {
      push("error", "Give this source a name");
      return;
    }

    setBusy(true);
    try {
      if (mode === "upload" && file) {
        await ingestUpload(token, {
          source_type: sourceType,
          source_name: sourceName.trim(),
          file,
        });
      } else {
        if (!text.trim()) {
          push("error", "Paste some text or choose a file");
          setBusy(false);
          return;
        }
        await ingestText(token, {
          source_type: sourceType,
          source_name: sourceName.trim(),
          text: text.trim(),
        });
      }
      push("success", "Source ingested and embedded");
      setText("");
      setFile(null);
      onIngested();
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  const ready =
    Boolean(sourceName.trim()) &&
    (mode === "upload" ? Boolean(file) : Boolean(text.trim()));

  return (
    <div className="overflow-hidden rounded-2xl border border-soft-stone-200 bg-white">
      <div className="p-5">
        <h2 className="font-sans text-base font-semibold text-soft-stone">
          Add source
        </h2>
        <p className="mt-1 font-sans text-sm text-soft-muted">
          Paste or upload. Same name replaces prior chunks.
        </p>

        <form id="kb-ingest-form" onSubmit={onSubmit} className="mt-5 space-y-4">
          <fieldset className="space-y-2">
            <legend className="font-sans text-sm font-medium text-soft-stone">
              Type
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSourceType(opt.value)}
                  className={`rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-colors ${
                    sourceType === opt.value
                      ? "bg-soft-coral text-soft-stone"
                      : "bg-soft-stone-100 text-soft-muted hover:bg-soft-stone-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </fieldset>

          <Input
            label="Name"
            name="source_name"
            placeholder="e.g. Resume 2026"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            required
          />

          <div className="inline-flex rounded-lg bg-soft-stone-100 p-0.5">
            {(
              [
                ["upload", "Upload file"],
                ["paste", "Paste text"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`rounded-md px-3 py-1.5 font-sans text-xs font-medium ${
                  mode === value
                    ? "bg-white text-soft-stone soft-shadow"
                    : "text-soft-muted"
                }`}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "paste" ? (
            <Textarea
              label="Content"
              name="text"
              placeholder="Paste resume, letter, project, or notes…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
            />
          ) : (
            <label className="flex w-full flex-col gap-1.5 font-sans text-sm">
              <span className="font-medium text-soft-stone">File</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,text/plain,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="rounded-xl border border-soft-stone-200 bg-soft-bg px-3 py-2.5 text-sm text-soft-stone file:mr-3 file:rounded-lg file:border-0 file:bg-soft-coral file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
              {file ? (
                <span className="text-xs text-soft-muted">
                  Selected: {file.name}
                </span>
              ) : (
                <span className="text-xs text-soft-muted">
                  PDF, DOCX, or plain text
                </span>
              )}
            </label>
          )}
        </form>
      </div>

      <div className="border-t border-soft-stone-200 bg-soft-stone-50/80 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-sans text-xs leading-relaxed text-soft-muted">
            {busy
              ? "Chunking and embedding — this can take a moment."
              : ready
                ? "Ready to add to your knowledge base."
                : "Add a name and file (or paste text) to continue."}
          </p>
          <Button
            type="submit"
            form="kb-ingest-form"
            disabled={busy || !ready}
            className="w-full shrink-0 sm:w-auto sm:min-w-[11rem] px-4 py-2.5 rounded-xl border border-soft-stone-200 hover:bg-soft-coral-soft/30 hover:border-soft-coral cursor-pointer"
          >
            {busy ? "Adding…" : "Add to knowledge base"}
          </Button>
        </div>
      </div>
    </div>
  );
}
