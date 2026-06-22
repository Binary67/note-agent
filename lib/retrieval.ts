import "server-only";
import { OpenAI } from "openai";
import { getConfig } from "./config";
import {
  type DocIndex,
  type DocumentRecord,
  listDocuments,
  readIndex,
  readSource,
} from "./storage";

const DEFAULT_MAX_RETRIEVED_DOCUMENTS = 5;

export type AnswerDocument = {
  id: string;
  name: string;
  source: "selected" | "retrieved";
  score?: number;
  semanticScore?: number;
  bm25Score?: number;
};

export type AnswerResult = {
  answer: string;
  mode: "selected" | "retrieved" | "folder" | "mixed";
  documents: AnswerDocument[];
};

type IndexedDocument = {
  record: DocumentRecord;
  index: DocIndex;
  text: string;
};

type ContextDocument = {
  id: string;
  name: string;
  text: string;
  source: "selected" | "retrieved";
  score?: number;
  semanticScore?: number;
  bm25Score?: number;
};

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

async function embedQuery(query: string): Promise<number[]> {
  const { azure } = getConfig();
  const client = getClient();

  const response = await client.embeddings.create({
    model: azure.embeddingDeployment,
    input: query,
  });

  return response.data[0]?.embedding ?? [];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }

  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aNorm += a[i] * a[i];
    bNorm += b[i] * b[i];
  }

  if (aNorm === 0 || bNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

function aggregateChunkScores(scores: number[]): number {
  const topScores = scores
    .filter((score) => Number.isFinite(score))
    .sort((a, b) => b - a)
    .slice(0, 5);

  if (topScores.length === 0) {
    return 0;
  }

  const maxScore = topScores[0];
  const topThree = topScores.slice(0, 3);
  const topThreeAverage =
    topThree.reduce((total, score) => total + score, 0) / topThree.length;
  const strongMatchBonus =
    Math.min(
      3,
      topScores.filter((score) => score >= 0.25).length,
    ) * 0.02;

  return maxScore * 0.65 + topThreeAverage * 0.35 + strongMatchBonus;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
}

function scoreBm25(query: string, documents: IndexedDocument[]): Map<string, number> {
  const queryTerms = Array.from(new Set(tokenize(query)));
  const tokenizedDocuments = documents.map((document) =>
    tokenize(
      [
        document.record.name,
        document.index.summary,
        document.index.entities.join(" "),
        document.index.tags.join(" "),
        document.text,
      ].join("\n"),
    ),
  );

  const documentCount = tokenizedDocuments.length;
  const averageLength =
    tokenizedDocuments.reduce((total, tokens) => total + tokens.length, 0) /
    Math.max(1, documentCount);
  const documentFrequency = new Map<string, number>();

  for (const tokens of tokenizedDocuments) {
    const uniqueTerms = new Set(tokens);

    for (const term of queryTerms) {
      if (uniqueTerms.has(term)) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
  }

  const k1 = 1.2;
  const b = 0.75;
  const scores = new Map<string, number>();

  tokenizedDocuments.forEach((tokens, index) => {
    const termFrequency = new Map<string, number>();

    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    let score = 0;

    for (const term of queryTerms) {
      const frequency = termFrequency.get(term) ?? 0;

      if (frequency === 0) {
        continue;
      }

      const frequencyInDocuments = documentFrequency.get(term) ?? 0;
      const idf = Math.log(
        1 + (documentCount - frequencyInDocuments + 0.5) / (frequencyInDocuments + 0.5),
      );
      const lengthFactor = 1 - b + b * (tokens.length / Math.max(1, averageLength));

      score +=
        idf *
        ((frequency * (k1 + 1)) / (frequency + k1 * lengthFactor));
    }

    scores.set(documents[index].record.id, score);
  });

  return scores;
}

async function loadIndexedDocuments(records: DocumentRecord[]): Promise<IndexedDocument[]> {
  const documents = await Promise.all(
    records.map(async (record) => {
      const [index, text] = await Promise.all([
        readIndex(record.id),
        readSource(record.id),
      ]);

      if (!index) {
        return null;
      }

      return { record, index, text };
    }),
  );

  return documents.filter((document): document is IndexedDocument => document !== null);
}

async function retrieveDocuments(
  question: string,
  {
    documentIds = [],
    folderIds = [],
  }: {
    documentIds?: string[];
    folderIds?: string[];
  } = {},
): Promise<ContextDocument[]> {
  const documentSet = new Set(documentIds);
  const folderSet = new Set(folderIds);
  const hasScope = documentSet.size > 0 || folderSet.size > 0;
  const records = (await listDocuments()).filter(
    (record) =>
      record.status === "Indexed" &&
      (!hasScope ||
        documentSet.has(record.id) ||
        (record.folderId !== null && folderSet.has(record.folderId))),
  );
  const indexedDocuments = await loadIndexedDocuments(records);

  if (indexedDocuments.length === 0) {
    throw new Error(
      hasScope
        ? "No indexed documents are available in the selected context."
        : "No indexed documents are available for chat.",
    );
  }

  const queryEmbedding = await embedQuery(question);
  const bm25Scores = scoreBm25(question, indexedDocuments);
  const semanticScores = new Map<string, number>();

  for (const document of indexedDocuments) {
    const chunkScores = document.index.chunks.map((chunk) =>
      cosineSimilarity(queryEmbedding, chunk.embedding),
    );

    semanticScores.set(document.record.id, aggregateChunkScores(chunkScores));
  }

  const semanticRank = [...indexedDocuments]
    .sort(
      (a, b) =>
        (semanticScores.get(b.record.id) ?? 0) -
        (semanticScores.get(a.record.id) ?? 0),
    )
    .filter((document) => (semanticScores.get(document.record.id) ?? 0) > 0);
  const bm25Rank = [...indexedDocuments]
    .sort(
      (a, b) =>
        (bm25Scores.get(b.record.id) ?? 0) - (bm25Scores.get(a.record.id) ?? 0),
    )
    .filter((document) => (bm25Scores.get(document.record.id) ?? 0) > 0);
  const fusedScores = new Map<string, number>();
  const rrfK = 60;

  semanticRank.forEach((document, index) => {
    fusedScores.set(
      document.record.id,
      (fusedScores.get(document.record.id) ?? 0) + 1 / (rrfK + index + 1),
    );
  });

  bm25Rank.forEach((document, index) => {
    fusedScores.set(
      document.record.id,
      (fusedScores.get(document.record.id) ?? 0) + 1 / (rrfK + index + 1),
    );
  });

  const rankedDocuments = indexedDocuments
    .map((document) => ({
      ...document,
      score: fusedScores.get(document.record.id) ?? 0,
      semanticScore: semanticScores.get(document.record.id) ?? 0,
      bm25Score: bm25Scores.get(document.record.id) ?? 0,
    }))
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score);

  const fallbackDocuments = semanticRank.map((document) => ({
    ...document,
    score: semanticScores.get(document.record.id) ?? 0,
    semanticScore: semanticScores.get(document.record.id) ?? 0,
    bm25Score: bm25Scores.get(document.record.id) ?? 0,
  }));
  const selectedDocuments =
    rankedDocuments.length > 0 ? rankedDocuments : fallbackDocuments;

  return selectedDocuments
    .slice(0, DEFAULT_MAX_RETRIEVED_DOCUMENTS)
    .map((document) => ({
      id: document.record.id,
      name: document.record.name,
      text: document.text,
      source: documentSet.has(document.record.id)
        ? ("selected" as const)
        : ("retrieved" as const),
      score: document.score,
      semanticScore: document.semanticScore,
      bm25Score: document.bm25Score,
    }));
}

async function generateAnswer(
  question: string,
  documents: ContextDocument[],
): Promise<string> {
  const { azure } = getConfig();
  const client = getClient();
  const documentContext = documents
    .map(
      (document, index) =>
        `<document index="${index + 1}" id="${document.id}" name="${document.name}">\n${document.text}\n</document>`,
    )
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: azure.chatDeployment,
    messages: [
      {
        role: "system",
        content:
          "You answer questions for a personal knowledge base. Use only the provided documents. " +
          "If the documents do not contain the answer, say you could not find it in the provided documents. " +
          "Keep answers concise and cite document names when making document-backed claims.",
      },
      {
        role: "user",
        content: `Question:\n${question}\n\nDocuments:\n${documentContext}`,
      },
    ],
  });

  return (
    response.choices[0]?.message?.content?.trim() ||
    "I could not generate an answer from the provided documents."
  );
}

export async function answerQuestion({
  question,
  selectedDocumentIds = [],
  selectedFolderIds = [],
}: {
  question: string;
  selectedDocumentIds?: string[];
  selectedFolderIds?: string[];
}): Promise<AnswerResult> {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    throw new Error("Question is required.");
  }

  const selectedIds = Array.from(new Set(selectedDocumentIds.filter(Boolean)));
  const selectedFolders = Array.from(new Set(selectedFolderIds.filter(Boolean)));
  let documents: ContextDocument[];
  let mode: AnswerResult["mode"];

  if (selectedIds.length > 0 && selectedFolders.length > 0) {
    documents = await retrieveDocuments(trimmedQuestion, {
      documentIds: selectedIds,
      folderIds: selectedFolders,
    });
    mode = "mixed";
  } else if (selectedIds.length > 0) {
    documents = await retrieveDocuments(trimmedQuestion, {
      documentIds: selectedIds,
    });
    mode = "selected";
  } else if (selectedFolders.length > 0) {
    documents = await retrieveDocuments(trimmedQuestion, {
      folderIds: selectedFolders,
    });
    mode = "folder";
  } else {
    documents = await retrieveDocuments(trimmedQuestion);
    mode = "retrieved";
  }

  const answer = await generateAnswer(trimmedQuestion, documents);

  return {
    answer,
    mode,
    documents: documents.map(
      ({ id, name, source, score, semanticScore, bm25Score }) => ({
        id,
        name,
        source,
        score,
        semanticScore,
        bm25Score,
      }),
    ),
  };
}
