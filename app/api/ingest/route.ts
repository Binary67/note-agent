import { getConfig } from "@/lib/config";
import { ingestDocument } from "@/lib/ingestion";
import { listDocuments, updateDocument } from "@/lib/storage";

export async function POST() {
  const config = getConfig();
  const docs = await listDocuments();
  const ready = docs.filter((doc) => doc.status === "Ready");

  if (ready.length === 0) {
    return Response.json({ error: "No ready documents to ingest." }, { status: 400 });
  }

  for (const doc of ready) {
    await updateDocument(doc.id, { status: "Ingesting" });
  }

  void runIngestion(ready.map((doc) => doc.id), config.ingestion.concurrency);

  return Response.json({ started: ready.length });
}

async function runIngestion(ids: string[], concurrency: number): Promise<void> {
  const limit = Math.max(1, concurrency);
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      const current = ids[cursor++];
      await ingestDocument(current).catch(() => undefined);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
}