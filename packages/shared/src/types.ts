/**
 * Shared type definitions across API, Core, and Frontend.
 * Maintained in TypeScript strict mode with explicit type hints.
 */

export interface HealthResponse {
  ok: boolean;
  version: string;
  uptime: number;
}

/**
 * Individual page extracted from a PDF document.
 * 1-indexed page numbering is strictly preserved for academic citations.
 */
export interface ExtractedPage {
  /** 1-indexed page number matching physical document page */
  pageNumber: number;
  /** Normalized plain text extracted from this page */
  text: string;
  /** Total characters extracted on this page */
  characterCount: number;
  /** True if text length is below threshold (< 50 chars), indicating image/scanned content */
  isScanned: boolean;
}

/**
 * Metadata extracted from PDF header and structural dictionary.
 */
export interface DocumentMetadata {
  title?: string;
  author?: string;
  creationDate?: string;
  formatVersion?: string;
  producer?: string;
  totalPages?: number;
}

/**
 * Full representation of an ingested academic research paper.
 */
export interface ParsedDocument {
  /** Unique document identifier (UUID v4) */
  id: string;
  /** Original file name (e.g. Attention_Is_All_You_Need.pdf) */
  filename: string;
  /** SHA-256 cryptographic checksum of raw binary buffer */
  sha256: string;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Total physical pages in document */
  totalPages: number;
  /** Page-by-page extracted content */
  pages: ExtractedPage[];
  /** PDF metadata dictionary if present */
  metadata: DocumentMetadata;
  /** ISO timestamp when parsed */
  createdAt: string;
}

/**
 * Configuration options for the PDF ingestion pipeline.
 */
export interface IngestionOptions {
  /** Maximum allowable file size in bytes (default: 25 MB) */
  maxFileSizeBytes?: number;
  /** Character threshold below which a page is flagged as scanned/empty (default: 50) */
  scannedThresholdChars?: number;
}

/**
 * Result returned by the ingestion service.
 */
export interface IngestionResult {
  success: boolean;
  document?: ParsedDocument;
  error?: string;
}

/**
 * A semantic chunk of text derived from a research paper page.
 * Carries physical page provenance for academic citations.
 */
export interface DocumentChunk {
  /** Unique chunk identifier, formatted as `${documentId}-p${pageNumber}-c${chunkIndex}` */
  id: string;
  /** Foreign key pointing to parent document ID */
  documentId: string;
  /** Filename of the source document */
  documentFilename: string;
  /** Optional academic paper title if extracted from metadata or headers */
  documentTitle?: string;
  /** 1-indexed page number where this chunk was located */
  pageNumber: number;
  /** Sequential zero-indexed counter for this chunk in the document */
  chunkIndex: number;
  /** The semantic passage text */
  text: string;
  /** Total characters in this chunk */
  characterCount: number;
  /** Approximate token count based on standard English ratio (~4 chars per token) */
  tokenEstimate: number;
}

/**
 * Hyperparameters controlling recursive semantic chunking.
 */
export interface ChunkingOptions {
  /** Target maximum character length per chunk (default: 800) */
  chunkSize?: number;
  /** Overlap character count between consecutive chunks (default: 120) */
  chunkOverlap?: number;
  /** Hierarchical list of split separators in priority order */
  separators?: string[];
}

/**
 * Result produced after chunking a full document.
 */
export interface ChunkingResult {
  documentId: string;
  totalChunks: number;
  chunks: DocumentChunk[];
}

/**
 * A dense floating-point vector representing text in semantic hyperspace.
 * For BAAI/bge-small-en-v1.5, length is exactly 384 dimensions.
 */
export type EmbeddingVector = number[];

/**
 * An enriched DocumentChunk that includes its pre-computed embedding vector.
 */
export interface EmbeddedChunk extends DocumentChunk {
  /** Dense vector embedding (384 dimensions for bge-small-en-v1.5) */
  embedding: EmbeddingVector;
  /** Optional cosine similarity score (0.00 to 1.00) when returned from vector search */
  similarityScore?: number;
}

/**
 * Options for local vector embedding generation.
 */
export interface EmbeddingOptions {
  /** HuggingFace model repository ID (default: 'Xenova/bge-small-en-v1.5') */
  modelName?: string;
  /** Whether to use 8-bit quantized ONNX weights for fast CPU inference (default: true) */
  quantized?: boolean;
  /** Batch size when processing multiple chunks (default: 8) */
  batchSize?: number;
}

/**
 * Result returned after batch embedding a set of chunks.
 */
export interface EmbeddingBatchResult {
  /** All chunks enriched with their embedding vectors */
  chunks: EmbeddedChunk[];
  /** Vector dimensionality (e.g. 384) */
  dimensions: number;
  /** Model identifier used for generation */
  model: string;
  /** Total inference duration in milliseconds */
  durationMs: number;
}

/**
 * Query filter for constraining nearest-neighbor search.
 */
export interface VectorFilter {
  /** Filter to chunks originating from a specific document ID */
  documentId?: string;
  /** Filter to chunks matching any of specific document IDs */
  documentIds?: string[];
  /** Filter to chunks matching a specific physical page number */
  pageNumber?: number;
  /** Minimum similarity score threshold (0.0 to 1.0) */
  minScore?: number;
}

/**
 * Result returned from a nearest-neighbor vector search.
 */
export interface SearchResult {
  /** The matched chunk and its metadata */
  chunk: EmbeddedChunk;
  /** Cosine similarity score (0.0 to 1.0) */
  score: number;
}

/**
 * Operational statistics of the in-memory vector store.
 */
export interface VectorStoreStats {
  /** Total number of vector-indexed chunks */
  totalChunks: number;
  /** Total distinct documents currently stored */
  totalDocuments: number;
  /** Vector dimensionality of stored embeddings */
  dimensions: number;
  /** List of distinct document IDs */
  documentIds: string[];
}

/**
 * Schema for serialized on-disk backup of the vector database.
 */
export interface SerializedVectorStore {
  version: string;
  dimensions: number;
  chunks: EmbeddedChunk[];
  savedAt: string;
}

/**
 * Chat message conforming to standard chat completion format.
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Hyperparameters and options for LLM text generation.
 */
export interface LLMGenerationOptions {
  /** Model identifier (default: 'llama-3.3-70b-versatile') */
  model?: string;
  /** Sampling temperature between 0.0 (deterministic) and 2.0 (creative) (default: 0.2) */
  temperature?: number;
  /** Maximum number of tokens to generate (default: 1024) */
  maxTokens?: number;
  /** Custom API key overriding environment variables */
  apiKey?: string;
  /** Optional custom base URL */
  baseUrl?: string;
}

/**
 * Token usage accounting returned by the LLM provider.
 */
export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Final structured response returned by non-streaming LLM generation.
 */
export interface LLMResponse {
  /** Generated text answer */
  content: string;
  /** Model ID that generated the completion */
  model: string;
  /** Token usage statistics if provided by API */
  usage?: LLMUsage;
  /** End-to-end duration in milliseconds */
  durationMs: number;
}

/**
 * Verified citation linking an answer claim to a specific physical page in a source paper.
 */
export interface Citation {
  /** 1-indexed page number in the original PDF */
  pageNumber: number;
  /** Document filename where the citation resides */
  documentFilename?: string;
  /** Direct excerpt from the source chunk backing the claim */
  excerpt: string;
  /** ID of the matching chunk */
  chunkId: string;
  /** True if the cited page and text exist in the retrieved context chunks */
  verified: boolean;
}

/**
 * Options configuring the end-to-end RAG retrieval and synthesis query.
 */
export interface RAGQueryOptions {
  /** Optional restriction to a single paper */
  documentId?: string;
  /** Optional restriction to multiple selected papers */
  documentIds?: string[];
  /** Number of chunks to retrieve for context window (default: 4) */
  topK?: number;
  /** Minimum similarity score threshold (default: 0.50) */
  minScore?: number;
  /** Optional custom LLM model */
  model?: string;
  /** Temperature for answer generation (default: 0.2) */
  temperature?: number;
  /** Optional Groq API Key passed from client or environment */
  apiKey?: string;
}

/**
 * Complete, structured RAG answer with verified page citations and provenance metadata.
 */
export interface RAGAnswer {
  /** The original question asked */
  question: string;
  /** Synthesized natural language answer */
  answer: string;
  /** Extracted and verified page-level citations */
  citations: Citation[];
  /** Underlying retrieved chunks that formed the context window */
  retrievedChunks: EmbeddedChunk[];
  /** Percentage (0-100%) of citations successfully verified against retrieved sources */
  faithfulnessScore: number;
  /** Model identifier used for generation */
  model: string;
  /** Total pipeline execution time in milliseconds */
  durationMs: number;
}

/**
 * Summary representation of an indexed paper displayed in the document library UI.
 */
export interface DocumentSummary {
  id: string;
  filename: string;
  title?: string;
  totalPages: number;
  totalChunks: number;
  fileSizeBytes: number;
  sha256: string;
  createdAt: string;
}

/**
 * Response payload returned after uploading and ingesting a document.
 */
export interface UploadDocumentResponse {
  ok: boolean;
  document: DocumentSummary;
  message?: string;
}

/**
 * Request body sent to POST /api/rag/query or /api/rag/stream.
 */
export interface QueryRequest {
  question: string;
  documentId?: string;
  documentIds?: string[];
  topK?: number;
  minScore?: number;
  model?: string;
  temperature?: number;
  apiKey?: string;
}

/**
 * Response payload returned from POST /api/rag/query.
 */
export interface QueryResponse {
  ok: boolean;
  result: RAGAnswer;
}

/**
 * Response payload returned after deleting a document.
 */
export interface DeleteDocumentResponse {
  ok: boolean;
  documentId: string;
  deletedChunks: number;
}
