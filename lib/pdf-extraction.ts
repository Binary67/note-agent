import "server-only";
import { OpenAI } from "openai";
import { PDFDocument } from "pdf-lib";
import { getConfig } from "./config";

const PDF_REQUEST_TARGET_BYTES = 35 * 1024 * 1024;
const PDF_REQUEST_LIMIT_BYTES = 50 * 1024 * 1024;
const PDF_OUTPUT_TOKEN_LIMIT = 24000;

type PdfPart = {
  bytes: Uint8Array;
  filename: string;
  pageStart: number | null;
  pageEnd: number | null;
  totalPages: number | null;
};

type ExtractionProgressReporter = (completed: number, total: number) => void;

function getClient(): OpenAI {
  const { azure } = getConfig();

  if (!azure.apiKey || !azure.endpoint) {
    throw new Error(
      "Azure OpenAI is not configured. Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in .env.",
    );
  }

  return new OpenAI({
    apiKey: azure.apiKey,
    baseURL: azure.endpoint,
  });
}

function pageRangeFilename(name: string, start: number, end: number): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return `${stem}-pages-${start}-${end}.pdf`;
}

async function savePages(source: PDFDocument, indexes: number[]): Promise<Uint8Array> {
  const part = await PDFDocument.create();
  const pages = await part.copyPages(source, indexes);

  for (const page of pages) {
    part.addPage(page);
  }

  return part.save();
}

async function splitPdf(fileBytes: Uint8Array, filename: string): Promise<PdfPart[]> {
  if (fileBytes.byteLength <= PDF_REQUEST_TARGET_BYTES) {
    return [{ bytes: fileBytes, filename, pageStart: null, pageEnd: null, totalPages: null }];
  }

  let source: PDFDocument;

  try {
    source = await PDFDocument.load(fileBytes);
  } catch {
    throw new Error(
      "This PDF is too large for one model request and could not be split into page ranges.",
    );
  }

  const totalPages = source.getPageCount();
  const parts: PdfPart[] = [];
  let pageIndexes: number[] = [];
  let pageStart = 1;

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    const candidateIndexes = [...pageIndexes, pageIndex];
    const candidateBytes = await savePages(source, candidateIndexes);

    if (candidateBytes.byteLength > PDF_REQUEST_TARGET_BYTES && pageIndexes.length > 0) {
      const pageEnd = pageIndex;
      const bytes = await savePages(source, pageIndexes);
      parts.push({
        bytes,
        filename: pageRangeFilename(filename, pageStart, pageEnd),
        pageStart,
        pageEnd,
        totalPages,
      });

      pageIndexes = [pageIndex];
      pageStart = pageIndex + 1;
      const singlePageBytes = await savePages(source, pageIndexes);

      if (singlePageBytes.byteLength > PDF_REQUEST_LIMIT_BYTES) {
        throw new Error(
          `Page ${pageIndex + 1} is larger than the 50 MB PDF request limit after splitting.`,
        );
      }

      continue;
    }

    if (candidateBytes.byteLength > PDF_REQUEST_LIMIT_BYTES) {
      throw new Error(
        `Page ${pageIndex + 1} is larger than the 50 MB PDF request limit after splitting.`,
      );
    }

    pageIndexes = candidateIndexes;
  }

  if (pageIndexes.length > 0) {
    const pageEnd = totalPages;
    const bytes = await savePages(source, pageIndexes);

    if (bytes.byteLength > PDF_REQUEST_LIMIT_BYTES) {
      throw new Error(
        `Pages ${pageStart}-${pageEnd} are larger than the 50 MB PDF request limit after splitting.`,
      );
    }

    parts.push({
      bytes,
      filename: pageRangeFilename(filename, pageStart, pageEnd),
      pageStart,
      pageEnd,
      totalPages,
    });
  }

  return parts;
}

function extractionPrompt(part: PdfPart, index: number, count: number): string {
  const range =
    part.pageStart === null || part.pageEnd === null || part.totalPages === null
      ? "This file contains the full PDF."
      : `This file contains original PDF pages ${part.pageStart}-${part.pageEnd} of ${part.totalPages}.`;
  const partLabel = count === 1 ? "" : ` This is part ${index + 1} of ${count}.`;

  return [
    "Extract this PDF into retrieval-ready Markdown for a personal knowledge base.",
    `${range}${partLabel}`,
    "",
    "Rules:",
    "- Preserve the document's logical reading order.",
    "- Preserve headings, lists, footnotes, tables, and important labels.",
    "- Convert tables into Markdown tables when practical.",
    "- Start each page section with a Markdown heading like `## Page 3`.",
    "- Describe charts, diagrams, screenshots, and images using concise Markdown paragraphs.",
    "- For graphs, include title, axes, legends, visible values, trends, and comparisons when readable.",
    "- Mark uncertain visual readings as approximate instead of inventing exact values.",
    "- Do not summarize, omit meaningful content, or add commentary about the extraction task.",
    "- Output only Markdown.",
  ].join("\n");
}

async function extractPart(part: PdfPart, index: number, count: number): Promise<string> {
  const { azure } = getConfig();
  const client = getClient();
  const base64 = Buffer.from(part.bytes).toString("base64");

  const response = await client.responses.create({
    model: azure.chatDeployment,
    store: false,
    max_output_tokens: PDF_OUTPUT_TOKEN_LIMIT,
    instructions:
      "You convert PDF files into faithful, retrieval-friendly Markdown. Preserve source content and describe non-text visual information accurately.",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_file",
            filename: part.filename,
            file_data: `data:application/pdf;base64,${base64}`,
            detail: "high",
          },
          {
            type: "input_text",
            text: extractionPrompt(part, index, count),
          },
        ],
      },
    ],
  });

  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason ?? "unknown reason";
    throw new Error(`PDF extraction did not complete: ${reason}.`);
  }

  const text = response.output_text.trim();

  if (!text) {
    throw new Error("PDF extraction returned no text.");
  }

  return text;
}

export async function extractPdf(
  file: File,
  onProgress?: ExtractionProgressReporter,
): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parts = await splitPdf(bytes, file.name);
  const extracted: string[] = [];

  onProgress?.(0, parts.length);

  for (let i = 0; i < parts.length; i += 1) {
    extracted.push(await extractPart(parts[i], i, parts.length));
    onProgress?.(i + 1, parts.length);
  }

  return extracted.join("\n\n");
}
