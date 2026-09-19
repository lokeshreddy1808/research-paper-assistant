import { createHash } from 'node:crypto';

/** Default max file size: 25 Megabytes */
const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Validates raw file buffer to guarantee it is a valid, readable PDF document.
 * 
 * VIVA EXPLANATION (WHY WE DO THIS):
 * 1. File extensions can be spoofed (e.g. an executable renamed to .pdf). We check the 
 *    first 5 bytes for the `%PDF-` magic header (ASCII: 0x25 0x50 0x44 0x46 0x2D).
 * 2. Unchecked file sizes can cause Node.js Out-Of-Memory (OOM) crashes.
 * 
 * @param {Uint8Array} buffer Raw binary data of the file
 * @param {number} [maxSizeBytes] Maximum allowable size in bytes
 * @throws {Error} If the buffer is empty, exceeds limit, or lacks PDF magic header
 */
export function validatePdfBuffer(buffer: Uint8Array, maxSizeBytes = DEFAULT_MAX_SIZE_BYTES): void {
  if (!buffer || buffer.length === 0) {
    throw new Error('Validation Error: Uploaded PDF buffer is empty.');
  }

  if (buffer.length > maxSizeBytes) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    const limitMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    throw new Error(`Validation Error: File size (${sizeMb} MB) exceeds allowable maximum of ${limitMb} MB.`);
  }

  // Check `%PDF-` magic header bytes (0x25, 0x50, 0x44, 0x46, 0x2D)
  const isPdfHeader = 
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d;   // -

  if (!isPdfHeader) {
    throw new Error('Validation Error: File is not a valid PDF (missing %PDF- magic header).');
  }
}

/**
 * Computes a SHA-256 cryptographic hash of the document binary content.
 * 
 * VIVA EXPLANATION (WHY WE DO THIS):
 * In a multi-document RAG system, researchers frequently re-upload the same paper.
 * Computing a SHA-256 hash gives a deterministic, tamper-proof document fingerprint.
 * This prevents duplicate vector indexing and saves compute/storage costs.
 * 
 * @param {Uint8Array} buffer Raw binary data of the file
 * @returns {string} 64-character hexadecimal SHA-256 checksum
 */
export function computeSha256(buffer: Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex');
}
