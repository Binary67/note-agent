import "server-only";
import { execFile } from "node:child_process";
import { createReadStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { AzureOpenAI } from "openai";
import { getConfig } from "./config";

const execFileAsync = promisify(execFile);
const TRANSCRIPT_HEADER = "Audio transcript. Speaker labels are not available.";
const CHUNK_SECONDS = 20 * 60;
const PROMPT_TAIL_CHARS = 1200;
const FFMPEG_PATH = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg");

type AudioChunk = {
  name: string;
  path: string;
};

function getClient(): AzureOpenAI {
  const { transcription } = getConfig();

  if (
    !transcription.apiKey ||
    !transcription.endpoint ||
    !transcription.deployment ||
    !transcription.apiVersion
  ) {
    throw new Error(
      "Azure OpenAI transcription is not configured. Set AZURE_OPENAI_TRANSCRIPTION_API_KEY, AZURE_OPENAI_TRANSCRIPTION_ENDPOINT, AZURE_OPENAI_TRANSCRIPTION_DEPLOYMENT, and AZURE_OPENAI_TRANSCRIPTION_API_VERSION in .env.",
    );
  }

  return new AzureOpenAI({
    apiKey: transcription.apiKey,
    endpoint: transcription.endpoint.replace(/\/+$/, ""),
    apiVersion: transcription.apiVersion,
  });
}

function extensionFor(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return ext || ".audio";
}

function stemFor(name: string): string {
  const stem = path.basename(name, path.extname(name)).replace(/[^a-z0-9_-]+/gi, "-");
  return stem || "audio";
}

async function splitAudio(file: File, tempDir: string): Promise<AudioChunk[]> {
  try {
    await fs.access(FFMPEG_PATH);
  } catch {
    throw new Error("Audio splitting requires ffmpeg, but the bundled binary was not found.");
  }

  const chunksDir = path.join(tempDir, "chunks");
  const inputPath = path.join(tempDir, `input${extensionFor(file.name)}`);
  const outputPattern = path.join(chunksDir, `${stemFor(file.name)}-%03d.mp3`);

  await fs.mkdir(chunksDir, { recursive: true });
  await fs.writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

  await execFileAsync(
    FFMPEG_PATH,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-map",
      "0:a:0",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      "-f",
      "segment",
      "-segment_time",
      String(CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      outputPattern,
    ],
    { maxBuffer: 1024 * 1024 },
  );

  const names = (await fs.readdir(chunksDir)).filter((name) => name.endsWith(".mp3")).sort();

  if (names.length === 0) {
    throw new Error("No audio track was found to transcribe.");
  }

  return names.map((name) => ({
    name,
    path: path.join(chunksDir, name),
  }));
}

async function transcribeChunk(
  client: AzureOpenAI,
  chunk: AudioChunk,
  prompt: string,
): Promise<string> {
  const { transcription } = getConfig();

  const response = await client.audio.transcriptions.create({
    file: createReadStream(chunk.path),
    model: transcription.deployment,
    prompt: prompt || undefined,
  });

  return response.text.trim();
}

export async function transcribeAudio(file: File): Promise<string> {
  const { transcription } = getConfig();
  const client = getClient();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "note-agent-audio-"));

  try {
    const chunks = await splitAudio(file, tempDir);
    const transcripts: string[] = [];
    let prompt = "";

    for (const chunk of chunks) {
      const stat = await fs.stat(chunk.path);

      if (stat.size > transcription.maxBytes) {
        throw new Error(
          "Audio chunk is still too large after splitting. Try uploading a shorter recording.",
        );
      }

      const text = await transcribeChunk(client, chunk, prompt);

      if (text) {
        transcripts.push(text);
        prompt = text.slice(-PROMPT_TAIL_CHARS);
      }
    }

    if (transcripts.length === 0) {
      throw new Error("Transcription returned no text.");
    }

    return `${TRANSCRIPT_HEADER}\n\n${transcripts.join("\n\n")}`;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
