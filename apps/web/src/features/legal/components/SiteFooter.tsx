import {
  APP_NAME,
  APP_PRODUCT_ALIAS,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/constants";
import Link from "next/link";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-soft-stone/10 pt-6 text-center">
      <p className="font-sans text-xs text-soft-stone-400">
        © {year} {APP_NAME}
        <span className="text-soft-stone-400/80"> ({APP_PRODUCT_ALIAS})</span>
      </p>
      <nav
        className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-sans text-xs text-soft-muted"
        aria-label="Legal"
      >
        <Link
          href="/terms"
          className="transition-colors hover:text-soft-stone"
        >
          Terms of Use
        </Link>
        <span className="text-soft-stone-400" aria-hidden="true">
          ·
        </span>
        <Link
          href="/privacy"
          className="transition-colors hover:text-soft-stone"
        >
          Privacy Policy
        </Link>
      </nav>
      <p className="mt-3 font-sans text-[11px] leading-relaxed text-soft-stone-400">
        Effective {LEGAL_EFFECTIVE_DATE}. Not legal advice — personal tool
        policies for this project.
      </p>
    </footer>
  );
}
