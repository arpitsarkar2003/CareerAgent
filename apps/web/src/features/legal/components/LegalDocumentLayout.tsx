import { SoftGrain } from "@/components/softly/SoftGrain";
import { SiteFooter } from "@/features/legal/components/SiteFooter";
import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import type { ReactNode } from "react";

type LegalDocumentLayoutProps = {
  title: string;
  children: ReactNode;
};

export function LegalDocumentLayout({
  title,
  children,
}: LegalDocumentLayoutProps) {
  return (
    <>
      <SoftGrain />
      <main className="relative mx-auto flex min-h-[100svh] w-full max-w-2xl flex-col px-5 py-8 sm:px-8 sm:py-10">
        <header className="relative z-[1] mb-10 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-script text-2xl font-bold tracking-tight text-soft-stone sm:text-3xl"
          >
            {APP_NAME}
          </Link>
          <Link
            href="/"
            className="font-sans text-xs font-medium text-soft-muted transition-colors hover:text-soft-stone sm:text-sm"
          >
            Home
          </Link>
        </header>

        <article className="relative z-[1] flex-1">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-soft-stone sm:text-3xl">
            {title}
          </h1>
          <div className="mt-8 space-y-6 font-sans text-sm leading-relaxed text-soft-muted sm:text-base [&_h2]:mt-10 [&_h2]:font-sans [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-soft-stone [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:text-soft-coral [&_a]:underline-offset-2 hover:[&_a]:underline">
            {children}
          </div>
        </article>

        <div className="relative z-[1] mt-12">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
