import type { UploadStatus } from "@/app/types";
import type { ChatMessage } from "@/app/types";

const AUDIO_EXTENSIONS = new Set([
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".ogg",
  ".wav",
  ".webm",
]);

const AUDIO_MIME_TYPES = new Set([
  "audio/flac",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mpga",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
  "audio/x-wav",
  "video/mp4",
  "video/webm",
]);

const PDF_MIME_TYPES = new Set(["application/pdf"]);

export const SUPPORTED_SOURCE_ACCEPT = [
  ".txt",
  "text/plain",
  ".pdf",
  "application/pdf",
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".ogg",
  ".wav",
  ".webm",
  "audio/*",
].join(",");

export type SourceFileKind = "text" | "audio" | "pdf";

export function getSourceFileKind(file: Pick<File, "name" | "type">): SourceFileKind | null {
  const name = file.name.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const type = file.type.toLowerCase();

  if (type === "text/plain" || ext === ".txt") {
    return "text";
  }

  if (PDF_MIME_TYPES.has(type) || ext === ".pdf") {
    return "pdf";
  }

  if (AUDIO_EXTENSIONS.has(ext) || AUDIO_MIME_TYPES.has(type) || type.startsWith("audio/")) {
    return "audio";
  }

  return null;
}

export function isSupportedSourceFile(file: File) {
  return getSourceFileKind(file) !== null;
}

export async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text;

    if (text) {
      try {
        const payload = JSON.parse(text) as { error?: string };
        message = payload.error ?? text;
      } catch {
        message = text;
      }
    }

    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function plural(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}

export function statusTone(
  status: UploadStatus,
): "neutral" | "accent" | "success" | "danger" {
  if (status === "Indexed") {
    return "success";
  }

  if (status === "Ingesting") {
    return "accent";
  }

  if (status === "Error") {
    return "danger";
  }

  return "neutral";
}

export function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createInitialMessages(): ChatMessage[] {
  return [];
}

export function splitName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");

  if (dot <= 0) {
    return { stem: name, ext: "" };
  }

  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

export function typeLabel(ext: string): string {
  if (ext === ".txt") return "Text document";
  if (ext === ".pdf") return "PDF document";
  if (AUDIO_EXTENSIONS.has(ext.toLowerCase())) return "Audio transcript";
  return "Document";
}
