import { APP_NAME } from "@/lib/constants";

export function LandingHero() {
  return (
    <div className="relative z-[1] mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-48 w-48 -translate-x-1/2 rounded-full bg-soft-coral-soft opacity-50 blur-3xl sm:h-64 sm:w-64"
        aria-hidden="true"
      />

      <h1 className="font-script text-4xl font-bold tracking-tight text-soft-stone sm:text-5xl md:text-6xl">
        {APP_NAME}
      </h1>

      <p className="mt-4 max-w-sm font-sans text-sm leading-relaxed text-soft-muted sm:text-base">
        Personal job-application assistant.
        <br className="hidden sm:block" /> You review. You submit.
      </p>

      <div className="mt-10 w-full max-w-xs rounded-[2rem] bg-soft-white px-8 py-10 soft-shadow sm:max-w-sm">
        <p className="font-sans text-xl text-soft-coral">launching soon</p>
        <p className="mt-3 font-sans text-sm text-soft-muted">
          Quietly under construction.
        </p>
      </div>
    </div>
  );
}
