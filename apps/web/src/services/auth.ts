/**
 * Auth-related helpers for the web app.
 * Clerk handles session UI; this module holds routes/constants and
 * future API calls that need a Clerk session token.
 */

export const AUTH_ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  afterSignIn: "/dashboard",
  afterSignOut: "/",
} as const;

/** Path Clerk should send the user to after a successful sign-in/up. */
export function getPostAuthRedirect(): string {
  return AUTH_ROUTES.afterSignIn;
}
