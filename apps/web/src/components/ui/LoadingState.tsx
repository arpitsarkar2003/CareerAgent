type LoadingStateProps = {
  label?: string;
  rows?: number;
};

export function LoadingState({
  label = "Loading…",
  rows = 3,
}: LoadingStateProps) {
  return (
    <div className="space-y-3" role="status" aria-live="polite" aria-label={label}>
      <p className="sr-only">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-2xl bg-soft-stone-100"
        />
      ))}
    </div>
  );
}
