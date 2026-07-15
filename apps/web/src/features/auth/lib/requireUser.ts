import { AUTH_ROUTES } from "@/services/auth";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Server-only: require a Clerk session or send the user to /sign-in.
 * Uses Next redirect (not redirectToSignIn) to avoid handshake/redirect loops
 * when keys are misconfigured or sessions are half-claimed.
 */
export async function requireUser() {
  const { userId } = await auth();
  if (!userId) {
    redirect(AUTH_ROUTES.signIn);
  }
  return { userId };
}
