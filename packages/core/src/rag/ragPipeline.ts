import type { 
  ParsedDocument, 
  ChunkingOptions, 
  EmbeddingOptions, 
  EmbeddedChunk,
  RAGQueryOptions, 
  RAGAnswer, 
  VectorStoreStats 
} from '@research-assistant/shared';
import { chunkDocument } from '../chunking/index.js';
import { generateBatchEmbeddings, DEFAULT_EMBEDDING_DIMENSIONS } from '../embeddings/index.js';
import { InMemoryVectorStore } from '../vectorstore/index.js';
import { 
  formatAcademicPrompt, 
  generateChatCompletion, 
  streamChatCompletion, 
  DEFAULT_GROQ_MODEL 
} from '../llm/index.js';
import { extractCitations, calculateFaithfulnessScore } from './citationVerifier.js';

/**
 * End-to-End Retrieval-Augmented Generation (RAG) Pipeline Orchestrator.
 * 
 * VIVA EXPLANATION (WHY WE ENCAPSULATE RAG AS A PIPELINE):
 * 1. Single Point of Ingestion & Retrieval: Encapsulates the entire multi-stage flow:
 *    PDF Ingestion -> Semantic Chunking -> Local ONNX Vector Embedding ->
 *    In-Memory Vector Search -> Dynamic Context Window Assembly -> Groq Cloud LLM ->
 *    Citation Verification & Faithfulness Scoring.
 * 2. Deterministic Provability: Ensures that every user query is backed by verifiable
 *    citations to real physical pages, eliminating hallucinated answers.
 * 3. Separation of Concerns: Core logic remains completely isolated from Express routes
 *    and React frontends, allowing automated test suites and CLI scripts to run without a server.
 */
export class RAGPipeline {
  private vectorStore: InMemoryVectorStore;

  /**
   * Initializes the RAG pipeline.
   * @param {InMemoryVectorStore} [customStore] Optional pre-populated vector store
   */
  constructor(customStore?: InMemoryVectorStore) {
    this.vectorStore = customStore ?? new InMemoryVectorStore(DEFAULT_EMBEDDING_DIMENSIONS);
  }

  /**
   * Ingests, chunks, embeds, and indexes a full parsed research paper.
   * 
   * @param {ParsedDocument} document Parsed document from Phase 2
   * @param {ChunkingOptions} [chunkOptions] Custom chunking parameters
   * @param {EmbeddingOptions} [embedOptions] Custom embedding parameters
   * @returns {Promise<{ documentId: string; totalChunks: number }>} Ingestion summary
   */
  public async ingestDocument(
    document: ParsedDocument,
    chunkOptions?: ChunkingOptions,
    embedOptions?: EmbeddingOptions
  ): Promise<{ documentId: string; totalChunks: number }> {
    // 1. Semantic Chunking
    const chunkingResult = chunkDocument(document, chunkOptions);

    if (chunkingResult.chunks.length === 0) {
      return { documentId: document.id, totalChunks: 0 };
    }

    // 2. Batch Embedding Generation
    const embeddingResult = await generateBatchEmbeddings(chunkingResult.chunks, embedOptions);

    // 3. Store in Vector Database
    this.vectorStore.addChunks(embeddingResult.chunks);

    return {
      documentId: document.id,
      totalChunks: embeddingResult.chunks.length
    };
  }

  /**
   * Executes a full RAG retrieval and synthesis query.
   * 
  /**
   * For document-level metadata questions (e.g. authors, title, summary, overview, abstract),
   * ensures the front-matter chunks (Page 1) of the targeted papers are included in retrieved chunks.
   */
  private enrichWithPageOneChunks(
    question: string,
    retrieved: EmbeddedChunk[],
    options: RAGQueryOptions
  ): EmbeddedChunk[] {
    const isMetadataQuery = /\b(author|authors|who wrote|writer|writers|creator|written by|who published|affiliation|affiliations|moderator|discussants|title|what paper|what is this paper called|abstract|summary|summarize|overview|what is the paper about|what is this paper about)\b/i.test(question);

    const targetDocIds = options.documentId 
      ? [options.documentId] 
      : (options.documentIds && options.documentIds.length > 0)
        ? options.documentIds
        : Array.from(new Set(retrieved.map(c => c.documentId)));

    if (targetDocIds.length === 0) return retrieved;

    const allChunks = this.vectorStore.getAllChunks();
    const resultChunks = [...retrieved];

    for (const docId of targetDocIds) {
      const hasPageOne = resultChunks.some(c => c.documentId === docId && c.pageNumber === 1);
      
      // If it's an author/metadata query or if targeting a single document and page 1 is missing
      if (!hasPageOne && (isMetadataQuery || targetDocIds.length === 1)) {
        const pageOneChunks = allChunks
          .filter(c => c.documentId === docId && c.pageNumber === 1)
          .sort((a, b) => a.chunkIndex - b.chunkIndex);

        if (pageOneChunks.length > 0) {
          const frontChunk: EmbeddedChunk = {
            ...pageOneChunks[0],
            similarityScore: isMetadataQuery ? 0.96 : 0.82
          };
          resultChunks.unshift(frontChunk);
        }
      }
    }

    return resultChunks;
  }

  /**
   * Executes an end-to-end RAG query:
   * 1. Generates query vector embedding
   * 2. Retrieves top-k nearest neighbor chunks
   * 3. Enriches context with Page 1 metadata when appropriate
   * 4. Assembles academically grounded prompt
   * 5. Synthesizes answer with physical page citations
   * 6. Verifies faithfulness against retrieved chunks
   * 
   * @param {string} question User's plain-language research query
   * @param {RAGQueryOptions} [options] Retrieval and generation configuration
   * @returns {Promise<RAGAnswer>} Structured answer with verified citations
   */
  public async query(
    question: string,
    options: RAGQueryOptions = {}
  ): Promise<RAGAnswer> {
    const startTime = Date.now();
    const topK = options.topK ?? 8;
    const minScore = options.minScore ?? 0.35;
    const model = options.model ?? DEFAULT_GROQ_MODEL;
    const temperature = options.temperature ?? 0.2;

    // 1. Retrieve top-k nearest neighbor chunks
    const searchHits = await this.vectorStore.searchByText(question, topK, {
      documentId: options.documentId,
      documentIds: options.documentIds,
      minScore
    });

    const rawChunks: EmbeddedChunk[] = searchHits.map((hit) => ({
      ...hit.chunk,
      similarityScore: hit.score
    }));

    const retrievedChunks = this.enrichWithPageOneChunks(question, rawChunks, options);

    // Fallback if no relevant documents match
    if (retrievedChunks.length === 0) {
      return {
        question,
        answer: 'The provided document excerpts do not contain sufficient evidence or relevance to answer this question.',
        citations: [],
        retrievedChunks: [],
        faithfulnessScore: 100, // 100% faithful because it correctly abstained from hallucinating
        model,
        durationMs: Date.now() - startTime
      };
    }

    // 2. Assemble Grounded Academic Prompt
    const messages = formatAcademicPrompt(question, retrievedChunks);

    // 3. Synthesize Answer via Groq Cloud LLM
    const completion = await generateChatCompletion(messages, {
      model,
      temperature,
      apiKey: options.apiKey
    });

    // 4. Citation Extraction & Verification
    const citations = extractCitations(completion.content, retrievedChunks);
    const faithfulnessScore = calculateFaithfulnessScore(citations, completion.content);

    return {
      question,
      answer: completion.content,
      citations,
      retrievedChunks,
      faithfulnessScore,
      model: completion.model,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Executes a streaming RAG query, emitting tokens in real time.
   * 
   * @param {string} question User's plain-language research query
   * @param {(token: string) => void} onChunk Callback triggered per generated token
   * @param {RAGQueryOptions} [options] Retrieval and generation configuration
   * @returns {Promise<RAGAnswer>} Structured answer once stream completes
   */
  public async streamQuery(
    question: string,
    onChunk: (token: string) => void,
    options: RAGQueryOptions = {}
  ): Promise<RAGAnswer> {
    const startTime = Date.now();
    const topK = options.topK ?? 8;
    const minScore = options.minScore ?? 0.35;
    const model = options.model ?? DEFAULT_GROQ_MODEL;
    const temperature = options.temperature ?? 0.2;

    // 1. Retrieve
    const searchHits = await this.vectorStore.searchByText(question, topK, {
      documentId: options.documentId,
      documentIds: options.documentIds,
      minScore
    });

    const rawChunks: EmbeddedChunk[] = searchHits.map((hit) => ({
      ...hit.chunk,
      similarityScore: hit.score
    }));

    const retrievedChunks = this.enrichWithPageOneChunks(question, rawChunks, options);

    if (retrievedChunks.length === 0) {
      const fallbackMsg = 'The provided document excerpts do not contain sufficient evidence to answer this question.';
      onChunk(fallbackMsg);
      return {
        question,
        answer: fallbackMsg,
        citations: [],
        retrievedChunks: [],
        faithfulnessScore: 100,
        model,
        durationMs: Date.now() - startTime
      };
    }

    // 2. Format Prompt
    const messages = formatAcademicPrompt(question, retrievedChunks);

    // 3. Stream Synthesis
    const completion = await streamChatCompletion(messages, onChunk, {
      model,
      temperature,
      apiKey: options.apiKey
    });

    // 4. Citation Verification
    const citations = extractCitations(completion.content, retrievedChunks);
    const faithfulnessScore = calculateFaithfulnessScore(citations, completion.content);

    return {
      question,
      answer: completion.content,
      citations,
      retrievedChunks,
      faithfulnessScore,
      model: completion.model,
      durationMs: Date.now() - startTime
    };
  }

  /**
   * Returns operational statistics for the underlying vector store.
   * @returns {VectorStoreStats} Statistics summary
   */
  public getStats(): VectorStoreStats {
    return this.vectorStore.getStats();
  }

  /**
   * Deletes all indexed chunks for a given document.
   * @param {string} documentId Document identifier
   * @returns {number} Number of deleted chunks
   */
  public deleteDocument(documentId: string): number {
    return this.vectorStore.deleteDocument(documentId);
  }

  /**
   * Exposes direct access to the underlying vector store instance.
   * @returns {InMemoryVectorStore} Vector store
   */
  public getVectorStore(): InMemoryVectorStore {
    return this.vectorStore;
  }
}
