type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
};

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
}: ToggleProps) {
  return (
    <label
      className={`inline-flex items-center gap-2.5 font-sans text-sm text-soft-stone ${
        disabled ? "opacity-50" : "cursor-pointer"
      } ${className}`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soft-coral focus-visible:ring-offset-2 focus-visible:ring-offset-soft-bg disabled:pointer-events-none ${
          checked ? "bg-soft-coral" : "bg-soft-stone-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
      {label ? <span>{label}</span> : null}
    </label>
  );
}
