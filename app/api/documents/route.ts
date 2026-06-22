import { getSourceFileKind } from "@/lib/utils";
import { addDocument, listDocuments, listFolders, saveSource } from "@/lib/storage";
import { transcribeAudio } from "@/lib/transcription";

export async function GET() {
  const [docs, folders] = await Promise.all([listDocuments(), listFolders()]);
  return Response.json({ documents: docs, folders });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter(isSupportedSourceFile);

    if (files.length === 0) {
      return Response.json(
        { error: "Only .txt and supported audio files are supported." },
        { status: 400 },
      );
    }

    const prepared = [];

    for (const file of files) {
      const kind = getSourceFileKind(file);
      const text = kind === "audio" ? await transcribeAudio(file) : await file.text();
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      prepared.push({ file, id, text });
    }

    const created = await Promise.all(
      prepared.map(async ({ file, id, text }) => {
        await saveSource(id, text);
        return addDocument(id, file.name, file.size);
      }),
    );
    const folders = await listFolders();

    return Response.json({ documents: created, folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function isSupportedSourceFile(value: FormDataEntryValue): value is File {
  return value instanceof File && getSourceFileKind(value) !== null;
}
