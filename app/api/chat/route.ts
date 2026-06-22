import {
  DEFAULT_MAX_RETRIEVED_DOCUMENTS,
  answerQuestion,
} from "@/lib/retrieval";

type ChatRequest = {
  question?: unknown;
  selectedDocumentIds?: unknown;
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
  const maxRetrievedDocuments =
    typeof body.maxRetrievedDocuments === "number" &&
    Number.isFinite(body.maxRetrievedDocuments)
      ? body.maxRetrievedDocuments
      : DEFAULT_MAX_RETRIEVED_DOCUMENTS;

  try {
    const result = await answerQuestion({
      question: body.question,
      selectedDocumentIds,
      maxRetrievedDocuments,
    });

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to answer the question.";

    return Response.json({ error: message }, { status: 400 });
  }
}
