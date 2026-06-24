import "server-only";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { getConfig } from "@/lib/config";
import {
  type DocIndex,
  type DocumentRecord,
  type FolderRecord,
  listDocuments,
  listFolders,
  readIndex,
  readSource,
  replaceDataDir,
} from "@/lib/storage";

const APP_ID = "note-agent";
const SCHEMA_VERSION = 1;
const INSIGHTS_FILE = "insights.json";

type KnowledgeBundleManifest = {
  app: typeof APP_ID;
  schemaVersion: typeof SCHEMA_VERSION;
  exportedAt: string;
  documents: number;
  folders: number;
  config: {
    azure: {
      chatDeployment: string;
      embeddingDeployment: string;
    };
    ingestion: {
      chunkSize: number;
      chunkOverlap: number;
      concurrency: number;
    };
  };
};

export type KnowledgeImportResult = {
  documents: DocumentRecord[];
  folders: FolderRecord[];
  imported: number;
};

export async function exportKnowledgeBase(): Promise<Buffer> {
  const [documents, folders] = await Promise.all([listDocuments(), listFolders()]);
  const manifest = createManifest(documents, folders);
  const zip = new JSZip();

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("registry.json", JSON.stringify(documents, null, 2));
  zip.file("folders.json", JSON.stringify(folders, null, 2));

  const insights = await readOptionalLocalText(path.join(process.cwd(), "data", INSIGHTS_FILE));

  if (insights) {
    zip.file(INSIGHTS_FILE, insights);
  }

  for (const document of documents) {
    const source = await readSource(document.id);
    const index = await readIndex(document.id);
    const documentRoot = `documents/${document.id}`;

    zip.file(`${documentRoot}/source.txt`, source);

    if (index) {
      zip.file(`${documentRoot}/index.json`, JSON.stringify(index, null, 2));
    }
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export async function importKnowledgeBase(buffer: Buffer): Promise<KnowledgeImportResult> {
  const zip = await JSZip.loadAsync(buffer);

  validateZipEntryNames(zip);

  const manifest = validateManifest(await readJsonEntry(zip, "manifest.json"));
  const documents = validateDocuments(await readJsonEntry(zip, "registry.json"));
  const folders = validateFolders(await readJsonEntry(zip, "folders.json"));
  const insightsEntry = await readOptionalTextEntry(zip, INSIGHTS_FILE);

  if (manifest.documents !== documents.length || manifest.folders !== folders.length) {
    throw new Error("Bundle manifest does not match the included registry.");
  }

  validateDocumentFolders(documents, folders);

  const tempParent = await fs.mkdtemp(path.join(os.tmpdir(), "note-agent-import-"));
  const nextRoot = path.join(tempParent, "data");

  try {
    await fs.mkdir(path.join(nextRoot, "documents"), { recursive: true });
    await fs.writeFile(
      path.join(nextRoot, "registry.json"),
      JSON.stringify(documents, null, 2),
      "utf8",
    );
    await fs.writeFile(
      path.join(nextRoot, "folders.json"),
      JSON.stringify(folders, null, 2),
      "utf8",
    );

    if (insightsEntry) {
      const insights = validateInsights(parseJson(insightsEntry, INSIGHTS_FILE));
      await fs.writeFile(
        path.join(nextRoot, INSIGHTS_FILE),
        JSON.stringify(insights, null, 2),
        "utf8",
      );
    }

    for (const document of documents) {
      const documentRoot = path.join(nextRoot, "documents", document.id);
      const indexEntry = await readOptionalTextEntry(
        zip,
        documentEntryPath(document.id, "index.json"),
      );
      const source = await readTextEntry(zip, documentEntryPath(document.id, "source.txt"));

      if (document.status === "Indexed" && !indexEntry) {
        throw new Error(`Indexed document "${document.name}" is missing index.json.`);
      }

      await fs.mkdir(documentRoot, { recursive: true });
      await fs.writeFile(path.join(documentRoot, "source.txt"), source, "utf8");

      if (indexEntry) {
        const index = validateDocIndex(
          parseJson(indexEntry, documentEntryPath(document.id, "index.json")),
        );
        await fs.writeFile(
          path.join(documentRoot, "index.json"),
          JSON.stringify(index, null, 2),
          "utf8",
        );
      }
    }

    await replaceDataDir(nextRoot);

    return { documents, folders, imported: documents.length };
  } finally {
    await fs.rm(tempParent, { recursive: true, force: true });
  }
}

function createManifest(
  documents: DocumentRecord[],
  folders: FolderRecord[],
): KnowledgeBundleManifest {
  const { azure, ingestion } = getConfig();

  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    documents: documents.length,
    folders: folders.length,
    config: {
      azure: {
        chatDeployment: azure.chatDeployment,
        embeddingDeployment: azure.embeddingDeployment,
      },
      ingestion,
    },
  };
}

function validateZipEntryNames(zip: JSZip): void {
  for (const name of Object.keys(zip.files)) {
    const segments = name.split("/").filter(Boolean);

    if (
      name.startsWith("/") ||
      name.includes("\\") ||
      name.includes("\0") ||
      segments.includes(".") ||
      segments.includes("..")
    ) {
      throw new Error(`Bundle contains an unsafe path: ${name}`);
    }
  }
}

async function readJsonEntry(zip: JSZip, entryName: string): Promise<unknown> {
  return parseJson(await readTextEntry(zip, entryName), entryName);
}

async function readTextEntry(zip: JSZip, entryName: string): Promise<string> {
  const entry = zip.file(entryName);

  if (!entry) {
    throw new Error(`Bundle is missing ${entryName}.`);
  }

  return entry.async("string");
}

async function readOptionalTextEntry(
  zip: JSZip,
  entryName: string,
): Promise<string | null> {
  const entry = zip.file(entryName);
  return entry ? entry.async("string") : null;
}

async function readOptionalLocalText(file: string): Promise<string | null> {
  try {
    return await fs.readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function parseJson(content: string, entryName: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error(`${entryName} is not valid JSON.`);
  }
}

function validateManifest(value: unknown): KnowledgeBundleManifest {
  if (!isRecord(value)) {
    throw new Error("manifest.json must contain an object.");
  }

  if (value.app !== APP_ID || value.schemaVersion !== SCHEMA_VERSION) {
    throw new Error("Bundle was not created by this version of note-agent.");
  }

  return {
    app: APP_ID,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: getString(value.exportedAt, "manifest.json exportedAt"),
    documents: getNumber(value.documents, "manifest.json documents"),
    folders: getNumber(value.folders, "manifest.json folders"),
    config: validateManifestConfig(value.config),
  };
}

function validateManifestConfig(value: unknown): KnowledgeBundleManifest["config"] {
  if (!isRecord(value) || !isRecord(value.azure) || !isRecord(value.ingestion)) {
    throw new Error("manifest.json config is invalid.");
  }

  return {
    azure: {
      chatDeployment: getString(value.azure.chatDeployment, "manifest.json chatDeployment"),
      embeddingDeployment: getString(
        value.azure.embeddingDeployment,
        "manifest.json embeddingDeployment",
      ),
    },
    ingestion: {
      chunkSize: getNumber(value.ingestion.chunkSize, "manifest.json chunkSize"),
      chunkOverlap: getNumber(value.ingestion.chunkOverlap, "manifest.json chunkOverlap"),
      concurrency: getNumber(value.ingestion.concurrency, "manifest.json concurrency"),
    },
  };
}

function validateDocuments(value: unknown): DocumentRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("registry.json must contain an array.");
  }

  return value.map((item, index) => validateDocument(item, `registry.json[${index}]`));
}

function validateDocument(value: unknown, label: string): DocumentRecord {
  if (!isRecord(value)) {
    throw new Error(`${label} must contain an object.`);
  }

  const id = getString(value.id, `${label}.id`);

  if (!isSafePathSegment(id)) {
    throw new Error(`${label}.id is not a safe document id.`);
  }

  return {
    id,
    name: getString(value.name, `${label}.name`),
    size: getString(value.size, `${label}.size`),
    status: getStatus(value.status, `${label}.status`),
    uploadedAt: getString(value.uploadedAt, `${label}.uploadedAt`),
    folderId: getNullableString(value.folderId, `${label}.folderId`),
  };
}

function validateFolders(value: unknown): FolderRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("folders.json must contain an array.");
  }

  return value.map((item, index) => validateFolder(item, `folders.json[${index}]`));
}

function validateFolder(value: unknown, label: string): FolderRecord {
  if (!isRecord(value)) {
    throw new Error(`${label} must contain an object.`);
  }

  const id = getString(value.id, `${label}.id`);

  if (!isSafePathSegment(id)) {
    throw new Error(`${label}.id is not a safe folder id.`);
  }

  return {
    id,
    name: getString(value.name, `${label}.name`),
  };
}

function validateDocumentFolders(
  documents: DocumentRecord[],
  folders: FolderRecord[],
): void {
  const folderIds = new Set(folders.map((folder) => folder.id));

  for (const document of documents) {
    if (document.folderId && !folderIds.has(document.folderId)) {
      throw new Error(`Document "${document.name}" references an unknown folder.`);
    }
  }
}

function validateDocIndex(value: unknown): DocIndex {
  if (!isRecord(value) || !Array.isArray(value.chunks)) {
    throw new Error("index.json is invalid.");
  }

  return {
    summary: getString(value.summary, "index.summary"),
    entities: getStringArray(value.entities, "index.entities"),
    tags: getStringArray(value.tags, "index.tags"),
    chunks: value.chunks.map((chunk, index) => validateChunk(chunk, `index.chunks[${index}]`)),
  };
}

function validateInsights(value: unknown): unknown {
  if (!isRecord(value)) {
    throw new Error(`${INSIGHTS_FILE} must contain an object.`);
  }

  return {
    documentInsights: validateRecordArray(value.documentInsights, "insights.documentInsights"),
  };
}

function validateRecordArray(value: unknown, label: string): Record<string, unknown>[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`);
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`${label}[${index}] must contain an object.`);
    }

    return item;
  });
}

function validateChunk(value: unknown, label: string): DocIndex["chunks"][number] {
  if (!isRecord(value) || !Array.isArray(value.embedding)) {
    throw new Error(`${label} is invalid.`);
  }

  const embedding = value.embedding.map((item, index) =>
    getNumber(item, `${label}.embedding[${index}]`),
  );

  return {
    text: getString(value.text, `${label}.text`),
    embedding,
  };
}

function documentEntryPath(id: string, fileName: "source.txt" | "index.json"): string {
  return `documents/${id}/${fileName}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafePathSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0")
  );
}

function getString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be text.`);
  }

  return value;
}

function getNullableString(value: unknown, label: string): string | null {
  if (value === null) {
    return null;
  }

  return getString(value, label);
}

function getStatus(value: unknown, label: string): DocumentRecord["status"] {
  if (
    value === "Ready" ||
    value === "Ingesting" ||
    value === "Indexed" ||
    value === "Error"
  ) {
    return value;
  }

  throw new Error(`${label} is not a valid upload status.`);
}

function getNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }

  return value;
}

function getStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be a text array.`);
  }

  return value;
}
