/**
 * Cleans, normalizes, and sanitizes raw extracted text from PDF streams.
 * 
 * VIVA EXPLANATION (WHY WE DO THIS):
 * 1. PDF streams encode text visually rather than semantically. Words split across lines
 *    often contain soft hyphens (ASCII \u00ad or -\n), which ruin vector embedding lookup.
 *    For example, "trans-\nformer" would be embedded as two separate nonsense words.
 * 2. Unifying line breaks (\r\n -> \n) and collapsing excessive blank spaces ensures
 *    chunk boundaries represent true semantic paragraphs rather than formatting glitches.
 * 
 * @param {string} rawText Unprocessed text extracted from PDF page
 * @returns {string} Clean, normalized text
 */
export function normalizeText(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Replace Windows CRLF with standard Unix newline
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove soft hyphens (\u00ad) and rejoin hyphenated line breaks (e.g. "com-\nputer" -> "computer")
      .replace(/(\w+)-\n(\w+)/g, '$1$2')
      .replace(/\u00ad/g, '')
      // Replace non-breaking spaces with standard space
      .replace(/[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
      // Collapse horizontal tabs and multiple spaces into a single space
      .replace(/[ \t]+/g, ' ')
      // Collapse more than two consecutive newlines into double newlines (paragraph boundary)
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
