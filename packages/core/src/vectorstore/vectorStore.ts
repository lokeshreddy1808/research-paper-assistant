import fs from 'node:fs/promises';
import path from 'node:path';
import type { 
  EmbeddedChunk, 
  EmbeddingVector, 
  SearchResult, 
  VectorFilter, 
  VectorStoreStats, 
  SerializedVectorStore 
} from '@research-assistant/shared';
import { 
  cosineSimilarity, 
  generateEmbedding, 
  DEFAULT_EMBEDDING_DIMENSIONS 
} from '../embeddings/index.js';

/**
 * In-memory vector store providing high-speed exact nearest-neighbor search.
 * 
 * VIVA EXPLANATION (WHY IN-MEMORY EXACT k-NN INSTEAD OF EXTERNAL DB):
 * 1. 100% Precision & Recall: Approximate Nearest Neighbor (ANN) algorithms (like HNSW or IVF)
 *    trade search accuracy for speed on millions of vectors. For academic papers (tens to thousands
 *    of chunks), exact dot-product scanning provides 100% true nearest-neighbor recall with zero loss.
 * 2. Blazing Sub-Millisecond Speed: Scanning 1,000 vectors of 384 dimensions on modern CPUs takes
 *    less than 0.5 milliseconds using contiguous array loops.
 * 3. Zero Operational Overhead: No background daemon, no Docker containers, no network roundtrips,
 *    and no database connection pool to manage or fail during viva presentation.
 * 4. Rich Metadata Filtering: Chunks can be pre-filtered or post-filtered by document ID and
 *    page number before/during ranking.
 */
export class InMemoryVectorStore {
  private chunks: Map<string, EmbeddedChunk> = new Map();
  private readonly dimensions: number;

  /**
   * Initializes a new in-memory vector store.
   * @param {number} [dimensions=384] Expected vector dimensionality
   */
  constructor(dimensions: number = DEFAULT_EMBEDDING_DIMENSIONS) {
    this.dimensions = dimensions;
  }

  /**
   * Adds an array of embedded chunks to the vector store.
   * Chunks with existing IDs are replaced (upsert semantics).
   * 
   * @param {EmbeddedChunk[]} chunks Enriched chunks containing embedding vectors
   */
  public addChunks(chunks: EmbeddedChunk[]): void {
    for (const chunk of chunks) {
      if (!chunk.embedding || chunk.embedding.length !== this.dimensions) {
        throw new Error(
          `Vector Store Error: Chunk "${chunk.id}" vector length (${chunk.embedding?.length ?? 0}) does not match store dimensionality (${this.dimensions}).`
        );
      }
      this.chunks.set(chunk.id, chunk);
    }
  }

  /**
   * Performs nearest-neighbor search for a query embedding vector.
   * 
   * @param {EmbeddingVector} queryVector 384-dimensional query vector
   * @param {number} [topK=4] Number of top results to return
   * @param {VectorFilter} [filter] Optional constraints (documentId, pageNumber, minScore)
   * @returns {SearchResult[]} Top ranked chunks sorted by descending similarity
   */
  public search(
    queryVector: EmbeddingVector,
    topK: number = 4,
    filter?: VectorFilter
  ): SearchResult[] {
    if (queryVector.length !== this.dimensions) {
      throw new Error(
        `Vector Store Search Error: Query vector dimension (${queryVector.length}) does not match store dimension (${this.dimensions}).`
      );
    }

    if (this.chunks.size === 0) {
      return [];
    }

    const minScore = filter?.minScore ?? -1.0;
    const scoredResults: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      // Apply metadata filter before computing similarity to minimize CPU cycles
      if (filter?.documentId && chunk.documentId !== filter.documentId) {
        continue;
      }
      if (filter?.documentIds && filter.documentIds.length > 0 && !filter.documentIds.includes(chunk.documentId)) {
        continue;
      }
      if (filter?.pageNumber !== undefined && chunk.pageNumber !== filter.pageNumber) {
        continue;
      }

      const score = cosineSimilarity(queryVector, chunk.embedding);

      if (score >= minScore) {
        scoredResults.push({ chunk, score });
      }
    }

    // Sort descending by cosine similarity score
    scoredResults.sort((a, b) => b.score - a.score);

    return scoredResults.slice(0, Math.max(1, topK));
  }

  /**
   * High-level convenience method: generates query embedding on the fly and retrieves nearest chunks.
   * 
   * @param {string} queryText User's plain language question
   * @param {number} [topK=4] Number of chunks to retrieve
   * @param {VectorFilter} [filter] Optional metadata filter
   * @returns {Promise<SearchResult[]>} Ranked nearest neighbor results
   */
  public async searchByText(
    queryText: string,
    topK: number = 4,
    filter?: VectorFilter
  ): Promise<SearchResult[]> {
    const queryVector = await generateEmbedding(queryText);
    return this.search(queryVector, topK, filter);
  }

  /**
   * Deletes all chunks associated with a specific document ID.
   * 
   * @param {string} documentId Unique identifier of document to remove
   * @returns {number} Number of chunks deleted
   */
  public deleteDocument(documentId: string): number {
    let deletedCount = 0;
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  /**
   * Retrieves all currently stored chunks.
   * @returns {EmbeddedChunk[]} Array of all embedded chunks
   */
  public getAllChunks(): EmbeddedChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Returns operational statistics about the current vector store.
   * @returns {VectorStoreStats} Store statistics
   */
  public getStats(): VectorStoreStats {
    const docIds = new Set<string>();
    for (const chunk of this.chunks.values()) {
      docIds.add(chunk.documentId);
    }

    return {
      totalChunks: this.chunks.size,
      totalDocuments: docIds.size,
      dimensions: this.dimensions,
      documentIds: Array.from(docIds)
    };
  }

  /**
   * Clears all chunks from the vector store.
   */
  public clear(): void {
    this.chunks.clear();
  }

  /**
   * Serializes the vector store to a JSON string for backup or disk persistence.
   * @returns {string} JSON-serialized representation
   */
  public serialize(): string {
    const backup: SerializedVectorStore = {
      version: '1.0.0',
      dimensions: this.dimensions,
      chunks: Array.from(this.chunks.values()),
      savedAt: new Date().toISOString()
    };
    return JSON.stringify(backup);
  }

  /**
   * Deserializes a JSON string into a populated InMemoryVectorStore.
   * 
   * @param {string} json Serialized JSON string
   * @returns {InMemoryVectorStore} Restored vector store instance
   */
  public static deserialize(json: string): InMemoryVectorStore {
    const backup = JSON.parse(json) as SerializedVectorStore;
    const store = new InMemoryVectorStore(backup.dimensions);
    store.addChunks(backup.chunks);
    return store;
  }

  /**
   * Saves the vector store state to a local JSON file.
   * 
   * @param {string} filePath File destination path
   */
  public async saveToFile(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, this.serialize(), 'utf-8');
  }

  /**
   * Restores a vector store from a local JSON file.
   * 
   * @param {string} filePath Source file path
   * @returns {Promise<InMemoryVectorStore>} Restored vector store
   */
  public static async loadFromFile(filePath: string): Promise<InMemoryVectorStore> {
    const content = await fs.readFile(filePath, 'utf-8');
    return InMemoryVectorStore.deserialize(content);
  }
}
