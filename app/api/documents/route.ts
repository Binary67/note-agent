import { getSourceFileKind } from "@/lib/utils";
import { addDocument, listDocuments, listFolders, saveSource } from "@/lib/storage";
import { extractPdf } from "@/lib/pdf-extraction";
import { transcribeAudio } from "@/lib/transcription";
import { beginUploadProgress, updateUploadProgress } from "@/lib/upload-progress";

const FORM_PARSED_PERCENT = 20;
const EXTRACTION_END_PERCENT = 88;
const SAVING_PERCENT = 94;

export async function GET() {
  const [docs, folders] = await Promise.all([listDocuments(), listFolders()]);
  return Response.json({ documents: docs, folders });
}

export async function POST(request: Request) {
  const jobId = new URL(request.url).searchParams.get("jobId");
  beginUploadProgress(jobId);

  try {
    updateUploadProgress(jobId, { percent: 12, label: "Reading uploaded files" });
    const formData = await request.formData();
    const files = formData.getAll("files").filter(isSupportedSourceFile);
    updateUploadProgress(jobId, {
      percent: FORM_PARSED_PERCENT,
      label: "Files received",
      detail: files.length > 0 ? `${files.length} file${files.length === 1 ? "" : "s"}` : null,
    });

    if (files.length === 0) {
      updateUploadProgress(jobId, {
        status: "error",
        label: "Upload rejected",
        detail: "Only .txt, .pdf, and supported audio files are supported.",
      });
      return Response.json(
        { error: "Only .txt, .pdf, and supported audio files are supported." },
        { status: 400 },
      );
    }

    const prepared: Array<{ file: File; id: string; text: string }> = [];

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const kind = getSourceFileKind(file);
      const reportProgress = (completed: number, total: number) => {
        updateUploadProgress(jobId, {
          percent: extractionPercent(i, files.length, completed, total),
          label: "Extracting files",
          detail: total > 1 ? `${file.name} (${completed}/${total})` : file.name,
        });
      };
      const text =
        kind === "audio"
          ? await transcribeAudio(file, reportProgress)
          : kind === "pdf"
            ? await extractPdf(file, reportProgress)
            : await file.text();
      const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      if (kind === "text") {
        reportProgress(1, 1);
      }

      prepared.push({ file, id, text });
    }

    updateUploadProgress(jobId, { percent: SAVING_PERCENT, label: "Saving extracted text" });
    const created = await Promise.all(
      prepared.map(async ({ file, id, text }) => {
        await saveSource(id, text);
        return addDocument(id, file.name, file.size);
      }),
    );
    const folders = await listFolders();

    updateUploadProgress(jobId, {
      status: "complete",
      percent: 100,
      label: "Upload complete",
      detail: null,
    });
    return Response.json({ documents: created, folders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    updateUploadProgress(jobId, { status: "error", label: "Upload failed", detail: message });
    return Response.json({ error: message }, { status: 500 });
  }
}

function isSupportedSourceFile(value: FormDataEntryValue): value is File {
  return value instanceof File && getSourceFileKind(value) !== null;
}

function extractionPercent(
  fileIndex: number,
  fileCount: number,
  completed: number,
  total: number,
): number {
  const extractionRange = EXTRACTION_END_PERCENT - FORM_PARSED_PERCENT;
  const fileStart = FORM_PARSED_PERCENT + (fileIndex / fileCount) * extractionRange;
  const fileEnd = FORM_PARSED_PERCENT + ((fileIndex + 1) / fileCount) * extractionRange;
  const ratio = total > 0 ? completed / total : 0;

  return fileStart + (fileEnd - fileStart) * ratio;
}
