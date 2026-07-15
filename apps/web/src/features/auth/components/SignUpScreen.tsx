import { AUTH_ROUTES } from "@/services/auth";
import { SignUp } from "@clerk/nextjs";

export function SignUpScreen() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-soft-bg px-5">
      <SignUp
        forceRedirectUrl={AUTH_ROUTES.afterSignIn}
        signInUrl={AUTH_ROUTES.signIn}
      />
    </main>
  );
}
