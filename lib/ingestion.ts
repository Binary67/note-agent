import "server-only";
import { OpenAI } from "openai";
import { getConfig } from "./config";
import {
  type DocIndex,
  readSource,
  saveIndex,
  updateDocument,
} from "./storage";

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

function chunkText(text: string, size: number, overlap: number): string[] {
  const cleaned = text.replace(/\r\n/g, "\n").trim();

  if (cleaned.length <= size) {
    return [cleaned];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = start + size;
    let slice = cleaned.slice(start, end);

    if (end < cleaned.length) {
      const boundary = slice.lastIndexOf("\n\n");

      if (boundary >= Math.floor(size * 0.5)) {
        end = start + boundary + 2;
        slice = cleaned.slice(start, end);
      }
    }

    chunks.push(slice.trim());

    if (end >= cleaned.length) {
      break;
    }

    start = Math.max(0, end - overlap);
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  const { azure } = getConfig();
  const client = getClient();

  const response = await client.embeddings.create({
    model: azure.embeddingDeployment,
    input: chunks,
  });

  return response.data.map((item) => item.embedding);
}

type MetadataResponse = {
  summary: string;
  entities: string[];
  tags: string[];
};

async function generateMetadata(text: string): Promise<MetadataResponse> {
  const { azure } = getConfig();
  const client = getClient();

  const truncated = text.length > 12000 ? text.slice(0, 12000) : text;

  const response = await client.chat.completions.create({
    model: azure.chatDeployment,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You analyze a personal knowledge-base document and produce structured metadata. " +
          "Respond with strict JSON matching this shape: " +
          '{"summary":"2-3 sentence summary","entities":["named people, orgs, projects, products"],"tags":["3-6 short lowercase topic tags"]}. ' +
          "Only output the JSON object.",
      },
      {
        role: "user",
        content: truncated,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<MetadataResponse>;

  return {
    summary: parsed.summary ?? "",
    entities: Array.isArray(parsed.entities) ? parsed.entities : [],
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

export async function ingestDocument(id: string): Promise<void> {
  const { ingestion } = getConfig();

  await updateDocument(id, { status: "Ingesting" });

  try {
    const text = await readSource(id);
    const chunks = chunkText(text, ingestion.chunkSize, ingestion.chunkOverlap);

    if (chunks.length === 0) {
      throw new Error("Document is empty after chunking.");
    }

    const embeddings = await embedChunks(chunks);
    const metadata = await generateMetadata(text);

    const index: DocIndex = {
      summary: metadata.summary,
      entities: metadata.entities,
      tags: metadata.tags,
      chunks: chunks.map((text, i) => ({
        text,
        embedding: embeddings[i] ?? [],
      })),
    };

    await saveIndex(id, index);
    await updateDocument(id, { status: "Indexed" });
  } catch (error) {
    console.error(`Ingestion failed for ${id}:`, error);
    await updateDocument(id, { status: "Error" });
    throw error;
  }
}