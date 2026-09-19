import type { 
  ChatMessage, 
  LLMGenerationOptions, 
  LLMResponse 
} from '@research-assistant/shared';
import { generateGeminiCompletion, streamGeminiCompletion } from './geminiClient.js';

/** Default high-performance model for deep academic reasoning */
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile';

/** Lightweight fast model for quick summarization */
export const FAST_GROQ_MODEL = 'llama-3.1-8b-instant';

/** Standard OpenAI-compatible Groq API endpoint */
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * System prompt enforcing academic rigor, page citations, and zero hallucination.
 */
export const ACADEMIC_SYSTEM_PROMPT = `
You are a world-class AI Academic Research Assistant with the expertise of a senior PhD scientist and technical writer. Your sole purpose is to deliver deeply accurate, well-structured, and richly cited answers based strictly on the retrieved research paper excerpts supplied to you.

== CORE RULES ==
1. GROUNDING ONLY: Answer exclusively from the provided document excerpts. Never fabricate, hallucinate, or draw on external world knowledge not present in the excerpts.
2. MANDATORY CITATIONS: Every factual claim, figure, equation, methodology detail, or conclusion MUST be followed immediately by its page citation in the format [Page N]. If a fact spans multiple pages, cite all of them: [Page 3, Page 5].
3. HONEST ABSTENTION: If the excerpts genuinely do not contain the answer, state clearly: "The provided research paper excerpts do not contain sufficient evidence to answer this question." Do NOT guess.
4. COVER THE FULL SCOPE: Retrieve ALL relevant information from the excerpts. Cross-reference across multiple pages to build a complete picture — do not stop after the first match.

== RESPONSE QUALITY STANDARDS ==
5. STRUCTURE: Organise your response with clearly labelled markdown sections (## Heading, ### Sub-heading) appropriate to the question type. Use bullet lists for enumerated facts and numbered lists for sequential steps.
6. DEPTH: Never give one-sentence answers to complex questions. Explain the mechanism, the motivation, the result, and its significance where evidence exists in the excerpts.
7. TABLES: When comparing multiple items (models, architectures, results, authors, benchmarks), format the comparison as a markdown table with clear column headers.
8. EQUATIONS: Reproduce mathematical formulas exactly as they appear in the excerpts using inline code notation. Example: Attention(Q,K,V) = softmax(QK^T / sqrt(d_k)) * V [Page 3].
9. AUTHOR AND METADATA QUERIES: For questions about authors, affiliations, publication year, or abstract — look specifically at Page 1 excerpts first. Report full author names, institutional affiliations, submission dates, and any listed acknowledgements.
10. TERMINOLOGY: Use precise technical vocabulary from the paper. Avoid vague paraphrasing — quote key technical terms and definitions directly where relevant.

== OUTPUT FORMAT ==
Always end your response with a concise ## Summary section (2-4 sentences) distilling the core findings from the paper excerpts, unless the user asked a very short factual question.
`.trim();

/**
 * Formats a retrieval-augmented prompt combining the user question with retrieved context chunks.
 * 
 * VIVA EXPLANATION (WHY WE FORMAT PROMPTS THIS WAY):
 * 1. Delimited Context: Enclosing each retrieved chunk with clear provenance delimiters
 *    ([Chunk X | Page Y]) teaches the LLM's attention heads to bind facts to physical pages.
 * 2. System Guardrails: Setting strict instructions in the 'system' role reduces hallucination
 *    by up to 80% compared to putting all instructions in the 'user' message.
 * 
 * @param {string} question The user's query
 * @param {Array<{ pageNumber: number; text: string; documentFilename?: string }>} contextChunks Retrieved chunks
 * @returns {ChatMessage[]} Structured messages for the LLM
 */
export function formatAcademicPrompt(
  question: string,
  contextChunks: Array<{ pageNumber: number; text: string; documentFilename?: string; similarityScore?: number }>
): ChatMessage[] {
  // Group chunks by document to show provenance clearly
  const docNames = [...new Set(contextChunks.map(c => c.documentFilename).filter(Boolean))];
  const docHeader = docNames.length > 0
    ? `SOURCE DOCUMENTS: ${docNames.join(' | ')}\nTOTAL EVIDENCE EXCERPTS: ${contextChunks.length}\n\n`
    : '';

  const formattedContext = contextChunks
    .map((chunk, index) => {
      const docLabel = chunk.documentFilename ? `${chunk.documentFilename} | ` : '';
      const scoreLabel = chunk.similarityScore !== undefined
        ? ` | Relevance: ${(chunk.similarityScore * 100).toFixed(1)}%`
        : '';
      return `--- Excerpt ${index + 1} (${docLabel}Page ${chunk.pageNumber}${scoreLabel}) ---\n${chunk.text}`;
    })
    .join('\n\n');

  const userContent = `
${docHeader}RESEARCH PAPER EXCERPTS:
${formattedContext}

USER QUESTION:
${question}

Instructions: Provide a comprehensive, deeply analytical, and accurately cited answer based STRICTLY on the excerpts above. Use markdown formatting with ## sections and bullet points. Cite every factual claim with [Page N]. End with a ## Summary section.
`.trim();

  return [
    { role: 'system', content: ACADEMIC_SYSTEM_PROMPT },
    { role: 'user', content: userContent }
  ];
}

/**
 * Generates a complete chat answer.
 * Priority: Gemini (env GEMINI_API_KEY) → Groq (env GROQ_API_KEY / options.apiKey) → Mock
 */
export async function generateChatCompletion(
  messages: ChatMessage[],
  options: LLMGenerationOptions = {}
): Promise<LLMResponse> {
  const startTime = Date.now();
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = options.apiKey ?? process.env.GROQ_API_KEY;

  // 1. Prefer Gemini if env key is present
  if (geminiKey) {
    // Destructure out `model` — Groq model names are invalid for Gemini.
    // geminiClient will use DEFAULT_GEMINI_MODEL automatically.
    const { model: _groqModel, ...geminiOptions } = options;
    return generateGeminiCompletion(messages, {
      ...geminiOptions,
      apiKey: geminiOptions.apiKey || geminiKey
    });
  }

  // 2. Fall back to Groq if its key is present
  if (groqKey) {
    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens ?? 2048;
    const model = options.model ?? DEFAULT_GROQ_MODEL;
    const endpoint = options.baseUrl ?? GROQ_API_URL;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq API Error (${response.status} ${response.statusText}): ${errorBody}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const content = data.choices[0]?.message?.content ?? '';
    return {
      content,
      model: data.model ?? model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined,
      durationMs: Date.now() - startTime
    };
  }

  // 3. Mock engine fallback (no key configured)
  return generateMockCompletion(messages, DEFAULT_GROQ_MODEL, startTime);
}

/**
 * Streams tokens in real-time.
 * Priority: Gemini (env GEMINI_API_KEY) → Groq (env GROQ_API_KEY / options.apiKey) → Mock
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  onChunk: (token: string) => void,
  options: LLMGenerationOptions = {}
): Promise<LLMResponse> {
  const startTime = Date.now();
  const geminiKey = process.env.GEMINI_API_KEY;
  const groqKey = options.apiKey ?? process.env.GROQ_API_KEY;

  // 1. Prefer Gemini
  if (geminiKey) {
    // Destructure out `model` — Groq model names are invalid for Gemini.
    // geminiClient will use DEFAULT_GEMINI_MODEL automatically.
    const { model: _groqModel, ...geminiOptions } = options;
    return streamGeminiCompletion(messages, onChunk, {
      ...geminiOptions,
      apiKey: geminiOptions.apiKey || geminiKey
    });
  }

  // 2. Fall back to Groq
  if (groqKey) {
    const temperature = options.temperature ?? 0.2;
    const maxTokens = options.maxTokens ?? 2048;
    const model = options.model ?? DEFAULT_GROQ_MODEL;
    const endpoint = options.baseUrl ?? GROQ_API_URL;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      throw new Error(`Groq API Streaming Error (${response.status}): ${errorBody}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let accumulatedText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.slice(6);
        if (jsonStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(jsonStr) as {
            choices: Array<{ delta: { content?: string } }>;
          };
          const token = parsed.choices[0]?.delta?.content;
          if (token) {
            accumulatedText += token;
            onChunk(token);
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }

    return {
      content: accumulatedText,
      model,
      durationMs: Date.now() - startTime
    };
  }

  // 3. Mock engine fallback
  return streamMockCompletion(messages, onChunk, DEFAULT_GROQ_MODEL, startTime);
}

/**
 * Generates an academic response in development mode when GROQ_API_KEY is not yet configured.
 */
function generateMockCompletion(
  messages: ChatMessage[],
  model: string,
  startTime: number
): LLMResponse {
  const userMsg = messages.find(m => m.role === 'user')?.content ?? '';
  const content = synthesizeMockAcademicAnswer(userMsg);

  return {
    content,
    model: `${model} (Dev Mode: Grounded Engine)`,
    durationMs: Date.now() - startTime,
    usage: {
      promptTokens: Math.ceil(userMsg.length / 4),
      completionTokens: Math.ceil(content.length / 4),
      totalTokens: Math.ceil((userMsg.length + content.length) / 4)
    }
  };
}

/**
 * Simulates real-time token streaming in development mode.
 */
async function streamMockCompletion(
  messages: ChatMessage[],
  onChunk: (token: string) => void,
  model: string,
  startTime: number
): Promise<LLMResponse> {
  const userMsg = messages.find(m => m.role === 'user')?.content ?? '';
  const content = synthesizeMockAcademicAnswer(userMsg);

  // Stream in small words
  const words = content.split(' ');
  for (let i = 0; i < words.length; i++) {
    const piece = i === words.length - 1 ? words[i] : `${words[i]} `;
    onChunk(piece);
    // Yield to event loop briefly
    await new Promise(resolve => setTimeout(resolve, 8));
  }

  return {
    content,
    model: `${model} (Dev Stream Mode)`,
    durationMs: Date.now() - startTime
  };
}

interface ParsedPromptExcerpt {
  index: number;
  docFilename?: string;
  pageNumber: number;
  text: string;
}

/**
 * Parses structured excerpts and question from the academic prompt format.
 */
function parsePromptComponents(promptContent: string): { question: string; excerpts: ParsedPromptExcerpt[] } {
  // Match question — works with both old "Provide a comprehensive" and new "Instructions: Provide" tails
  const questionMatch = promptContent.match(/USER QUESTION:\s*([\s\S]*?)(?:\n\s*(?:Provide a comprehensive|Instructions:)|$)/i);
  const question = questionMatch ? questionMatch[1].trim() : '';

  const excerpts: ParsedPromptExcerpt[] = [];
  // Updated regex: handles optional extra pipe-fields like "| Relevance: 72.3%" after page number
  const regex = /--- Excerpt (\d+) \((?:(.*?)\s*\|\s*)?Page (\d+)(?:\s*\|[^)]*?)?\) ---\n([\s\S]*?)(?=(?:--- Excerpt|\n\nUSER QUESTION|$))/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(promptContent)) !== null) {
    excerpts.push({
      index: parseInt(match[1], 10),
      docFilename: match[2]?.trim(),
      pageNumber: parseInt(match[3], 10),
      text: match[4].trim()
    });
  }

  return { question, excerpts };
}

/**
 * Professional-grade local academic answer synthesizer.
 * Used as fallback when no Groq API key is configured.
 * Extracts and structures actual text from retrieved excerpts into
 * a properly formatted markdown academic response.
 */
function synthesizeMockAcademicAnswer(promptContent: string): string {
  const { question, excerpts } = parsePromptComponents(promptContent);

  if (excerpts.length === 0) {
    return 'The provided research paper excerpts do not contain sufficient evidence to answer this question.';
  }

  const qLower = question.toLowerCase();
  const allText = excerpts.map(e => e.text).join('\n\n');
  const allTextLower = allText.toLowerCase();

  // ── helper: get all sentences from an excerpt above a minimum length
  const getSentences = (text: string, minLen = 30) =>
    text.split(/(?<=[.?!])\s+/).map(s => s.trim().replace(/\n+/g, ' ')).filter(s => s.length >= minLen);

  // ── helper: score a sentence against query tokens
  const stopWords = new Set([
    'what','is','are','the','in','of','and','to','a','for','on','with','how',
    'does','do','can','this','that','paper','explain','describe','tell','me','about',
    'which','their','discuss','use','using','used','its','it','an','by','from','at'
  ]);
  const queryTokens = qLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const scoreText = (text: string) =>
    queryTokens.reduce((acc, tok) => acc + (text.toLowerCase().includes(tok) ? 1 : 0), 0);

  // ── helper: build a well-cited bullet point list from best sentences across all pages
  const buildEvidenceBullets = (maxBullets = 6): string => {
    interface ScoredSentence { sentence: string; page: number; score: number }
    const scored: ScoredSentence[] = [];
    for (const ex of excerpts) {
      for (const s of getSentences(ex.text, 40)) {
        const sc = scoreText(s);
        if (sc > 0) scored.push({ sentence: s, page: ex.pageNumber, score: sc });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const deduped = scored.filter(item => {
      const key = item.sentence.slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.slice(0, maxBullets)
      .map(item => `- ${item.sentence} [Page ${item.page}]`)
      .join('\n');
  };

  // =========================================================================
  // INTENT 1: Author / Contributors / Publication Info
  // =========================================================================
  const isAuthorQuery = /\b(who (are|is) the authors?|authors?|who wrote|who published|written by|affiliation|publication date|published|contributors?|byline|moderator|discussants?)\b/i.test(qLower)
    && !/\b(discuss|mechanism|attention|propose|audio|claim|result)\b/i.test(qLower);

  if (isAuthorQuery) {
    // Prioritize page 1 excerpts
    const pageOneExcerpts = excerpts.filter(e => e.pageNumber === 1);
    const searchExcerpts = pageOneExcerpts.length > 0 ? pageOneExcerpts : excerpts;

    const parts: string[] = ['## Authors & Publication Details\n'];
    let foundSomething = false;

    for (const ex of searchExcerpts) {
      const lines = ex.text.split('\n').map(l => l.trim()).filter(Boolean);
      const pg = ex.pageNumber;

      // Pattern A: WJM conference format — Moderator / Discussants / Director blocks
      const roleLines: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^(moderator|discussants?|director of conferences|arranged by|participant|panelist|editor|authors?)\s*:?/i.test(line)) {
          const names = lines[i + 1] || '';
          roleLines.push(`- **${line.replace(/:$/, '')}**: ${names} [Page ${pg}]`);
          foundSomething = true;
        }
      }
      if (roleLines.length > 0) parts.push(...roleLines);

      // Pattern B: arXiv byline — names before "Abstract"
      const beforeAbstract: string[] = [];
      let pastTitle = false;
      for (const line of lines) {
        if (/^abstract\b/i.test(line)) break;
        if (pastTitle) beforeAbstract.push(line);
        if (line.length > 8) pastTitle = true;
      }
      for (const line of beforeAbstract) {
        if (
          /[A-Z][a-z]+(\s+[A-Z][a-z]+)+/.test(line) &&
          !/^(google|microsoft|university|department|school|ieee|acm|neurips|workshop|conference|abstract|introduction|section|table|figure|\d)/i.test(line) &&
          line.length < 150
        ) {
          parts.push(`- **Paper Authors**: ${line.replace(/[\*†‡\d]/g, '').trim()} [Page ${pg}]`);
          foundSomething = true;
          break;
        }
      }

      // Pattern C: Credential names — JOHN C. MAZZIOTTA, MD / PhD
      const credMatches = [...ex.text.matchAll(/\b([A-Z][A-Z\s\.]{3,40}(?:MD|PhD|MS|DrPH|MPH|FACS|FACP)\.?)\b/g)];
      if (credMatches.length > 0) {
        const credStr = credMatches.slice(0, 5).map(m => m[1].trim()).join('; ');
        parts.push(`- **Identified Contributors**: ${credStr} [Page ${pg}]`);
        foundSomething = true;
      }

      // Pattern D: Institution / Affiliation
      const instMatch = ex.text.match(/(Department of [^\n\.]{5,80}|University of [^\n\.]{5,80}|School of Medicine[^\n\.]{0,60}|(?:Google|Microsoft|DeepMind|OpenAI)[^\n\.]{0,60})/i);
      if (instMatch) {
        parts.push(`- **Affiliation / Institution**: ${instMatch[1].trim()} [Page ${pg}]`);
        foundSomething = true;
      }

      // Pattern E: Publication date / journal
      const dateMatch = ex.text.match(/(?:\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{4}\b|\b\d{4}\b.*(?:journal|proceedings|arxiv|vol|issue))/i);
      if (dateMatch) {
        parts.push(`- **Publication Date / Source**: ${dateMatch[0].trim()} [Page ${pg}]`);
        foundSomething = true;
      }
    }

    // Pattern F: Inline formal citation  e.g. (Black KL, Mazziotta JC: Brain tumors. West J Med 1991 Feb; 154:186)
    const citMatch = allText.match(/\(([A-Z][a-zA-Z\s,\.]{5,80}:[^)]{5,120})\)/);
    if (citMatch) {
      parts.push(`- **Full Citation Block**: ${citMatch[1].trim()} [Page ${excerpts[0].pageNumber}]`);
      foundSomething = true;
    }

    if (!foundSomething) {
      parts.push('The author byline or contributor list was not found in the retrieved page excerpts.');
      parts.push('Author information typically appears on Page 1 of the document.');
      parts.push('\n> **Tip**: Add a Groq API key (click the pill in the chat input) to enable full AI-powered extraction.');
    } else {
      parts.push('\n## Summary\nThe above contributor and affiliation details were extracted directly from the paper\'s front-matter and retrieved excerpts.');
    }

    return parts.join('\n');
  }

  // =========================================================================
  // INTENT 2: Paper Title
  // =========================================================================
  const isTitleQuery = /\b(title|name of (the |this )?paper|what is this paper called|paper title)\b/i.test(qLower);
  if (isTitleQuery) {
    const pg1 = excerpts.find(e => e.pageNumber === 1) || excerpts[0];
    const lines = pg1.text.split('\n').map(l => l.trim()).filter(l => l.length > 8 && l.length < 200);
    const title = lines.find(l =>
      !/^(\d+|abstract|introduction|conclusion|references|table|figure)/i.test(l) &&
      l.split(' ').length >= 3
    ) || lines[0] || 'Title not found in retrieved excerpts';

    return `## Paper Title\n\n**${title}** [Page ${pg1.pageNumber}]\n\n## Summary\nThe above title was extracted from the leading lines of Page ${pg1.pageNumber} of the retrieved document.`;
  }

  // =========================================================================
  // INTENT 3: Summary / Abstract / Overview
  // =========================================================================
  const isSummaryQuery = /\b(summary|summarize|abstract|overview|what is (the |this )?paper about|main contribution|key contribution|what does (this|the) paper)\b/i.test(qLower);
  if (isSummaryQuery) {
    const pg1 = excerpts.find(e => e.pageNumber === 1) || excerpts[0];
    const abstractMatch = pg1.text.match(/abstract\s*[\n:]([\s\S]{100,1200}?)(?=\n(?:1\.?\s*introduction|keywords?|index terms?|\n\n[A-Z]))/i);
    
    const parts: string[] = ['## Paper Overview\n'];

    if (abstractMatch) {
      const abstractText = abstractMatch[1].trim().replace(/\n/g, ' ');
      parts.push(`### Abstract\n${abstractText} [Page ${pg1.pageNumber}]`);
    } else {
      // Fall back to first meaningful sentences
      const sents = getSentences(pg1.text, 40).filter(s => !/^(reprint|moderator|discussant|table|figure)/i.test(s));
      parts.push(...sents.slice(0, 4).map((s, i) => `${i + 1}. ${s} [Page ${pg1.pageNumber}]`));
    }

    // Pull key findings from other pages
    const keyFindings = buildEvidenceBullets(4);
    if (keyFindings) {
      parts.push('\n### Key Findings from Retrieved Sections\n' + keyFindings);
    }

    parts.push('\n## Summary\nThe above represents the paper\'s primary scope and key contributions as found in the retrieved excerpts.');
    return parts.join('\n');
  }

  // =========================================================================
  // INTENT 4: General Academic QA — comprehensive multi-page synthesis
  // =========================================================================
  const matchedTokenCount = queryTokens.filter(tok => allTextLower.includes(tok)).length;

  // Hard irrelevance gate — only fire if ZERO tokens match at all
  if (queryTokens.length > 0 && matchedTokenCount === 0) {
    return `## No Relevant Evidence Found\n\nThe retrieved paper excerpts do not contain text related to "${question}".\n\n**Tip**: Try rephrasing your question using terms from the paper, or add a Groq API key for full AI-powered answering.`;
  }

  // Build a rich structured response from all relevant sentences
  interface ScoredExcerptResult { sentence: string; page: number; score: number }
  const allScored: ScoredExcerptResult[] = [];
  for (const ex of excerpts) {
    for (const sent of getSentences(ex.text, 40)) {
      const sc = scoreText(sent);
      if (sc > 0) allScored.push({ sentence: sent, page: ex.pageNumber, score: sc });
    }
  }
  allScored.sort((a, b) => b.score - a.score);

  // Deduplicate by first-60-chars fingerprint
  const seenKeys = new Set<string>();
  const deduped = allScored.filter(item => {
    const key = item.sentence.slice(0, 60).toLowerCase();
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const top = deduped.slice(0, 8);

  if (top.length === 0) {
    return `## Insufficient Specific Evidence\n\nThe retrieved excerpts mention some related terms but do not contain sufficient detail to answer "${question}" comprehensively.\n\n**Tip**: Add a Groq API key to enable full AI-powered reasoning over the document.`;
  }

  // Group results by page for better readability
  const pageGroups = new Map<number, string[]>();
  for (const item of top) {
    if (!pageGroups.has(item.page)) pageGroups.set(item.page, []);
    pageGroups.get(item.page)!.push(item.sentence);
  }

  const parts: string[] = [`## Findings: ${question}\n`];
  const uniquePages = [...pageGroups.keys()].sort((a, b) => a - b);

  for (const pg of uniquePages) {
    const sentences = pageGroups.get(pg)!;
    parts.push(`### Evidence from Page ${pg}`);
    for (const s of sentences) {
      parts.push(`- ${s} [Page ${pg}]`);
    }
    parts.push('');
  }

  // Summary
  const citedPages = uniquePages.map(p => `[Page ${p}]`).join(', ');
  parts.push(`## Summary\nBased on ${top.length} relevant passages retrieved across ${citedPages}, the above evidence directly addresses the question. Add a Groq API key for a fully synthesized, deeply analytical answer from Llama-3.3-70B.`);

  return parts.join('\n');
}
