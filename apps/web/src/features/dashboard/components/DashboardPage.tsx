import { redirect } from "next/navigation";

/** Legacy entry — dashboard index redirects to Knowledge Base. */
export async function DashboardPage() {
  redirect("/dashboard/knowledge");
}
