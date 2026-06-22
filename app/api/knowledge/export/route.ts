import { exportKnowledgeBase } from "@/lib/knowledge-transfer";

export async function GET() {
  try {
    const zip = await exportKnowledgeBase();
    const filename = `knowledge-base-${new Date().toISOString().slice(0, 10)}.zip`;

    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/zip",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
