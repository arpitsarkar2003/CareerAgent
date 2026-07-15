"use client";

import { AUTH_ROUTES } from "@/services/auth";
import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";

const linkClass =
  "font-sans text-xs font-medium tracking-tight text-soft-muted transition-colors hover:text-soft-stone sm:text-sm";

/**
 * Path-based sign-in/up (not modal) — Google OAuth + modal + keyless caused
 * dashboard ↔ sign-in redirect loops.
 */
export function AuthHeaderActions() {
  return (
    <div className="absolute right-5 top-6 z-[1] flex items-center gap-3 sm:right-8 sm:top-8 sm:gap-4">
      <Show when="signed-out">
        <Link href={AUTH_ROUTES.signIn} className={linkClass}>
          Sign in
        </Link>
        <Link
          href={AUTH_ROUTES.signUp}
          className="rounded-full bg-soft-coral px-3.5 py-1.5 font-sans text-xs font-medium tracking-tight text-soft-white transition-opacity hover:opacity-90 sm:text-sm"
        >
          Sign up
        </Link>
      </Show>
      <Show when="signed-in">
        <Link href={AUTH_ROUTES.afterSignIn} className={linkClass}>
          Dashboard
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
