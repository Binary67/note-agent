import {
  DEFAULT_MAX_RETRIEVED_DOCUMENTS,
  MAX_RETRIEVED_DOCUMENTS,
  MIN_RETRIEVED_DOCUMENTS,
  answerQuestion,
} from "@/lib/retrieval";
import { recordQuestionAnswered } from "@/lib/analytics";

type ChatRequest = {
  question?: unknown;
  selectedDocumentIds?: unknown;
  selectedFolderIds?: unknown;
  maxRetrievedDocuments?: unknown;
};

export async function POST(request: Request) {
  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return Response.json({ error: "Invalid chat request." }, { status: 400 });
  }

  if (typeof body.question !== "string" || body.question.trim().length === 0) {
    return Response.json({ error: "Question is required." }, { status: 400 });
  }

  const selectedDocumentIds = Array.isArray(body.selectedDocumentIds)
    ? body.selectedDocumentIds.filter((id): id is string => typeof id === "string")
    : [];
  const selectedFolderIds = Array.isArray(body.selectedFolderIds)
    ? body.selectedFolderIds.filter((id): id is string => typeof id === "string")
    : [];
  const maxRetrievedDocuments =
    typeof body.maxRetrievedDocuments === "number" &&
    Number.isFinite(body.maxRetrievedDocuments)
      ? Math.min(
          MAX_RETRIEVED_DOCUMENTS,
          Math.max(MIN_RETRIEVED_DOCUMENTS, Math.trunc(body.maxRetrievedDocuments)),
        )
      : DEFAULT_MAX_RETRIEVED_DOCUMENTS;

  try {
    const result = await answerQuestion({
      question: body.question,
      selectedDocumentIds,
      selectedFolderIds,
      maxRetrievedDocuments,
    });

    try {
      await recordQuestionAnswered({ referencesReviewed: result.documents.length });
    } catch (analyticsError) {
      console.error("Failed to record question analytics:", analyticsError);
    }

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to answer the question.";

    return Response.json({ error: message }, { status: 400 });
  }
}
