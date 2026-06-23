import {
  getInsightsView,
  updateFolderInsightInstruction,
} from "@/lib/insights";

type InsightUpdateRequest = {
  folderId?: unknown;
  instruction?: unknown;
};

export async function GET() {
  try {
    return Response.json(await getInsightsView());
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load insights.";

    return Response.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  let body: InsightUpdateRequest;

  try {
    body = (await request.json()) as InsightUpdateRequest;
  } catch {
    return Response.json({ error: "Invalid insight update request." }, { status: 400 });
  }

  if (typeof body.folderId !== "string" || body.folderId.trim().length === 0) {
    return Response.json({ error: "Folder is required." }, { status: 400 });
  }

  if (
    typeof body.instruction !== "string" ||
    body.instruction.trim().length === 0
  ) {
    return Response.json({ error: "Instruction is required." }, { status: 400 });
  }

  try {
    return Response.json(
      await updateFolderInsightInstruction({
        folderId: body.folderId,
        instruction: body.instruction,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update insight instruction.";

    return Response.json({ error: message }, { status: 400 });
  }
}
