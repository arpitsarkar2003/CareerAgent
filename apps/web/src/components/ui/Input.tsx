import type { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
};

export function Input({
  label,
  hint,
  id,
  className = "",
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <label className="flex w-full flex-col gap-1.5 font-sans text-sm">
      {label ? (
        <span className="font-medium text-soft-stone">{label}</span>
      ) : null}
      <input
        id={inputId}
        className={`rounded-xl border border-soft-stone-200 bg-soft-white px-3 py-2.5 text-soft-stone placeholder:text-soft-stone-400 focus:border-soft-coral focus:outline-none focus:ring-2 focus:ring-soft-coral/40 disabled:opacity-50 ${className}`}
        {...rest}
      />
      {hint ? <span className="text-xs text-soft-muted">{hint}</span> : null}
    </label>
  );
}
