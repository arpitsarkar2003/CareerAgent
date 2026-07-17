"use client";

import { DashboardShell } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import {
  getPosting,
  listPostings,
  runSearch,
  scorePosting,
  type ConnectorRunResult,
  type JobPosting,
  type SearchConfig,
} from "@/services/search";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { ConnectorStatusList } from "./ConnectorStatusList";
import { PostingsList } from "./PostingsList";
import { SearchConfigForm } from "./SearchConfigForm";

const PAGE_SIZE = 20;
const DEFAULT_THRESHOLD = 80;

export function SearchPage() {
  return (
    <DashboardShell title="Search">
      <SearchContent />
    </DashboardShell>
  );
}

function SearchContent() {
  const { getToken, isLoaded } = useAuth();
  const { push } = useToast();
  const [running, setRunning] = useState(false);
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [lastRun, setLastRun] = useState<ConnectorRunResult[] | null>(null);
  const [lastTotals, setLastTotals] = useState<{
    matched: number;
    inserted: number;
    skipped: number;
  } | null>(null);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [showBelowThreshold, setShowBelowThreshold] = useState(false);
  const [scoringProgress, setScoringProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  // Postings this session's scoring attempts left with score = null,
  // forced into view even when the default (above-threshold) filter would
  // otherwise hide them — a scoring failure must never look like nothing
  // happened (Module 5 acceptance criterion).
  const [failedPostings, setFailedPostings] = useState<Map<string, JobPosting>>(
    new Map(),
  );
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  const refreshPostings = useCallback(
    async (
      nextOffset = offset,
      opts: { threshold?: number; includeBelow?: boolean } = {},
    ) => {
      const token = await getToken();
      if (!token) return;
      const effectiveThreshold = opts.threshold ?? threshold;
      const effectiveIncludeBelow = opts.includeBelow ?? showBelowThreshold;
      setLoading(true);
      try {
        const page = await listPostings(token, {
          limit: PAGE_SIZE,
          offset: nextOffset,
          minScore: effectiveIncludeBelow ? undefined : effectiveThreshold,
          includeUnscored: effectiveIncludeBelow,
        });
        setPostings(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (err) {
        push(
          "error",
          err instanceof Error ? err.message : "Failed to load postings",
        );
      } finally {
        setLoading(false);
      }
    },
    [getToken, offset, threshold, showBelowThreshold, push],
  );

  useEffect(() => {
    if (!isLoaded) return;
    void refreshPostings(0);
    // Initial load only when auth is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  function onConfigSaved(config: SearchConfig) {
    setThreshold(config.score_threshold);
    void refreshPostings(0, { threshold: config.score_threshold });
  }

  function onToggleBelowThreshold(next: boolean) {
    setShowBelowThreshold(next);
    void refreshPostings(0, { includeBelow: next });
  }

  async function scoreQueue(
    token: string,
    ids: string[],
  ): Promise<{ scored: number; failed: number }> {
    let scored = 0;
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      setScoringProgress({ current: i + 1, total: ids.length });
      const id = ids[i];
      try {
        await scorePosting(token, id);
        scored += 1;
        setFailedPostings((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      } catch {
        failed += 1;
        try {
          const detail = await getPosting(token, id);
          setFailedPostings((prev) => new Map(prev).set(id, detail));
        } catch {
          push(
            "error",
            "Couldn't load details for a posting that failed to score",
          );
        }
      }
    }
    setScoringProgress(null);
    return { scored, failed };
  }

  async function onRetryScore(posting: JobPosting) {
    const token = await getToken();
    if (!token) {
      push("error", "Sign in required");
      return;
    }
    setRetryingIds((prev) => new Set(prev).add(posting.id));
    try {
      await scorePosting(token, posting.id);
      setFailedPostings((prev) => {
        if (!prev.has(posting.id)) return prev;
        const next = new Map(prev);
        next.delete(posting.id);
        return next;
      });
      push("success", "Posting re-scored");
      await refreshPostings();
    } catch (err) {
      push(
        "error",
        err instanceof Error ? err.message : "Retry scoring failed",
      );
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(posting.id);
        return next;
      });
    }
  }

  async function onRunSearch() {
    const token = await getToken();
    if (!token) {
      push("error", "Sign in required");
      return;
    }
    setRunning(true);
    try {
      const result = await runSearch(token);
      setLastRun(result.connectors);
      setLastTotals({
        matched: result.total_matched,
        inserted: result.total_inserted,
        skipped: result.total_skipped_duplicates,
      });

      const failedConnectors = result.connectors.filter(
        (c) => c.status === "failed" || c.status === "partial",
      );
      if (failedConnectors.length === result.connectors.length) {
        push("error", "Search finished but every connector failed");
      } else if (failedConnectors.length > 0) {
        push(
          "error",
          `Search finished with issues: ${failedConnectors.map((f) => f.source).join(", ")}`,
        );
      } else {
        push(
          "success",
          `Search complete — ${result.total_inserted} new posting${result.total_inserted === 1 ? "" : "s"}`,
        );
      }

      if (result.scoring_queue.length > 0) {
        const { scored, failed } = await scoreQueue(
          token,
          result.scoring_queue,
        );
        if (failed > 0) {
          push(
            "error",
            `Scored ${scored} of ${result.scoring_queue.length} new postings — ${failed} failed, retry below`,
          );
        } else {
          push(
            "success",
            `Scored all ${scored} new posting${scored === 1 ? "" : "s"}`,
          );
        }
      }
      await refreshPostings(0);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Search failed");
    } finally {
      setRunning(false);
    }
  }

  // Force visibility of this-session failures even when the default
  // (above-threshold) filter would otherwise exclude a null score.
  const extraFailed = Array.from(failedPostings.values()).filter(
    (p) => !postings.some((existing) => existing.id === p.id),
  );
  const visiblePostings = [...postings, ...extraFailed];

  const justScoredEmpty =
    !loading &&
    !showBelowThreshold &&
    visiblePostings.length === 0 &&
    (lastTotals?.inserted ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-xl font-semibold text-soft-stone">
            Job search
          </h1>
          <p className="mt-1 max-w-xl font-sans text-sm text-soft-muted">
            Fetch postings from Greenhouse, Lever, and Ashby, then score each
            one against your profile. Nothing runs on a schedule — only when
            you click Run search.
          </p>
        </div>
        <Button
          onClick={() => void onRunSearch()}
          disabled={running || !isLoaded}
          className="shrink-0"
        >
          {running
            ? scoringProgress
              ? `Scoring ${scoringProgress.current} of ${scoringProgress.total}…`
              : "Searching…"
            : "Run search"}
        </Button>
      </div>

      <SearchConfigForm onSaved={onConfigSaved} />

      {lastRun ? (
        <ConnectorStatusList results={lastRun} totals={lastTotals ?? undefined} />
      ) : null}

      <PostingsList
        postings={visiblePostings}
        loading={loading}
        total={total}
        limit={PAGE_SIZE}
        offset={offset}
        onPageChange={(next) => void refreshPostings(next)}
        threshold={threshold}
        showBelowThreshold={showBelowThreshold}
        onToggleBelowThreshold={onToggleBelowThreshold}
        scoringProgress={running ? scoringProgress : null}
        onRetry={(posting) => void onRetryScore(posting)}
        retryingIds={retryingIds}
        justScoredEmpty={justScoredEmpty}
      />
    </div>
  );
}
