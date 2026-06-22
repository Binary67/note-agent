import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "accent" | "success" | "danger";

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function SidebarItem({
  icon: Icon,
  label,
  active = false,
  className,
  type = "button",
  ...props
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "flex h-9 w-full items-center gap-3 rounded-control px-3 text-left text-[13px] transition",
        active
          ? "bg-surface-muted font-medium text-ink"
          : "text-muted hover:bg-surface-muted hover:text-ink",
        className,
      )}
      type={type}
    >
      <Icon className={cx("size-4", active ? "text-accent" : "text-subtle")} />
      {label}
    </button>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const toneClass = {
    neutral: "bg-surface-muted text-muted ring-line",
    accent: "bg-accent-soft text-accent ring-accent-soft",
    success: "bg-success-soft text-success ring-success-soft",
    danger: "bg-danger-soft text-danger ring-danger-soft",
  }[tone];

  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-control bg-accent px-3.5 text-[13px] font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-surface-pressed disabled:text-subtle",
        className,
      )}
      type={type}
    />
  );
}

export function InspectorPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="self-start overflow-hidden rounded-panel border border-line bg-surface shadow-panel xl:sticky xl:top-[76px]">
      {children}
    </aside>
  );
}
