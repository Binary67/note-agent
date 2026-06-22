import { getDocument, removeDocument, updateDocument } from "@/lib/storage";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  await removeDocument(id);
  return Response.json({ ok: true });
}

type RenameRequest = { name?: unknown };

export async function PATCH(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;

  let body: RenameRequest;
  try {
    body = (await request.json()) as RenameRequest;
  } catch {
    return Response.json({ error: "Invalid rename request." }, { status: 400 });
  }

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return Response.json({ error: "A non-empty name is required." }, { status: 400 });
  }

  const name = body.name.trim();
  const existing = await getDocument(id);

  if (!existing) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  const updated = await updateDocument(id, { name });

  return Response.json({ document: updated });
}