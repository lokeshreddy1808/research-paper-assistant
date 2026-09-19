import type { 
  ParsedDocument, 
  DocumentChunk, 
  ChunkingOptions, 
  ChunkingResult 
} from '@research-assistant/shared';
import { splitTextRecursively } from './textSplitter.js';

/**
 * Splits a full ParsedDocument into granular, citation-indexed DocumentChunk objects.
 * 
 * VIVA EXPLANATION (WHY WE CHUNK AT THE PAGE LEVEL):
 * 1. Strict Provenance Guarantee: By iterating page-by-page, every chunk is explicitly
 *    tied to its 1-indexed physical page number (`page.pageNumber`). This prevents cross-page
 *    hallucination where an AI cites Page 4 for a fact that was actually on Page 7.
 * 2. Scanned Page Handling: Pages flagged as scanned (less than 50 characters) are excluded
 *    from chunking to avoid injecting empty or noisy whitespace into the vector store.
 * 3. Token Estimation: We calculate `tokenEstimate` (~4 characters per token in English).
 *    This gives the retrieval pipeline an exact budget when building the final LLM prompt context.
 * 
 * @param {ParsedDocument} document Parsed document from Phase 2
 * @param {ChunkingOptions} [options] Custom chunking parameters (chunkSize, chunkOverlap)
 * @returns {ChunkingResult} Collection of structured chunks with exact page citations
 */
export function chunkDocument(
  document: ParsedDocument,
  options: ChunkingOptions = {}
): ChunkingResult {
  const allChunks: DocumentChunk[] = [];
  let globalChunkIndex = 0;

  const docTitle = document.metadata.title && document.metadata.title.trim()
    ? document.metadata.title.trim()
    : document.filename;

  for (const page of document.pages) {
    // Skip empty or scanned pages that lack extractable text
    if (page.isScanned || page.characterCount < 10) {
      continue;
    }

    // Split page text using recursive semantic boundary splitter
    const pageSplits = splitTextRecursively(page.text, options);

    pageSplits.forEach((chunkText) => {
      const charCount = chunkText.length;
      if (charCount < 5) return; // Discard tiny trailing artifacts

      const chunk: DocumentChunk = {
        id: `${document.id}-p${page.pageNumber}-c${globalChunkIndex}`,
        documentId: document.id,
        documentFilename: document.filename,
        documentTitle: docTitle,
        pageNumber: page.pageNumber,
        chunkIndex: globalChunkIndex,
        text: chunkText,
        characterCount: charCount,
        // Standard GPT / BGE tokenizer rule of thumb: ~4 characters per token
        tokenEstimate: Math.ceil(charCount / 4)
      };

      allChunks.push(chunk);
      globalChunkIndex++;
    });
  }

  return {
    documentId: document.id,
    totalChunks: allChunks.length,
    chunks: allChunks
  };
}
