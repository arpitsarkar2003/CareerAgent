import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16: network boundary file is proxy.ts (middleware.ts is deprecated).
// Protect resources in pages/layouts via auth.protect() — not path matchers.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
