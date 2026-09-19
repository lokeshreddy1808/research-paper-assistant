import { RAGPipeline } from '@research-assistant/core';
import type { 
  ParsedDocument, 
  DocumentSummary, 
  VectorStoreStats 
} from '@research-assistant/shared';
import { logger } from '../lib/logger.js';

/**
 * In-memory document registry storing full ParsedDocument objects alongside summary metadata.
 */
class DocumentRegistryService {
  private pipeline: RAGPipeline;
  private documents: Map<string, ParsedDocument> = new Map();
  private summaries: Map<string, DocumentSummary> = new Map();

  constructor() {
    this.pipeline = new RAGPipeline();
    logger.info('Initialized RAGPipeline singleton service');
  }

  /**
   * Returns the singleton RAGPipeline instance.
   */
  public getPipeline(): RAGPipeline {
    return this.pipeline;
  }

  /**
   * Registers an ingested document into the active registry.
   */
  public registerDocument(
    document: ParsedDocument,
    totalChunks: number
  ): DocumentSummary {
    const summary: DocumentSummary = {
      id: document.id,
      filename: document.filename,
      title: document.metadata.title || document.filename,
      totalPages: document.totalPages,
      totalChunks,
      fileSizeBytes: document.fileSizeBytes,
      sha256: document.sha256,
      createdAt: document.createdAt
    };

    this.documents.set(document.id, document);
    this.summaries.set(document.id, summary);
    logger.info({ id: document.id, filename: document.filename, totalChunks }, 'Document registered in RAG service');

    return summary;
  }

  /**
   * Returns summaries of all currently indexed documents.
   */
  public listDocuments(): DocumentSummary[] {
    return Array.from(this.summaries.values());
  }

  /**
   * Retrieves full parsed document model by ID.
   */
  public getDocument(id: string): ParsedDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Deletes a document from both registry and underlying vector store.
   */
  public deleteDocument(id: string): { deleted: boolean; deletedChunks: number } {
    if (!this.summaries.has(id)) {
      return { deleted: false, deletedChunks: 0 };
    }

    const deletedChunks = this.pipeline.deleteDocument(id);
    this.documents.delete(id);
    this.summaries.delete(id);
    logger.info({ id, deletedChunks }, 'Document and chunks deleted from RAG service');

    return { deleted: true, deletedChunks };
  }

  /**
   * Returns operational statistics of the underlying vector store.
   */
  public getStats(): VectorStoreStats {
    return this.pipeline.getStats();
  }
}

export const ragService = new DocumentRegistryService();
