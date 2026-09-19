import type { ChunkingOptions } from '@research-assistant/shared';

/** Default target chunk size in characters (approx ~350 tokens).
 *  Larger chunks give BGE embedding models more context to form rich semantic vectors.
 *  Research papers average 4-6 sentences per paragraph; 1400 chars ≈ 3 dense paragraphs.
 */
export const DEFAULT_CHUNK_SIZE = 1400;

/** Default overlap in characters between adjacent chunks.
 *  200-char overlap ≈ 1 sentence, preventing cross-boundary semantic breaks.
 */
export const DEFAULT_CHUNK_OVERLAP = 200;

/** Default hierarchical split separators in priority order */
export const DEFAULT_SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', '; ', ', ', ' '];

/**
 * Recursively splits a string into chunks respecting natural language boundaries.
 * 
 * VIVA EXPLANATION (WHY WE CHUNK LIKE THIS):
 * 1. Semantic Integrity: Fixed character slices (e.g., cutting every 800 characters blindly)
 *    slice words, numbers, and formulas in half. Recursive splitting attempts to divide
 *    text at natural grammatical boundaries: paragraphs first (\n\n), then sentences (. / ? / !),
 *    then clauses (, / ;), and finally words (spaces).
 * 2. Optimal Embedding Density: Embedding models like BAAI/bge-small-en-v1.5 work best on
 *    passages between 150-250 tokens (~600-1000 characters). Chunks smaller than 100 chars
 *    lack sufficient context, while chunks over 2000 chars dilute specific technical findings.
 * 3. Overlap Preservation: If a critical conclusion begins at the very end of Chunk A and finishes
 *    at the start of Chunk B, an overlap of ~120 characters ensures both chunks retain the complete thought.
 * 
 * @param {string} text Raw text to split into semantic chunks
 * @param {ChunkingOptions} [options] Custom chunking parameters
 * @returns {string[]} Array of semantically coherent text chunks
 */
export function splitTextRecursively(
  text: string,
  options: ChunkingOptions = {}
): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
  const separators = options.separators ?? DEFAULT_SEPARATORS;

  if (chunkOverlap >= chunkSize) {
    throw new Error(
      `Chunking Error: chunkOverlap (${chunkOverlap}) must be strictly smaller than chunkSize (${chunkSize}).`
    );
  }

  const trimmed = text.trim();
  if (!trimmed) return [];

  // Base case: if text is already within target chunk size, return as single chunk
  if (trimmed.length <= chunkSize) {
    return [trimmed];
  }

  return splitText(trimmed, chunkSize, chunkOverlap, separators);
}

function splitText(
  text: string,
  chunkSize: number,
  chunkOverlap: number,
  separators: string[]
): string[] {
  const finalChunks: string[] = [];

  // Find the highest-priority separator present in text
  let chosenSeparator = '';
  let nextSeparators: string[] = [];

  for (let i = 0; i < separators.length; i++) {
    const sep = separators[i];
    if (sep === '') {
      chosenSeparator = sep;
      break;
    }
    if (text.includes(sep)) {
      chosenSeparator = sep;
      nextSeparators = separators.slice(i + 1);
      break;
    }
  }

  // Split text by the chosen separator
  const rawSplits = chosenSeparator ? text.split(chosenSeparator) : text.split('');
  const goodSplits: string[] = [];

  for (const s of rawSplits) {
    if (s.length <= chunkSize) {
      goodSplits.push(s);
    } else {
      // If we accumulated goodSplits before this oversized segment, merge and emit them first
      if (goodSplits.length > 0) {
        const merged = mergeSplits(goodSplits, chosenSeparator, chunkSize, chunkOverlap);
        finalChunks.push(...merged);
        goodSplits.length = 0;
      }
      // If no separators remain, hard-slice the oversized segment
      if (nextSeparators.length === 0) {
        const step = Math.max(1, chunkSize - chunkOverlap);
        for (let i = 0; i < s.length; i += step) {
          const slice = s.slice(i, i + chunkSize).trim();
          if (slice.length > 0) {
            finalChunks.push(slice);
          }
        }
      } else {
        // Recurse on the oversized segment using subsequent finer separators
        const subChunks = splitText(s, chunkSize, chunkOverlap, nextSeparators);
        finalChunks.push(...subChunks);
      }
    }
  }

  // Merge any remaining segments in goodSplits
  if (goodSplits.length > 0) {
    const merged = mergeSplits(goodSplits, chosenSeparator, chunkSize, chunkOverlap);
    finalChunks.push(...merged);
  }

  return finalChunks;
}

/**
 * Merges split segments into coherent chunks respecting chunkSize and chunkOverlap.
 */
function mergeSplits(
  splits: string[],
  separator: string,
  chunkSize: number,
  chunkOverlap: number
): string[] {
  const docs: string[] = [];
  const currentDoc: string[] = [];
  let total = 0;

  for (const piece of splits) {
    const trimmedPiece = piece.trim();
    if (!trimmedPiece) continue;

    const pieceLen = trimmedPiece.length;
    const sepLen = currentDoc.length > 0 ? separator.length : 0;

    // Check if adding this piece exceeds the chunkSize boundary
    if (total + pieceLen + sepLen > chunkSize) {
      if (currentDoc.length > 0) {
        const doc = currentDoc.join(separator).trim();
        if (doc.length > 0) {
          docs.push(doc);
        }
        // Maintain overlap window by dropping earliest elements until:
        // 1. Total overlap is within target chunkOverlap, AND
        // 2. Total overlap + upcoming piece fits within chunkSize
        while (
          currentDoc.length > 0 &&
          (total > chunkOverlap ||
            total + pieceLen + (currentDoc.length > 0 ? separator.length : 0) > chunkSize)
        ) {
          const removed = currentDoc.shift();
          if (!removed) break;
          const removedSepLen = currentDoc.length > 0 ? separator.length : 0;
          total -= (removed.length + removedSepLen);
        }
      }
    }

    currentDoc.push(trimmedPiece);
    total += pieceLen + (currentDoc.length > 1 ? separator.length : 0);
  }

  if (currentDoc.length > 0) {
    const doc = currentDoc.join(separator).trim();
    if (doc.length > 0) {
      docs.push(doc);
    }
  }

  return docs;
}
