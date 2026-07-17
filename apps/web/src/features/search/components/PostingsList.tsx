"use client";

import {
  Button,
  Card,
  EmptyState,
  LoadingState,
} from "@/components/ui";
import type { JobPosting } from "@/services/search";

type PostingsListProps = {
  postings: JobPosting[];
  loading: boolean;
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

function snippet(text: string, max = 180): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max)}…`;
}

export function PostingsList({
  postings,
  loading,
  total,
  limit,
  offset,
  onPageChange,
}: PostingsListProps) {
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <Card className="flex min-h-[320px] flex-col">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-sans text-base font-semibold text-soft-stone">
            New postings
          </h2>
          <p className="mt-1 font-sans text-sm text-soft-muted">
            Unscored discoveries from your last search runs. Scoring comes in
            Module 5.
          </p>
        </div>
        {!loading ? (
          <span className="shrink-0 font-sans text-xs text-soft-muted">
            {total} total
          </span>
        ) : null}
      </div>

      {loading ? (
        <LoadingState rows={5} />
      ) : postings.length === 0 ? (
        <EmptyState
          title="No postings yet"
          description="Configure boards and filters, then click Run search. Results will show up here."
        />
      ) : (
        <>
          <ul className="flex flex-1 flex-col gap-3">
            {postings.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-soft-stone-200 bg-soft-white/70 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-sans text-sm font-semibold text-soft-stone">
                      {p.url ? (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-soft-coral hover:underline"
                        >
                          {p.title}
                        </a>
                      ) : (
                        p.title
                      )}
                    </h3>
                    <p className="mt-0.5 font-sans text-sm text-soft-muted">
                      {p.company}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="rounded-full bg-soft-stone-100 px-2 py-0.5 font-sans text-xs capitalize text-soft-stone">
                      {p.source ?? "unknown"}
                    </span>
                    <span className="font-sans text-xs text-soft-muted">
                      {formatDate(p.discovered_at ?? p.created_at)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 font-sans text-xs leading-relaxed text-soft-muted">
                  {snippet(p.raw_text)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between border-t border-soft-stone-200 pt-3">
            <Button
              variant="ghost"
              size="sm"
              disabled={!canPrev}
              onClick={() => onPageChange(Math.max(0, offset - limit))}
            >
              Previous
            </Button>
            <span className="font-sans text-xs text-soft-muted">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={!canNext}
              onClick={() => onPageChange(offset + limit)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
