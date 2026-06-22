import { removeDocument } from "@/lib/storage";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  await removeDocument(id);
  return Response.json({ ok: true });
}