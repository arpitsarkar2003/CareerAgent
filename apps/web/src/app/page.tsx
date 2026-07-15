"use client";

import { SoftGrain } from "@/components/softly/SoftGrain";
import { useEffect, useState } from "react";

type ApiStatus = "checking" | "ok" | "down";

const year = new Date().getFullYear();

export default function Home() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
    let cancelled = false;

    fetch(`${apiBaseUrl}/health`)
      .then((res) => {
        if (cancelled) return;
        setApiStatus(res.ok ? "ok" : "down");
      })
      .catch(() => {
        if (!cancelled) setApiStatus("down");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const statusCopy =
    apiStatus === "checking"
      ? "Checking…"
      : apiStatus === "ok"
        ? "API online"
        : "API offline";

  const statusDot =
    apiStatus === "checking"
      ? "bg-soft-stone-400"
      : apiStatus === "ok"
        ? "bg-[#7c9a84]"
        : "bg-soft-coral";

  return (
    <>
      <SoftGrain />

      <main className="relative flex min-h-[100svh] flex-col px-5 py-6 sm:px-8 sm:py-8">
        {/* Top left — API health */}
        <div
          className="absolute left-5 top-6 z-[1] flex items-center gap-2 sm:left-8 sm:top-8"
          role="status"
          aria-live="polite"
        >
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${statusDot}`}
            aria-hidden="true"
          />
          <span className="font-sans text-xs font-medium tracking-tight text-soft-muted sm:text-sm">
            {statusCopy}
          </span>
        </div>

        {/* Center hero */}
        <div className="relative z-[1] mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center text-center">
          <div
            className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-48 w-48 -translate-x-1/2 rounded-full bg-soft-coral-soft opacity-50 blur-3xl sm:h-64 sm:w-64"
            aria-hidden="true"
          />

          <h1 className="font-script text-4xl font-bold tracking-tight text-soft-stone sm:text-5xl md:text-6xl">
            Career Agent
          </h1>

          <p className="mt-4 max-w-sm font-sans text-sm leading-relaxed text-soft-muted sm:text-base">
            Personal job-application assistant.
            <br className="hidden sm:block" /> You review. You submit.
          </p>

          <div className="mt-10 w-full max-w-xs rounded-[2rem] bg-soft-white px-8 py-10 soft-shadow sm:max-w-sm">
            <p className="font-sans text-xl text-soft-coral">
              launching soon
            </p>
            <p className="mt-3 font-sans text-sm text-soft-muted">
              Quietly under construction.
            </p>
          </div>
        </div>

        {/* Bottom copyright */}
        <footer className="relative z-[1] pt-8 text-center">
          <p className="font-sans text-xs text-soft-stone-400">
            © {year} Career Agent
          </p>
        </footer>
      </main>
    </>
  );
}
