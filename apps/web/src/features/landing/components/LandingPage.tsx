"use client";

import { SoftGrain } from "@/components/softly/SoftGrain";
import { AuthHeaderActions } from "@/features/auth/components/AuthHeaderActions";
import { ApiHealthBadge } from "@/features/landing/components/ApiHealthBadge";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { useApiHealth } from "@/features/landing/hooks/useApiHealth";
import { SiteFooter } from "@/features/legal/components/SiteFooter";

export function LandingPage() {
  const apiStatus = useApiHealth();

  return (
    <>
      <SoftGrain />
      <main className="relative flex min-h-[100svh] flex-col px-5 py-6 sm:px-8 sm:py-8">
        <ApiHealthBadge status={apiStatus} />
        <AuthHeaderActions />
        <LandingHero />
        <div className="relative z-[1] mt-auto pt-8">
          <SiteFooter />
        </div>
      </main>
    </>
  );
}
