import { APP_NAME } from "@/lib/constants";

const year = new Date().getFullYear();

export function LandingFooter() {
  return (
    <footer className="relative z-[1] pt-8 text-center">
      <p className="font-sans text-xs text-soft-stone-400">
        © {year} {APP_NAME}
      </p>
    </footer>
  );
}
