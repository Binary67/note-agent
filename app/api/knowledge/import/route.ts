import { importKnowledgeBase } from "@/lib/knowledge-transfer";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Select a knowledge base zip file." },
        { status: 400 },
      );
    }

    const imported = await importKnowledgeBase(Buffer.from(await file.arrayBuffer()));

    return Response.json(imported);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
