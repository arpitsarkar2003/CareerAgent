"use client";

import { SoftGrain } from "@/components/softly/SoftGrain";
import { ToastProvider } from "@/components/ui";
import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

type DashboardShellProps = {
  title: string;
  children: ReactNode;
  /** Fill viewport height so nested panels can scroll independently. */
  fillHeight?: boolean;
};

export function DashboardShell({
  title,
  children,
  fillHeight = false,
}: DashboardShellProps) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <ToastProvider>
      <div
        className={`relative flex bg-soft-bg text-soft-stone ${
          fillHeight ? "h-[100svh] overflow-hidden" : "min-h-[100svh]"
        }`}
      >
        <SoftGrain />
        <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
        <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar title={title} onMenuClick={() => setNavOpen(true)} />
          <main
            className={`min-h-0 flex-1 px-4 py-5 md:px-6 md:py-6 ${
              fillHeight ? "flex flex-col overflow-hidden" : ""
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
