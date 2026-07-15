"use client";

import { UserButton } from "@clerk/nextjs";

type TopBarProps = {
  title: string;
  onMenuClick: () => void;
};

export function TopBar({ title, onMenuClick }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-soft-stone-200 bg-soft-bg/90 px-4 backdrop-blur-sm md:h-16 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-soft-stone-200 bg-soft-white text-soft-stone md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <span className="sr-only">Menu</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 5h12M3 9h12M3 13h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="min-w-0">
          <p className="truncate font-sans text-xs text-soft-muted">Dashboard</p>
          <h1 className="truncate font-sans text-base font-semibold tracking-tight text-soft-stone md:text-lg">
            {title}
          </h1>
        </div>
      </div>
      <UserButton />
    </header>
  );
}
