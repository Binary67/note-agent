import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { folderNamesEqual, normalizeFolderName } from "@/lib/folders";

export type UploadStatus = "Ready" | "Ingesting" | "Indexed" | "Error";

export type DocumentRecord = {
  id: string;
  name: string;
  size: string;
  status: UploadStatus;
  uploadedAt: string;
  folderId: string | null;
};

export type FolderRecord = {
  id: string;
  name: string;
};

export type Chunk = {
  text: string;
  embedding: number[];
};

export type DocIndex = {
  summary: string;
  entities: string[];
  tags: string[];
  chunks: Chunk[];
};

const ROOT = path.join(process.cwd(), "data");
const REGISTRY_PATH = path.join(ROOT, "registry.json");
const FOLDERS_PATH = path.join(ROOT, "folders.json");
const DOCS_DIR = path.join(ROOT, "documents");
const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * 1024;

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const content = await fs.readFile(file, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= BYTES_PER_MEGABYTE) {
    const megabytes = bytes / BYTES_PER_MEGABYTE;
    return `${megabytes.toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
  }

  const kilobytes = Math.max(1, Math.round(bytes / BYTES_PER_KILOBYTE));
  return `${kilobytes.toLocaleString()} KB`;
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const docs = await readJson<Array<DocumentRecord & { folderId?: string | null }>>(
    REGISTRY_PATH,
    [],
  );
  return docs.map((doc) => ({ ...doc, folderId: doc.folderId ?? null }));
}

export async function listFolders(): Promise<FolderRecord[]> {
  return readJson<FolderRecord[]>(FOLDERS_PATH, []);
}

async function writeDocuments(docs: DocumentRecord[]): Promise<void> {
  await ensureDir(ROOT);
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(docs, null, 2), "utf8");
}

async function writeFolders(folders: FolderRecord[]): Promise<void> {
  await ensureDir(ROOT);
  await fs.writeFile(FOLDERS_PATH, JSON.stringify(folders, null, 2), "utf8");
}

export async function getDocument(id: string): Promise<DocumentRecord | null> {
  const docs = await listDocuments();
  return docs.find((doc) => doc.id === id) ?? null;
}

export async function addDocument(
  id: string,
  name: string,
  sizeBytes: number,
): Promise<DocumentRecord> {
  const docs = await listDocuments();
  const record: DocumentRecord = {
    id,
    name,
    size: formatBytes(sizeBytes),
    status: "Ready",
    uploadedAt: "Just now",
    folderId: null,
  };
  await writeDocuments([record, ...docs]);
  return record;
}

export async function ensureFolder(name: string): Promise<FolderRecord> {
  const normalizedName = normalizeFolderName(name);

  if (!normalizedName) {
    throw new Error("Folder name is required.");
  }

  const folders = await listFolders();
  const existing = folders.find((folder) => folderNamesEqual(folder.name, normalizedName));

  if (existing) {
    return existing;
  }

  const record: FolderRecord = {
    id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: normalizedName,
  };
  await writeFolders([record, ...folders]);
  return record;
}

export async function updateDocument(
  id: string,
  changes: Partial<DocumentRecord>,
): Promise<DocumentRecord | null> {
  const docs = await listDocuments();
  const idx = docs.findIndex((doc) => doc.id === id);

  if (idx === -1) {
    return null;
  }

  const updated = { ...docs[idx], ...changes };
  docs[idx] = updated;
  await writeDocuments(docs);
  return updated;
}

export async function removeDocument(id: string): Promise<void> {
  const docs = await listDocuments();
  await writeDocuments(docs.filter((doc) => doc.id !== id));

  const docDir = path.join(DOCS_DIR, id);
  await fs.rm(docDir, { recursive: true, force: true });
}

export function docDir(id: string): string {
  return path.join(DOCS_DIR, id);
}

export function sourcePath(id: string): string {
  return path.join(DOCS_DIR, id, "source.txt");
}

export function indexPath(id: string): string {
  return path.join(DOCS_DIR, id, "index.json");
}

export async function replaceDataDir(nextRoot: string): Promise<void> {
  const backupRoot = `${ROOT}.backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let hasBackup = false;

  await ensureDir(path.dirname(ROOT));

  try {
    await fs.rename(ROOT, backupRoot);
    hasBackup = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  try {
    await fs.rename(nextRoot, ROOT);

    if (hasBackup) {
      await fs.rm(backupRoot, { recursive: true, force: true });
    }
  } catch (error) {
    await fs.rm(ROOT, { recursive: true, force: true }).catch(() => undefined);

    if (hasBackup) {
      await fs.rename(backupRoot, ROOT).catch(() => undefined);
    }

    throw error;
  }
}

export async function saveSource(id: string, content: string): Promise<void> {
  await ensureDir(docDir(id));
  await fs.writeFile(sourcePath(id), content, "utf8");
}

export async function readSource(id: string): Promise<string> {
  return fs.readFile(sourcePath(id), "utf8");
}

export async function saveIndex(id: string, index: DocIndex): Promise<void> {
  await ensureDir(docDir(id));
  await fs.writeFile(indexPath(id), JSON.stringify(index, null, 2), "utf8");
}

export async function readIndex(id: string): Promise<DocIndex | null> {
  try {
    const content = await fs.readFile(indexPath(id), "utf8");
    return JSON.parse(content) as DocIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
