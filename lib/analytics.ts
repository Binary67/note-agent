import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AnalyticsDay, AnalyticsResponse } from "@/app/types";

type DailyCounters = {
  date: string;
  questionsAnswered: number;
  referencesReviewed: number;
};

type AnalyticsCounters = {
  questionsAnsweredAllTime: number;
  referencesReviewedAllTime: number;
  daily: DailyCounters[];
};

const DAYS_TO_KEEP = 30;
const CHART_DAYS = 7;
const MINUTES_SAVED_PER_ANSWER = 4;
const ROOT = path.join(process.cwd(), "data");
const ANALYTICS_PATH = path.join(ROOT, "analytics.json");

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getWeekStartDate(date: Date): string {
  const start = new Date(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + mondayOffset);

  return formatLocalDate(start);
}

function createEmptyCounters(date = new Date()): AnalyticsCounters {
  return {
    questionsAnsweredAllTime: 0,
    referencesReviewedAllTime: 0,
    daily: [
      {
        date: formatLocalDate(date),
        questionsAnswered: 0,
        referencesReviewed: 0,
      },
    ],
  };
}

async function readCounters(): Promise<AnalyticsCounters> {
  try {
    const content = await fs.readFile(ANALYTICS_PATH, "utf8");
    return JSON.parse(content) as AnalyticsCounters;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return createEmptyCounters();
    }
    throw error;
  }
}

async function writeCounters(counters: AnalyticsCounters): Promise<void> {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.writeFile(ANALYTICS_PATH, JSON.stringify(counters, null, 2), "utf8");
}

function normalizeCounters(
  counters: AnalyticsCounters,
  date = new Date(),
): AnalyticsCounters {
  const cutoffDate = formatLocalDate(addDays(date, -(DAYS_TO_KEEP - 1)));
  const todayDate = formatLocalDate(date);

  return {
    questionsAnsweredAllTime: counters.questionsAnsweredAllTime,
    referencesReviewedAllTime: counters.referencesReviewedAllTime,
    daily: counters.daily.filter(
      (day) => day.date >= cutoffDate && day.date <= todayDate,
    ),
  };
}

function createDailyWindow(counters: AnalyticsCounters, date: Date): AnalyticsDay[] {
  const dailyByDate = new Map(counters.daily.map((day) => [day.date, day]));

  return Array.from({ length: CHART_DAYS }, (_, index) => {
    const itemDate = addDays(date, index - (CHART_DAYS - 1));
    const dateKey = formatLocalDate(itemDate);
    const countersForDay = dailyByDate.get(dateKey);

    return {
      date: dateKey,
      label: itemDate.toLocaleDateString(undefined, { weekday: "short" }),
      questionsAnswered: countersForDay?.questionsAnswered ?? 0,
      referencesReviewed: countersForDay?.referencesReviewed ?? 0,
    };
  });
}

function getCurrentStreakDays(counters: AnalyticsCounters, date: Date): number {
  const questionCountByDate = new Map(
    counters.daily.map((day) => [day.date, day.questionsAnswered]),
  );
  let streak = 0;

  while (true) {
    const dateKey = formatLocalDate(addDays(date, -streak));

    if ((questionCountByDate.get(dateKey) ?? 0) === 0) {
      return streak;
    }

    streak += 1;
  }
}

function toResponse(counters: AnalyticsCounters, date = new Date()): AnalyticsResponse {
  const todayDate = formatLocalDate(date);
  const weekStartDate = getWeekStartDate(date);
  const todayCounters = counters.daily.find((day) => day.date === todayDate);
  const weekCounters = counters.daily.filter(
    (day) => day.date >= weekStartDate && day.date <= todayDate,
  );
  const daily = createDailyWindow(counters, date);
  const questionsAnsweredThisWeek = weekCounters.reduce(
    (total, day) => total + day.questionsAnswered,
    0,
  );
  const referencesReviewedThisWeek = weekCounters.reduce(
    (total, day) => total + day.referencesReviewed,
    0,
  );

  return {
    questionsAnsweredToday: todayCounters?.questionsAnswered ?? 0,
    questionsAnsweredThisWeek,
    questionsAnsweredAllTime: counters.questionsAnsweredAllTime,
    referencesReviewedToday: todayCounters?.referencesReviewed ?? 0,
    referencesReviewedThisWeek,
    referencesReviewedAllTime: counters.referencesReviewedAllTime,
    estimatedTimeSavedMinutes:
      counters.questionsAnsweredAllTime * MINUTES_SAVED_PER_ANSWER,
    averageReferencesPerAnswer:
      counters.questionsAnsweredAllTime === 0
        ? 0
        : counters.referencesReviewedAllTime / counters.questionsAnsweredAllTime,
    currentStreakDays: getCurrentStreakDays(counters, date),
    activeDaysLast7: daily.filter((day) => day.questionsAnswered > 0).length,
    todayDate,
    weekStartDate,
    daily,
  };
}

export async function getQuestionAnalytics(): Promise<AnalyticsResponse> {
  return toResponse(normalizeCounters(await readCounters()));
}

export async function recordQuestionAnswered({
  referencesReviewed,
}: {
  referencesReviewed: number;
}): Promise<AnalyticsResponse> {
  const date = new Date();
  const counters = normalizeCounters(await readCounters(), date);
  const todayDate = formatLocalDate(date);
  const daily = [...counters.daily];
  const todayIndex = daily.findIndex((day) => day.date === todayDate);
  const todayCounters =
    todayIndex === -1
      ? {
          date: todayDate,
          questionsAnswered: 0,
          referencesReviewed: 0,
        }
      : daily[todayIndex];
  const nextTodayCounters = {
    ...todayCounters,
    questionsAnswered: todayCounters.questionsAnswered + 1,
    referencesReviewed: todayCounters.referencesReviewed + referencesReviewed,
  };

  if (todayIndex === -1) {
    daily.push(nextTodayCounters);
  } else {
    daily[todayIndex] = nextTodayCounters;
  }

  const nextCounters: AnalyticsCounters = {
    questionsAnsweredAllTime: counters.questionsAnsweredAllTime + 1,
    referencesReviewedAllTime:
      counters.referencesReviewedAllTime + referencesReviewed,
    daily: daily.sort((a, b) => a.date.localeCompare(b.date)),
  };

  await writeCounters(nextCounters);

  return toResponse(nextCounters, date);
}
