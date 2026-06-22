import type { UploadStatus } from "@/app/types";
import type { ChatMessage } from "@/app/types";

export function isTextFile(file: File) {
  return file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt");
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
  return "Document";
}
