import { addDocument, listDocuments, saveSource } from "@/lib/storage";

export async function GET() {
  const docs = await listDocuments();
  return Response.json({ documents: docs });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter(isTextFile);

  if (files.length === 0) {
    return Response.json({ error: "Only .txt files are supported." }, { status: 400 });
  }

  const created = await Promise.all(
    files.map(async (file) => {
      const text = await file.text();
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await saveSource(id, text);
      return addDocument(id, file.name, file.size);
    }),
  );

  return Response.json({ documents: created });
}

function isTextFile(value: FormDataEntryValue): value is File {
  return (
    value instanceof File &&
    (value.type === "text/plain" || value.name.toLowerCase().endsWith(".txt"))
  );
}