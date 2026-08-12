import { pipeline, env } from "@xenova/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSION = 384;

let pipelinePromise: Promise<any> | null = null;

const getPipeline = () => {
  if (!pipelinePromise) {
    pipelinePromise = pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  return pipelinePromise;
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const cleanText = text.trim() || "empty";
  const extractor = await getPipeline();
  const output = await extractor(cleanText, { pooling: "mean", normalize: true });
  const rawArray = Array.from(output.data) as number[];
  if (rawArray.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Expected embedding dimension ${EMBEDDING_DIMENSION}, received ${rawArray.length}`);
  }
  return rawArray;
};
