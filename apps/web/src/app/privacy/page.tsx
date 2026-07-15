import { PrivacyPolicyPage } from "@/features/legal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Career Agent",
  description: "Privacy Policy for Career Agent (CareerOS).",
};

export default function PrivacyPage() {
  return <PrivacyPolicyPage />;
}
