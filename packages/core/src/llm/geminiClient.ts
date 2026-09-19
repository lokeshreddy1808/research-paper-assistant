import type {
  ChatMessage,
  LLMGenerationOptions,
  LLMResponse
} from '@research-assistant/shared';
import { ACADEMIC_SYSTEM_PROMPT } from './groqClient.js';

/** Default Gemini model — Gemini 3.6 Flash for fast, high-quality academic reasoning */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

/** Higher-quality option for complex multi-paper synthesis */
export const PRO_GEMINI_MODEL = 'gemini-3.1-pro-preview';

/** Base URL for Google Generative Language REST API */
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Converts the shared ChatMessage[] format (OpenAI-style) into the
 * Gemini `contents` array format.
 *
 * Gemini separates system instructions from conversation turns.
 * - `system` role → goes into `systemInstruction`
 * - `user` / `assistant` roles → `contents` array with `parts`
 */
function toGeminiContents(messages: ChatMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemMsg = messages.find(m => m.role === 'system');
  const conversationMsgs = messages.filter(m => m.role !== 'system');

  const contents = conversationMsgs.map(m => ({
    role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: m.content }]
  }));

  return {
    systemInstruction: systemMsg
      ? { parts: [{ text: systemMsg.content }] }
      : undefined,
    contents
  };
}

/**
 * Generates a complete chat answer using the Gemini REST API (non-streaming).
 */
export async function generateGeminiCompletion(
  messages: ChatMessage[],
  options: LLMGenerationOptions = {}
): Promise<LLMResponse> {
  const startTime = Date.now();
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 2048;

  if (!apiKey) {
    throw new Error('No Gemini API key provided. Set GEMINI_API_KEY in .env or pass it via the API key field.');
  }

  const { systemInstruction, contents } = toGeminiContents(messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'text/plain'
    }
  };
  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API Error (${response.status} ${response.statusText}): ${errorBody}`);
  }

  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  return {
    content,
    model,
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata.totalTokenCount ?? 0
    } : undefined,
    durationMs: Date.now() - startTime
  };
}

/**
 * Streams tokens in real-time from the Gemini API using
 * the streamGenerateContent endpoint with SSE delivery.
 */
export async function streamGeminiCompletion(
  messages: ChatMessage[],
  onChunk: (token: string) => void,
  options: LLMGenerationOptions = {}
): Promise<LLMResponse> {
  const startTime = Date.now();
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? DEFAULT_GEMINI_MODEL;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 2048;

  if (!apiKey) {
    throw new Error('No Gemini API key provided. Set GEMINI_API_KEY in .env or pass it via the API key field.');
  }

  const { systemInstruction, contents } = toGeminiContents(messages);

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
      responseMimeType: 'text/plain'
    }
  };
  if (systemInstruction) {
    body.systemInstruction = systemInstruction;
  }

  // alt=sse makes the endpoint return Server-Sent Events
  const url = `${GEMINI_BASE_URL}/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok || !response.body) {
    const errorBody = await response.text();
    throw new Error(`Gemini Streaming Error (${response.status}): ${errorBody}`);
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
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string; thought?: boolean }> };
          }>;
        };
        const parts = parsed.candidates?.[0]?.content?.parts;
        if (parts && Array.isArray(parts)) {
          for (const part of parts) {
            if (part.text && !part.thought) {
              accumulatedText += part.text;
              onChunk(part.text);
            }
          }
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

export { ACADEMIC_SYSTEM_PROMPT };
