import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Outfit, Reenie_Beanie } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const reenie = Reenie_Beanie({
  variable: "--font-reenie",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Career Agent",
  description: "Personal job-application assistant — launching soon.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html
        lang="en"
        className={`${outfit.variable} ${reenie.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-soft-bg text-soft-stone">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
