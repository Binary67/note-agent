export function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface px-3 text-muted ring-1 ring-line">
      <span className="font-semibold text-ink">{value}</span>
      {label}
    </span>
  );
}