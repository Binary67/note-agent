import { getInsightsView } from "@/lib/insights";

export async function GET() {
  try {
    return Response.json(await getInsightsView());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load insights.";

    return Response.json({ error: message }, { status: 400 });
  }
}
