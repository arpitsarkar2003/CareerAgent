import { SignInScreen } from "@/features/auth/components/SignInScreen";
import { AUTH_ROUTES } from "@/services/auth";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) {
    redirect(AUTH_ROUTES.afterSignIn);
  }
  return <SignInScreen />;
}
