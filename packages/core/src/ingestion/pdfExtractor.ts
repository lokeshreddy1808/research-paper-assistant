import { extractText, getMeta } from 'unpdf';
import { randomUUID } from 'node:crypto';
import { normalizeText } from './textNormalizer.js';
import { validatePdfBuffer, computeSha256 } from './pdfValidator.js';
import type { 
  ParsedDocument, 
  ExtractedPage, 
  DocumentMetadata, 
  IngestionOptions 
} from '@research-assistant/shared';

const DEFAULT_SCANNED_THRESHOLD = 50;

/**
 * Parses an academic PDF buffer into structured page-by-page text with metadata.
 * 
 * VIVA EXPLANATION (WHY WE DO THIS):
 * 1. Exact Citations: By extracting page-by-page and storing an explicit 1-indexed `pageNumber`,
 *    every subsequent chunk and retrieval result knows its exact physical source page.
 * 2. Scanned Page Detection: Pages with fewer than 50 extracted characters are usually
 *    rasterized image scans or empty cover sheets. Flagging them warns the user that OCR
 *    would be required to read those pages.
 * 
 * @param {Uint8Array} buffer Raw binary data of the PDF
 * @param {string} filename Original filename of the document
 * @param {IngestionOptions} [options] Optional configuration parameters
 * @returns {Promise<ParsedDocument>} Structured document object ready for chunking
 */
export async function extractPdfDocument(
  buffer: Uint8Array,
  filename: string,
  options: IngestionOptions = {}
): Promise<ParsedDocument> {
  // Step 1: Validate file buffer integrity and size
  validatePdfBuffer(buffer, options.maxFileSizeBytes);

  // Capture buffer length before potential ArrayBuffer transfer in pdf.js
  const fileSizeBytes = buffer.length;

  // Step 2: Compute deterministic SHA-256 fingerprint
  const sha256 = computeSha256(buffer);

  // Step 3: Extract text page-by-page using unpdf (pdfjs-dist engine)
  const extractionResult = await extractText(buffer, { mergePages: false });
  const rawPages: string[] = Array.isArray(extractionResult.text) 
    ? extractionResult.text 
    : [String(extractionResult.text)];

  const scannedThreshold = options.scannedThresholdChars ?? DEFAULT_SCANNED_THRESHOLD;

  // Step 4: Map raw pages to normalized ExtractedPage models with 1-indexed numbering
  const pages: ExtractedPage[] = rawPages.map((rawContent, index) => {
    const cleaned = normalizeText(rawContent);
    const charCount = cleaned.length;
    return {
      pageNumber: index + 1, // 1-indexed for human academic citations
      text: cleaned,
      characterCount: charCount,
      isScanned: charCount < scannedThreshold
    };
  });

  // Step 5: Extract embedded PDF document metadata
  let docMetadata: DocumentMetadata = {
    totalPages: extractionResult.totalPages || pages.length
  };

  try {
    const meta = await getMeta(buffer);
    if (meta && typeof meta === 'object') {
      const info = (meta as { info?: Record<string, unknown> }).info || {};
      docMetadata = {
        title: typeof info.Title === 'string' && info.Title.trim() ? info.Title.trim() : undefined,
        author: typeof info.Author === 'string' && info.Author.trim() ? info.Author.trim() : undefined,
        creationDate: typeof info.CreationDate === 'string' ? info.CreationDate : undefined,
        formatVersion: typeof info.PDFFormatVersion === 'string' ? info.PDFFormatVersion : undefined,
        producer: typeof info.Producer === 'string' ? info.Producer : undefined,
        totalPages: extractionResult.totalPages || pages.length
      };
    }
  } catch {
    // Non-fatal if PDF metadata stream is unparseable or stripped
  }

  return {
    id: randomUUID(),
    filename,
    sha256,
    fileSizeBytes,
    totalPages: extractionResult.totalPages || pages.length,
    pages,
    metadata: docMetadata,
    createdAt: new Date().toISOString()
  };
}
