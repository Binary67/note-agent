"use client";

import {
  Activity,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  MessageSquareText,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cx } from "@/app/components/ui";
import type { AnalyticsDay, AnalyticsResponse } from "@/app/types";
import { parseJson } from "@/lib/utils";

const emptyAnalytics: AnalyticsResponse = {
  questionsAnsweredToday: 0,
  questionsAnsweredThisWeek: 0,
  questionsAnsweredAllTime: 0,
  referencesReviewedToday: 0,
  referencesReviewedThisWeek: 0,
  referencesReviewedAllTime: 0,
  estimatedTimeSavedMinutes: 0,
  averageReferencesPerAnswer: 0,
  currentStreakDays: 0,
  activeDaysLast7: 0,
  todayDate: "",
  weekStartDate: "",
  daily: [],
};

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes === 0
    ? `${hours}h`
    : `${hours}h ${remainingMinutes}m`;
}

function formatDecimal(value: number): string {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: value > 0 && value < 10 ? 1 : 0,
  });
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-panel border border-line bg-surface p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent">
            <Icon className="size-4" />
          </span>
          <p className="truncate text-[13px] font-medium text-muted">{label}</p>
        </div>
      </div>

      <p className="mt-5 text-[34px] font-semibold leading-none tracking-tight text-ink">
        {loading ? "-" : value}
      </p>
      <p className="mt-2 truncate text-xs text-muted">{detail}</p>
    </div>
  );
}

function BarChart({
  title,
  description,
  data,
  valueKey,
  valueLabel,
  tone = "accent",
}: {
  title: string;
  description: string;
  data: AnalyticsDay[];
  valueKey: "questionsAnswered" | "referencesReviewed";
  valueLabel: string;
  tone?: "accent" | "success";
}) {
  const maxValue = Math.max(1, ...data.map((item) => item[valueKey]));

  return (
    <section className="rounded-panel border border-line bg-surface shadow-panel">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
        <BarChart3
          className={cx(
            "size-4 shrink-0",
            tone === "accent" ? "text-accent" : "text-success",
          )}
        />
      </div>

      <div className="px-4 pb-4 pt-5">
        <div className="grid h-44 grid-cols-7 items-end gap-2">
          {data.map((item) => {
            const value = item[valueKey];
            const height = Math.max(value === 0 ? 4 : 16, (value / maxValue) * 100);

            return (
              <div key={item.date} className="flex h-full min-w-0 flex-col justify-end">
                <div className="flex min-h-8 items-end">
                  <span
                    className="mb-1 block w-full truncate text-center text-[11px] font-medium text-muted"
                    title={`${value.toLocaleString()} ${valueLabel}`}
                  >
                    {value > 0 ? value.toLocaleString() : ""}
                  </span>
                </div>
                <div className="flex h-32 items-end rounded-control bg-surface-muted px-1.5 py-1.5">
                  <div
                    className={cx(
                      "w-full rounded-[6px] transition-[height] duration-300 ease-out",
                      tone === "accent" ? "bg-accent" : "bg-success",
                      value === 0 && "opacity-35",
                    )}
                    style={{ height: `${height}%` }}
                  />
                </div>
                <span className="mt-2 truncate text-center text-[11px] font-medium text-subtle">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ActivityStrip({ data }: { data: AnalyticsDay[] }) {
  return (
    <section className="rounded-panel border border-line bg-surface p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Activity</h3>
          <p className="mt-0.5 text-xs text-muted">Days with at least one answer</p>
        </div>
        <Activity className="size-4 text-accent" />
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {data.map((item) => {
          const active = item.questionsAnswered > 0;

          return (
            <div key={item.date} className="min-w-0">
              <div
                className={cx(
                  "flex aspect-square items-center justify-center rounded-control border text-xs font-semibold",
                  active
                    ? "border-accent-soft bg-accent text-white"
                    : "border-line bg-surface-muted text-subtle",
                )}
                title={`${item.date}: ${item.questionsAnswered} answers`}
              >
                {active ? item.questionsAnswered : ""}
              </div>
              <p className="mt-2 truncate text-center text-[11px] font-medium text-subtle">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AnalyticsView() {
  const [analytics, setAnalytics] = useState<AnalyticsResponse>(emptyAnalytics);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadAnalytics() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await parseJson<AnalyticsResponse>(
          await fetch("/api/analytics", { cache: "no-store" }),
        );

        if (isCurrent) {
          setAnalytics(data);
        }
      } catch (loadError) {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load analytics.",
          );
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      isCurrent = false;
    };
  }, []);

  const metricCards = useMemo(
    () => [
      {
        label: "Today",
        value: analytics.questionsAnsweredToday.toLocaleString(),
        detail: "questions answered",
        icon: MessageSquareText,
      },
      {
        label: "This week",
        value: analytics.questionsAnsweredThisWeek.toLocaleString(),
        detail: "answers since Monday",
        icon: CalendarDays,
      },
      {
        label: "All time",
        value: analytics.questionsAnsweredAllTime.toLocaleString(),
        detail: "successful answers",
        icon: CheckCircle2,
      },
      {
        label: "Time saved",
        value: formatDuration(analytics.estimatedTimeSavedMinutes),
        detail: "estimated from answers",
        icon: Clock,
      },
    ],
    [analytics],
  );
  const insightCards = [
    {
      label: "References reviewed",
      value: analytics.referencesReviewedAllTime.toLocaleString(),
      detail: `${analytics.referencesReviewedThisWeek.toLocaleString()} this week`,
      icon: BookOpenCheck,
    },
    {
      label: "Research depth",
      value: formatDecimal(analytics.averageReferencesPerAnswer),
      detail: "references per answer",
      icon: TrendingUp,
    },
    {
      label: "Current streak",
      value: analytics.currentStreakDays.toLocaleString(),
      detail: analytics.currentStreakDays === 1 ? "active day" : "active days",
      icon: Flame,
    },
  ];
  const daily = analytics.daily.length > 0 ? analytics.daily : emptyAnalytics.daily;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-5 overflow-y-auto px-5 py-5 md:px-7">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[13px] font-medium text-muted">Analytics</p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-tight text-ink">
            Productivity
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">
            A quick read on answered questions, reviewed references, and rough time saved.
          </p>
        </div>

        <div className="flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[13px] text-muted shadow-sm">
          <BarChart3 className="size-4 text-accent" />
          {isLoading ? "Loading" : `${analytics.activeDaysLast7}/7 active days`}
        </div>
      </section>

      {error && (
        <div className="rounded-panel border border-danger-soft bg-danger-soft px-4 py-3 text-[13px] text-danger">
          {error}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <MetricCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            loading={isLoading}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <BarChart
          title="Questions answered"
          description="Last 7 days"
          data={daily}
          valueKey="questionsAnswered"
          valueLabel="answers"
        />
        <BarChart
          title="References reviewed"
          description="Documents used in answers"
          data={daily}
          valueKey="referencesReviewed"
          valueLabel="references"
          tone="success"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div className="grid gap-3 md:grid-cols-3">
          {insightCards.map((metric) => (
            <MetricCard
              key={metric.label}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              detail={metric.detail}
              loading={isLoading}
            />
          ))}
        </div>
        <ActivityStrip data={daily} />
      </section>
    </div>
  );
}
