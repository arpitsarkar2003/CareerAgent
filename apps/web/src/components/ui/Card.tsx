import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-2xl border border-soft-stone-200 bg-white/80 p-5 soft-shadow ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
