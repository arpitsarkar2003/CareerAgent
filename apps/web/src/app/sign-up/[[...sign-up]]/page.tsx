import { SignUpScreen } from "@/features/auth/components/SignUpScreen";
import { AUTH_ROUTES } from "@/services/auth";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) {
    redirect(AUTH_ROUTES.afterSignIn);
  }
  return <SignUpScreen />;
}
