import type { HTMLAttributes, ReactNode } from "react";

const variants = {
  // Default: neutral pill (source tags, generic status).
  default: "bg-soft-stone-100 text-soft-stone",
  // Passed-threshold / good-match signal — reuses the existing accent color.
  accent: "bg-soft-coral text-soft-stone",
  // Below-threshold — muted, not a competing color family.
  muted: "bg-soft-stone-100 text-soft-muted",
  // Failed/attention state that stays calm rather than alarming red.
  calm: "bg-soft-lavender text-soft-stone",
} as const;

type Variant = keyof typeof variants;

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
  children: ReactNode;
};

export function Badge({
  variant = "default",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-sans text-xs font-medium ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
