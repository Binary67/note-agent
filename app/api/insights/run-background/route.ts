import {
  beginInsightGenerationProgress,
  forceGenerateInsights,
  getInsightGenerationProgress,
} from "@/lib/insights";

let activeRun: Promise<unknown> | null = null;

type RunInsightsRequest = {
  folderId?: unknown;
  jobId?: unknown;
};

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");

  if (!jobId) {
    return Response.json({ progress: null }, { status: 400 });
  }

  return Response.json({ progress: getInsightGenerationProgress(jobId) });
}

export async function POST(request: Request) {
  let body: RunInsightsRequest = {};

  try {
    body = (await request.json()) as RunInsightsRequest;
  } catch {
    body = {};
  }

  const folderId = typeof body.folderId === "string" ? body.folderId : undefined;
  const jobId = typeof body.jobId === "string" ? body.jobId : undefined;

  if (activeRun) {
    return Response.json({
      started: false,
      changed: false,
      documentInsightsGenerated: 0,
      pendingJobs: 0,
    });
  }

  let run: Promise<unknown> | null = null;

  try {
    if (jobId) {
      beginInsightGenerationProgress(jobId);
    }

    run = forceGenerateInsights({ folderId, jobId });
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
