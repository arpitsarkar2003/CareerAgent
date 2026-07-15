"use client";

import { APP_NAME } from "@/lib/constants";
import { DASHBOARD_NAV } from "@/lib/nav";
import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  open: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ open, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 z-30 bg-soft-stone/30 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onNavigate}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-soft-stone-200 bg-soft-bg/95 backdrop-blur-sm transition-transform duration-300 ease-[var(--soft-ease)] md:static md:z-0 md:translate-x-0 md:bg-soft-sage/40 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center px-5 md:h-16">
          <Link
            href="/"
            className="font-script text-2xl font-bold tracking-tight text-soft-stone"
            onClick={onNavigate}
          >
            {APP_NAME}
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 pb-6" aria-label="Dashboard">
          {DASHBOARD_NAV.map((item) => {
            const active =
              item.enabled &&
              (pathname === item.href || pathname.startsWith(`${item.href}/`));

            if (!item.enabled) {
              return (
                <span
                  key={item.id}
                  className="cursor-not-allowed rounded-xl px-3 py-2.5 font-sans text-sm text-soft-stone-400"
                  title="Coming in a later module"
                >
                  {item.label}
                </span>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                className={`rounded-xl px-3 py-2.5 font-sans text-sm transition-colors ${
                  active
                    ? "bg-soft-white text-soft-stone soft-shadow"
                    : "text-soft-muted hover:bg-soft-white/60 hover:text-soft-stone"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
