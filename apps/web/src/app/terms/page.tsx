import { TermsOfUsePage } from "@/features/legal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Career Agent",
  description: "Terms of Use for Career Agent (CareerOS).",
};

export default function TermsPage() {
  return <TermsOfUsePage />;
}
