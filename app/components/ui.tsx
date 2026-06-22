"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useEffect } from "react";
import { X } from "lucide-react";
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
    <aside className="flex self-stretch overflow-hidden rounded-panel border border-line bg-surface shadow-panel xl:sticky xl:top-[76px]">
      {children}
    </aside>
  );
}

export function Modal({
  open,
  onClose,
  icon: Icon,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-sheet relative w-full max-w-[360px] rounded-[12px] border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.08),0_24px_60px_rgba(0,0,0,0.18)]"
      >
        <div className="flex items-start gap-3">
          {Icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-muted text-muted">
              <Icon className="size-4" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-5 text-ink">{title}</h2>
          </div>
          <button
            className="flex size-8 shrink-0 items-center justify-center rounded-control text-subtle transition hover:bg-surface-muted hover:text-ink"
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        {children && <div className="mt-4">{children}</div>}

        {footer && (
          <div className="mt-4 flex items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function SecondaryButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-control border border-line bg-surface px-3.5 text-[13px] font-medium text-ink shadow-sm transition hover:bg-surface-muted disabled:cursor-not-allowed disabled:bg-surface-pressed disabled:text-subtle",
        className,
      )}
      type={type}
    />
  );
}

export function DangerButton({
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-control bg-danger px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#b12719] disabled:cursor-not-allowed disabled:bg-surface-pressed disabled:text-subtle",
        className,
      )}
      type={type}
    />
  );
}
