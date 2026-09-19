import { pipeline } from '@xenova/transformers';
import type { 
  DocumentChunk, 
  EmbeddedChunk, 
  EmbeddingVector, 
  EmbeddingOptions, 
  EmbeddingBatchResult 
} from '@research-assistant/shared';

/** Default state-of-the-art embedding model for dense academic retrieval */
export const DEFAULT_EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5';

/** Dimensionality of vectors produced by bge-small-en-v1.5 */
export const DEFAULT_EMBEDDING_DIMENSIONS = 384;

/** Default number of chunks processed per inference batch */
export const DEFAULT_BATCH_SIZE = 8;

/** Feature extraction pipeline type from @xenova/transformers */
type FeatureExtractionPipeline = (
  text: string | string[],
  options?: { pooling?: 'none' | 'mean' | 'cls'; normalize?: boolean }
) => Promise<{ data: Float32Array; dims?: number[] }>;

/** Singleton pipeline promise to prevent multiple model loads in memory */
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
let currentModelName: string | null = null;

/**
 * Returns a cached singleton instance of the HuggingFace feature extraction pipeline.
 * 
 * VIVA EXPLANATION (WHY WE USE SINGLETON CACHING):
 * Neural network models occupy memory (~67MB for 8-bit quantized ONNX bge-small).
 * Instantiating a new pipeline for every chunk would exhaust RAM and cause massive
 * garbage collection pauses. A singleton ensures weights are loaded once into memory
 * and reused across all subsequent document ingestion and search requests.
 * 
 * @param {string} [modelName] Hugging Face model repository identifier
 * @param {boolean} [quantized=true] Whether to use 8-bit quantized ONNX weights
 * @returns {Promise<FeatureExtractionPipeline>} Cached pipeline instance
 */
export async function getEmbeddingPipeline(
  modelName: string = DEFAULT_EMBEDDING_MODEL,
  quantized: boolean = true
): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise || currentModelName !== modelName) {
    currentModelName = modelName;
    pipelinePromise = (async () => {
      // Create pipeline for dense feature extraction
      const pipe = await pipeline('feature-extraction', modelName, {
        quantized
      });
      return pipe as unknown as FeatureExtractionPipeline;
    })();
  }

  return pipelinePromise;
}

/**
 * Generates a dense 384-dimensional vector embedding for a single text query or passage.
 * 
 * VIVA EXPLANATION (WHY MEAN POOLING & L2 NORMALIZATION):
 * 1. Mean Pooling: The transformer produces one vector for every subword token. Mean pooling
 *    averages all token vectors to produce a single dense representation of the full passage.
 * 2. L2 Normalization: Scaling the vector to unit length (||v|| = 1.0) means Cosine Similarity
 *    between any two vectors is mathematically identical to their Dot Product (sum(u_i * v_i)).
 *    This eliminates expensive square root and division operations during vector database queries.
 * 
 * @param {string} text Raw text or user query to embed
 * @param {EmbeddingOptions} [options] Embedding options
 * @returns {Promise<EmbeddingVector>} 384-dimensional unit vector
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions = {}
): Promise<EmbeddingVector> {
  const modelName = options.modelName ?? DEFAULT_EMBEDDING_MODEL;
  const quantized = options.quantized ?? true;

  const pipe = await getEmbeddingPipeline(modelName, quantized);

  // BGE models require mean pooling and L2 normalization
  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true
  });

  const vector = Array.from(output.data as Float32Array);

  if (vector.length !== DEFAULT_EMBEDDING_DIMENSIONS && modelName === DEFAULT_EMBEDDING_MODEL) {
    throw new Error(
      `Embedding Error: Expected ${DEFAULT_EMBEDDING_DIMENSIONS} dimensions, received ${vector.length}.`
    );
  }

  return vector;
}

/**
 * Generates embeddings for a batch of DocumentChunks in memory-efficient groups.
 * 
 * VIVA EXPLANATION (WHY BATCHING ON CPU):
 * Feeding hundreds of chunks simultaneously to the ONNX runtime on a CPU causes
 * memory spikes and thread contention. Processing in small batches (e.g., 8 chunks)
 * keeps memory bounded and allows linear progression without freezing the Node event loop.
 * 
 * @param {DocumentChunk[]} chunks Array of chunks created in Phase 3
 * @param {EmbeddingOptions} [options] Embedding options (batchSize, modelName)
 * @returns {Promise<EmbeddingBatchResult>} Collection of enriched chunks with vectors
 */
export async function generateBatchEmbeddings(
  chunks: DocumentChunk[],
  options: EmbeddingOptions = {}
): Promise<EmbeddingBatchResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const modelName = options.modelName ?? DEFAULT_EMBEDDING_MODEL;
  const embeddedChunks: EmbeddedChunk[] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);

    // Process slice sequentially to ensure stable CPU thermal and memory behavior
    for (const chunk of slice) {
      const vector = await generateEmbedding(chunk.text, options);
      embeddedChunks.push({
        ...chunk,
        embedding: vector
      });
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    chunks: embeddedChunks,
    dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
    model: modelName,
    durationMs
  };
}

/**
 * Calculates the Cosine Similarity between two dense embedding vectors.
 * 
 * VIVA EXPLANATION (COSINE SIMILARITY IN RAG):
 * Cosine similarity measures the cosine of the angle between two vectors in 384-dimensional space:
 * cos(θ) = (A · B) / (||A|| * ||B||)
 * Value ranges from:
 *   1.0 -> Identical semantic meaning
 *   0.0 -> Orthogonal / completely unrelated
 *  -1.0 -> Exact opposite semantics
 * 
 * Because our vectors are L2-normalized during embedding generation (||A|| = ||B|| = 1.0),
 * the denominator is 1.0, and similarity simplifies to a simple dot product: sum(A_i * B_i).
 * 
 * @param {EmbeddingVector} vecA First dense vector
 * @param {EmbeddingVector} vecB Second dense vector
 * @returns {number} Cosine similarity score between -1.0 and 1.0
 */
export function cosineSimilarity(vecA: EmbeddingVector, vecB: EmbeddingVector): number {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector dimension mismatch: vector A has length ${vecA.length} while vector B has length ${vecB.length}.`
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  // If vectors are already normalized (normA ~ 1.0 and normB ~ 1.0), this equals dotProduct
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
