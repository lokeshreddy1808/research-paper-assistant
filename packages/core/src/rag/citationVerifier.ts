import type { Citation, EmbeddedChunk } from '@research-assistant/shared';

/**
 * Extracts and verifies academic citations from an LLM-synthesized answer against source chunks.
 * 
 * VIVA EXPLANATION (WHY CITATION VERIFICATION & FAITHFULNESS SCORE):
 * 1. The RAG Triad: In academic literature (e.g. TruLens / Ragas frameworks), RAG pipelines
 *    are evaluated on three pillars:
 *    a) Context Relevance: Are the retrieved chunks relevant to the query?
 *    b) Groundedness / Faithfulness: Is the answer strictly derived from the context?
 *    c) Answer Relevance: Does the answer directly address the user's query?
 * 2. Hallucination Guardrail: LLMs frequently hallucinate plausible-sounding citations.
 *    By programmatically cross-checking every cited page tag (e.g., [Page 3]) against the
 *    retrieved chunk provenance, we detect hallucinated citations before presenting them to the user.
 * 3. Click-to-Page Navigation: Every verified citation exposes an excerpt and page number,
 *    allowing the web UI to jump directly to that page in the PDF viewer.
 * 
 * @param {string} answer The raw text answer produced by the LLM
 * @param {EmbeddedChunk[]} retrievedChunks Source chunks supplied in the context window
 * @returns {Citation[]} Array of extracted citations with verification flags
 */
export function extractCitations(
  answer: string,
  retrievedChunks: EmbeddedChunk[]
): Citation[] {
  // Matches [Page X], [p. X], [filename.pdf, Page X], [filename.pdf - Page X]
  const citationRegex = /\[(?:([a-zA-Z0-9_\-\.\s]+?)(?:,|\s*-\s*|\s*:\s*)\s*)?(?:Page|p\.)\s*(\d+)(?:-\d+)?\]/gi;
  const citations: Citation[] = [];
  const seenPages = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = citationRegex.exec(answer)) !== null) {
    const rawFilename = match[1]?.trim();
    const pageNumber = parseInt(match[2], 10);
    const key = `${rawFilename ?? ''}-p${pageNumber}`;

    if (seenPages.has(key)) {
      continue;
    }
    seenPages.add(key);

    // Look for matching chunk in the retrieved context window
    const matchingChunk = retrievedChunks.find((chunk) => {
      const pageMatches = chunk.pageNumber === pageNumber;
      if (!rawFilename) {
        return pageMatches;
      }
      return pageMatches && chunk.documentFilename.toLowerCase().includes(rawFilename.toLowerCase());
    });

    if (matchingChunk) {
      citations.push({
        pageNumber,
        documentFilename: matchingChunk.documentFilename,
        excerpt: matchingChunk.text.slice(0, 160).trim() + (matchingChunk.text.length > 160 ? '...' : ''),
        chunkId: matchingChunk.id,
        verified: true
      });
    } else {
      // Citation cited a page NOT provided in the retrieved context
      citations.push({
        pageNumber,
        documentFilename: rawFilename,
        excerpt: 'Warning: This cited page was not in the retrieved source context.',
        chunkId: 'unverified',
        verified: false
      });
    }
  }

  return citations;
}

/**
 * Computes the Faithfulness Score (0-100%) indicating the proportion of verified citations.
 * 
 * @param {Citation[]} citations Extracted citations from the answer
 * @param {string} answer Full answer text
 * @returns {number} Faithfulness percentage between 0 and 100
 */
export function calculateFaithfulnessScore(
  citations: Citation[],
  answer: string
): number {
  if (citations.length === 0) {
    // If no citations exist, check if the LLM explicitly declared insufficient evidence
    const declaredInsufficient = 
      answer.toLowerCase().includes('not contain sufficient') ||
      answer.toLowerCase().includes('insufficient evidence');
    
    // If it properly declared lack of evidence, it is 100% faithful to the grounding rule
    return declaredInsufficient ? 100 : 50;
  }

  const verifiedCount = citations.filter((c) => c.verified).length;
  return Math.round((verifiedCount / citations.length) * 100);
}
