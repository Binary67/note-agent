import {
  ensureFolder,
  getDocument,
  listFolders,
  removeDocument,
  updateDocument,
} from "@/lib/storage";
import { normalizeFolderName } from "@/lib/folders";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  await removeDocument(id);
  return Response.json({ ok: true });
}

type DocumentUpdateRequest = {
  name?: unknown;
  folderName?: unknown;
};

export async function PATCH(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;

  let body: DocumentUpdateRequest;
  try {
    body = (await request.json()) as DocumentUpdateRequest;
  } catch {
    return Response.json({ error: "Invalid document update request." }, { status: 400 });
  }

  const changes: Parameters<typeof updateDocument>[1] = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return Response.json({ error: "A non-empty name is required." }, { status: 400 });
    }

    changes.name = body.name.trim();
  }
  const existing = await getDocument(id);

  if (!existing) {
    return Response.json({ error: "Document not found." }, { status: 404 });
  }

  if (body.folderName !== undefined) {
    if (body.folderName === null) {
      changes.folderId = null;
    } else if (typeof body.folderName === "string") {
      const folderName = normalizeFolderName(body.folderName);
      changes.folderId = folderName ? (await ensureFolder(folderName)).id : null;
    } else {
      return Response.json({ error: "Folder name must be text or null." }, { status: 400 });
    }
  }

  const updated = await updateDocument(id, changes);
  const folders = await listFolders();

  return Response.json({ document: updated, folders });
}
