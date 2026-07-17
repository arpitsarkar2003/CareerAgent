"use client";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Toggle,
} from "@/components/ui";
import type { JobPosting } from "@/services/search";
import { useState } from "react";

type PostingsListProps = {
  postings: JobPosting[];
  loading: boolean;
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  threshold: number;
  showBelowThreshold: boolean;
  onToggleBelowThreshold: (value: boolean) => void;
  scoringProgress: { current: number; total: number } | null;
  onRetry: (posting: JobPosting) => void;
  retryingIds: Set<string>;
  justScoredEmpty: boolean;
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

function ScoreBadge({
  posting,
  threshold,
}: {
  posting: JobPosting;
  threshold: number;
}) {
  if (posting.score === null) {
    return <Badge variant="calm">Scoring failed</Badge>;
  }
  const passed = posting.score >= threshold;
  return (
    <Badge variant={passed ? "accent" : "muted"}>
      {Math.round(posting.score)} · {passed ? "Good match" : "Below threshold"}
    </Badge>
  );
}

function ReasoningPanel({ posting }: { posting: JobPosting }) {
  const reasoning = posting.score_reasoning;
  if (!reasoning) {
    return (
      <p className="mt-3 font-sans text-xs text-soft-muted">
        No reasoning available.
      </p>
    );
  }
  return (
    <div className="mt-3 grid gap-3 border-t border-soft-stone-200 pt-3 sm:grid-cols-2">
      <div>
        <h4 className="font-sans text-xs font-semibold text-soft-stone">
          Skills matched
        </h4>
        {reasoning.skills_matched.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1">
            {reasoning.skills_matched.map((skill) => (
              <li key={skill}>
                <Badge variant="accent">{skill}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-sans text-xs text-soft-muted">None noted</p>
        )}
      </div>
      <div>
        <h4 className="font-sans text-xs font-semibold text-soft-stone">
          Skills missing
        </h4>
        {reasoning.skills_missing.length > 0 ? (
          <ul className="mt-1 flex flex-wrap gap-1">
            {reasoning.skills_missing.map((skill) => (
              <li key={skill}>
                <Badge variant="muted">{skill}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 font-sans text-xs text-soft-muted">None noted</p>
        )}
      </div>
      <div>
        <h4 className="font-sans text-xs font-semibold text-soft-stone">
          Location fit
        </h4>
        <p className="mt-1 font-sans text-xs text-soft-muted">
          {reasoning.location_fit || "Not noted"}
        </p>
      </div>
      <div>
        <h4 className="font-sans text-xs font-semibold text-soft-stone">
          Experience fit
        </h4>
        <p className="mt-1 font-sans text-xs text-soft-muted">
          {reasoning.experience_fit || "Not noted"}
        </p>
      </div>
    </div>
  );
}

export function PostingsList({
  postings,
  loading,
  total,
  limit,
  offset,
  onPageChange,
  threshold,
  showBelowThreshold,
  onToggleBelowThreshold,
  scoringProgress,
  onRetry,
  retryingIds,
  justScoredEmpty,
}: PostingsListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Card className="flex min-h-[320px] flex-col">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-sans text-base font-semibold text-soft-stone">
            New postings
          </h2>
          <p className="mt-1 font-sans text-sm text-soft-muted">
            Sorted by score. Threshold is {threshold} — below-threshold
            postings are hidden by default.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {!loading ? (
            <span className="font-sans text-xs text-soft-muted">
              {total} total
            </span>
          ) : null}
          <Toggle
            checked={showBelowThreshold}
            onChange={onToggleBelowThreshold}
            label="Show below-threshold"
          />
        </div>
      </div>

      {scoringProgress ? (
        <div className="mb-4 rounded-xl border border-soft-stone-200 bg-soft-lavender/50 px-4 py-2.5">
          <p className="font-sans text-sm text-soft-stone">
            Scoring {scoringProgress.current} of {scoringProgress.total}…
          </p>
        </div>
      ) : null}

      {loading ? (
        <LoadingState rows={5} />
      ) : postings.length === 0 ? (
        justScoredEmpty ? (
          <EmptyState
            title="Nothing over your threshold this run"
            description="Lower your score threshold in Search settings, or turn on “Show below-threshold” to see everything this run found."
          />
        ) : (
          <EmptyState
            title="No postings yet"
            description="Configure boards and filters, then click Run search. Results will show up here, sorted by score."
          />
        )
      ) : (
        <>
          <ul className="flex flex-1 flex-col gap-3">
            {postings.map((p) => {
              const expanded = expandedIds.has(p.id);
              const retrying = retryingIds.has(p.id);
              const failed = p.score === null;
              return (
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
                    <div className="flex flex-col items-end gap-1.5">
                      <ScoreBadge posting={p} threshold={threshold} />
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

                  <div className="mt-2 flex items-center gap-3">
                    {!failed ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(p.id)}
                        className="font-sans text-xs font-medium text-soft-muted hover:text-soft-coral"
                      >
                        {expanded ? "Hide reasoning" : "Show reasoning"}
                      </button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={retrying}
                        onClick={() => onRetry(p)}
                      >
                        {retrying ? "Retrying…" : "Retry scoring"}
                      </Button>
                    )}
                  </div>

                  {expanded && !failed ? <ReasoningPanel posting={p} /> : null}
                </li>
              );
            })}
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
