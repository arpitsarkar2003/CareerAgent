"use client";

import { SoftGrain } from "@/components/softly/SoftGrain";
import { AuthHeaderActions } from "@/features/auth/components/AuthHeaderActions";
import { ApiHealthBadge } from "@/features/landing/components/ApiHealthBadge";
import { LandingFooter } from "@/features/landing/components/LandingFooter";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { useApiHealth } from "@/features/landing/hooks/useApiHealth";

export function LandingPage() {
  const apiStatus = useApiHealth();

  return (
    <>
      <SoftGrain />
      <main className="relative flex min-h-[100svh] flex-col px-5 py-6 sm:px-8 sm:py-8">
        <ApiHealthBadge status={apiStatus} />
        <AuthHeaderActions />
        <LandingHero />
        <LandingFooter />
      </main>
    </>
  );
}
