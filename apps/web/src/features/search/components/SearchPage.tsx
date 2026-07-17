"use client";

import { DashboardShell } from "@/components/layout";
import { Button, useToast } from "@/components/ui";
import {
  listPostings,
  runSearch,
  type ConnectorRunResult,
  type JobPosting,
} from "@/services/search";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { ConnectorStatusList } from "./ConnectorStatusList";
import { PostingsList } from "./PostingsList";
import { SearchConfigForm } from "./SearchConfigForm";

const PAGE_SIZE = 20;

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

  const refreshPostings = useCallback(
    async (nextOffset = offset) => {
      const token = await getToken();
      if (!token) return;
      setLoading(true);
      try {
        const page = await listPostings(token, {
          limit: PAGE_SIZE,
          offset: nextOffset,
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
    [getToken, offset, push],
  );

  useEffect(() => {
    if (!isLoaded) return;
    void refreshPostings(0);
    // Initial load only when auth is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

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

      const failed = result.connectors.filter(
        (c) => c.status === "failed" || c.status === "partial",
      );
      if (failed.length === result.connectors.length) {
        push("error", "Search finished but every connector failed");
      } else if (failed.length > 0) {
        push(
          "error",
          `Search finished with issues: ${failed.map((f) => f.source).join(", ")}`,
        );
      } else {
        push(
          "success",
          `Search complete — ${result.total_inserted} new posting${result.total_inserted === 1 ? "" : "s"}`,
        );
      }
      await refreshPostings(0);
    } catch (err) {
      push("error", err instanceof Error ? err.message : "Search failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-xl font-semibold text-soft-stone">
            Job search
          </h1>
          <p className="mt-1 max-w-xl font-sans text-sm text-soft-muted">
            Fetch postings from Greenhouse, Lever, and Ashby on demand. Nothing
            runs on a schedule — only when you click Run search.
          </p>
        </div>
        <Button
          onClick={() => void onRunSearch()}
          disabled={running || !isLoaded}
          className="shrink-0"
        >
          {running ? "Running…" : "Run search"}
        </Button>
      </div>

      <SearchConfigForm />

      {lastRun ? (
        <ConnectorStatusList results={lastRun} totals={lastTotals ?? undefined} />
      ) : null}

      <PostingsList
        postings={postings}
        loading={loading}
        total={total}
        limit={PAGE_SIZE}
        offset={offset}
        onPageChange={(next) => void refreshPostings(next)}
      />
    </div>
  );
}
