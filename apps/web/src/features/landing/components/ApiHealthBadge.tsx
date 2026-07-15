"use client";

import type { ApiStatus } from "@/features/landing/hooks/useApiHealth";

const copy: Record<ApiStatus, string> = {
  checking: "Checking…",
  ok: "API online",
  down: "API offline",
};

const dot: Record<ApiStatus, string> = {
  checking: "bg-soft-stone-400",
  ok: "bg-[#7c9a84]",
  down: "bg-soft-coral",
};

type ApiHealthBadgeProps = {
  status: ApiStatus;
};

export function ApiHealthBadge({ status }: ApiHealthBadgeProps) {
  return (
    <div
      className="absolute left-5 top-6 z-[1] flex items-center gap-2 sm:left-8 sm:top-8"
      role="status"
      aria-live="polite"
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${dot[status]}`}
        aria-hidden="true"
      />
      <span className="font-sans text-xs font-medium tracking-tight text-soft-muted sm:text-sm">
        {copy[status]}
      </span>
    </div>
  );
}
