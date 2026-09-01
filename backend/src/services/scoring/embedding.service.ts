import { getGeminiClient } from "../../utils/gemini.js";

export const DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
export const EMBEDDING_DIMENSION = 768;

export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY"
  | "SEMANTIC_SIMILARITY"
  | "CLASSIFICATION"
  | "CLUSTERING";

export interface GenerateEmbeddingOptions {
  taskType?: EmbeddingTaskType;
}

export const l2Normalize = (vector: number[]): number[] => {
  let sumSq = 0;
  for (let i = 0; i < vector.length; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
};

export const generateEmbedding = async (
  text: string,
  options: GenerateEmbeddingOptions = {}
): Promise<number[]> => {
  const cleanText = text.trim() || "empty";
  const taskType = options.taskType ?? "SEMANTIC_SIMILARITY";
  const model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  const ai = getGeminiClient();
  const response = await ai.models.embedContent({
    model,
    contents: cleanText,
    config: {
      outputDimensionality: EMBEDDING_DIMENSION,
      taskType,
    },
  });

  const embeddingObj = response.embeddings?.[0];
  if (!embeddingObj || !Array.isArray(embeddingObj.values) || embeddingObj.values.length === 0) {
    throw new Error("Gemini returned an empty embedding response");
  }

  const rawArray = embeddingObj.values;
  if (rawArray.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected embedding dimension ${EMBEDDING_DIMENSION}, received ${rawArray.length}`);
  }

  return l2Normalize(rawArray);
};

