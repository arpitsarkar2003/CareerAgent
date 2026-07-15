import { requireUser } from "@/features/auth/lib/requireUser";
import type { ReactNode } from "react";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireUser();
  return children;
}
