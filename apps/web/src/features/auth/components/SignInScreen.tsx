import { AUTH_ROUTES } from "@/services/auth";
import { SignIn } from "@clerk/nextjs";

export function SignInScreen() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-soft-bg px-5">
      <SignIn
        forceRedirectUrl={AUTH_ROUTES.afterSignIn}
        signUpUrl={AUTH_ROUTES.signUp}
      />
    </main>
  );
}
