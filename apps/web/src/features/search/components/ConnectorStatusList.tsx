"use client";

import { Card } from "@/components/ui";
import type { ConnectorRunResult } from "@/services/search";

const STATUS_STYLES: Record<
  ConnectorRunResult["status"],
  { label: string; className: string }
> = {
  success: {
    label: "Success",
    className: "bg-soft-stone-100 text-soft-stone",
  },
  partial: {
    label: "Partial",
    className: "bg-soft-coral-soft text-soft-stone",
  },
  failed: {
    label: "Failed",
    className: "bg-soft-coral text-soft-stone",
  },
  skipped: {
    label: "Skipped",
    className: "bg-soft-stone-100 text-soft-muted",
  },
};

type ConnectorStatusListProps = {
  results: ConnectorRunResult[];
  totals?: {
    matched: number;
    inserted: number;
    skipped: number;
  };
};

export function ConnectorStatusList({
  results,
  totals,
}: ConnectorStatusListProps) {
  if (results.length === 0) return null;

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-sans text-base font-semibold text-soft-stone">
          Last run
        </h2>
        {totals ? (
          <p className="mt-1 font-sans text-sm text-soft-muted">
            {totals.inserted} new · {totals.skipped} duplicates skipped ·{" "}
            {totals.matched} matched filters
          </p>
        ) : null}
      </div>
      <ul className="space-y-2">
        {results.map((r) => {
          const style = STATUS_STYLES[r.status];
          return (
            <li
              key={r.source}
              className="flex flex-col gap-1 rounded-xl border border-soft-stone-200 bg-soft-white/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="font-sans text-sm font-medium capitalize text-soft-stone">
                  {r.source}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-sans text-xs font-medium ${style.className}`}
                >
                  {style.label}
                </span>
              </div>
              <div className="font-sans text-xs text-soft-muted">
                fetched {r.fetched} · matched {r.matched} · inserted{" "}
                {r.inserted}
                {r.message ? (
                  <span className="mt-0.5 block text-soft-coral sm:mt-0 sm:inline sm:before:content-['·_']">
                    {r.message}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
