import {
  forceGenerateInsights,
  runBackgroundInsights,
} from "@/lib/insights";

let activeRun: Promise<unknown> | null = null;

type RunInsightsRequest = {
  force?: unknown;
  folderId?: unknown;
};

export async function POST(request: Request) {
  let body: RunInsightsRequest = {};

  try {
    body = (await request.json()) as RunInsightsRequest;
  } catch {
    body = {};
  }

  const force = body.force === true;
  const folderId = typeof body.folderId === "string" ? body.folderId : undefined;

  if (activeRun && !force) {
    return Response.json({
      started: false,
      changed: false,
      suggestionsGenerated: 0,
      documentInsightsGenerated: 0,
      folderInsightsGenerated: 0,
      pendingJobs: 0,
    });
  }

  let run: Promise<unknown> | null = null;

  try {
    if (activeRun) {
      await activeRun.catch(() => undefined);
    }

    run = force
      ? forceGenerateInsights({ folderId })
      : runBackgroundInsights();
    activeRun = run;
    const result = await run;

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate insights.";

    return Response.json({ error: message }, { status: 400 });
  } finally {
    if (activeRun === run) {
      activeRun = null;
    }
  }
}
