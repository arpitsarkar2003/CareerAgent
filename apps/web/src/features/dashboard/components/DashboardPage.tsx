import { SoftGrain } from "@/components/softly/SoftGrain";
import { requireUser } from "@/features/auth/lib/requireUser";
import { SiteFooter } from "@/features/legal/components/SiteFooter";
import { APP_NAME } from "@/lib/constants";
import { AUTH_ROUTES } from "@/services/auth";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export async function DashboardPage() {
  await requireUser();

  return (
    <>
      <SoftGrain />
      <main className="relative flex min-h-[100svh] flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="relative z-[1] flex items-center justify-between">
          <Link
            href={AUTH_ROUTES.afterSignOut}
            className="font-script text-2xl font-bold tracking-tight text-soft-stone sm:text-3xl"
          >
            {APP_NAME}
          </Link>
          <UserButton />
        </header>

        <div className="relative z-[1] mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-16">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-soft-stone sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-3 font-sans text-sm leading-relaxed text-soft-muted sm:text-base">
            You&apos;re signed in. Knowledge upload and drafting land here in
            Module 2.
          </p>
        </div>

        <div className="relative z-[1] mt-auto pt-8">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
