import { getConfig } from "@/lib/config";
import { ingestDocument } from "@/lib/ingestion";
import { listDocuments, updateDocument } from "@/lib/storage";

export async function POST() {
  const config = getConfig();
  const docs = await listDocuments();
  const queued = docs.filter((doc) => doc.status === "Ready" || doc.status === "Error");

  if (queued.length === 0) {
    return Response.json({ error: "No documents to index." }, { status: 400 });
  }

  for (const doc of queued) {
    await updateDocument(doc.id, { status: "Ingesting" });
  }

  void runIngestion(queued.map((doc) => doc.id), config.ingestion.concurrency);

  return Response.json({ started: queued.length });
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
