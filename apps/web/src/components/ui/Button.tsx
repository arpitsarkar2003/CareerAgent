import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const variants = {
  primary:
    "bg-soft-coral text-soft-stone hover:brightness-95 focus-visible:ring-soft-coral",
  secondary:
    "bg-soft-stone-100 text-soft-stone hover:bg-soft-stone-200 focus-visible:ring-soft-stone-400",
  destructive:
    "bg-soft-stone text-white hover:bg-soft-stone-800 focus-visible:ring-soft-stone",
  ghost:
    "bg-transparent text-soft-muted hover:bg-soft-stone-100 hover:text-soft-stone focus-visible:ring-soft-stone-400",
  danger:
    "bg-transparent text-soft-muted hover:bg-soft-coral-soft hover:text-soft-stone focus-visible:ring-soft-coral",
} as const;

type Variant = keyof typeof variants;

type Common = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
  size?: "md" | "sm";
};

type ButtonAsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type ButtonAsLink = Common & {
  href: string;
  disabled?: boolean;
};

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Button(props: ButtonProps) {
  const variant = props.variant ?? "primary";
  const size = props.size ?? "md";
  const className = cx(
    "inline-flex items-center justify-center gap-1.5 font-sans font-medium transition-[filter,background-color,color,opacity] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-soft-bg disabled:pointer-events-none disabled:opacity-50",
    size === "sm" ? "rounded-lg px-2.5 py-1.5 text-xs" : "rounded-xl px-4 py-2.5 text-sm",
    variants[variant],
    props.className,
  );

  if ("href" in props && props.href) {
    const { href, children, disabled } = props;
    if (disabled) {
      return (
        <span className={className} aria-disabled="true">
          {children}
        </span>
      );
    }
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  const { children, type = "button", size: _size, variant: _v, ...rest } =
    props as ButtonAsButton;
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  );
}
