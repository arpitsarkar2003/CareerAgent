"use client";

import { useEffect, useState } from "react";

type ApiStatus = "checking" | "ok" | "down";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

    fetch(`${apiBaseUrl}/health`)
      .then((res) => (res.ok ? setApiStatus("ok") : setApiStatus("down")))
      .catch(() => setApiStatus("down"));
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Career Agent
      </h1>
      <p className="max-w-md text-base text-foreground/70">
        Launching soon. Your personal job-application assistant is being
        built.
      </p>
      <div className="flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-1.5 text-sm">
        <span
          className={`h-2 w-2 rounded-full ${
            apiStatus === "ok"
              ? "bg-green-500"
              : apiStatus === "down"
                ? "bg-red-500"
                : "bg-yellow-500"
          }`}
        />
        <span>
          API status:{" "}
          {apiStatus === "checking"
            ? "checking..."
            : apiStatus === "ok"
              ? "ok"
              : "unreachable"}
        </span>
      </div>
    </main>
  );
}
