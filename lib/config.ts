import "server-only";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env", override: true });

export type Config = {
  azure: {
    apiKey: string;
    endpoint: string;
    chatDeployment: string;
    embeddingDeployment: string;
  };
  ingestion: {
    chunkSize: number;
    chunkOverlap: number;
    concurrency: number;
  };
};

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getConfig(): Config {
  const apiKey = process.env.AZURE_OPENAI_API_KEY ?? "";
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT ?? "";
  const chatDeployment = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "";
  const embeddingDeployment =
    process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "";

  return {
    azure: { apiKey, endpoint, chatDeployment, embeddingDeployment },
    ingestion: {
      chunkSize: readInt("CHUNK_SIZE", 800),
      chunkOverlap: readInt("CHUNK_OVERLAP", 120),
      concurrency: readInt("INGESTION_CONCURRENCY", 1),
    },
  };
}