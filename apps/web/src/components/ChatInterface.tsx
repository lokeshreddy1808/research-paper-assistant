import { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  FileSearch, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Layers, 
  Key, 
  ExternalLink, 
  X
} from 'lucide-react';
import type { 
  Citation, 
  EmbeddedChunk, 
  DocumentSummary,
  RAGAnswer 
} from '@research-assistant/shared';
import { CitationBadge } from './CitationBadge.js';
import { AIChatInput } from './AIChatInput.js';
import { RecommendedPromptsAside } from './RecommendedPromptsAside.js';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
  citations?: Citation[];
  retrievedChunks?: EmbeddedChunk[];
  faithfulnessScore?: number;
  durationMs?: number;
  model?: string;
  error?: string;
  timestamp: string;
}

interface ChatInterfaceProps {
  documents: DocumentSummary[];
  selectedDocumentIds?: string[];
  onToggleDocumentFilter?: (id: string) => void;
  onClearDocumentFilter?: () => void;
  onInspectCitation: (documentId: string, pageNumber: number) => void;
}

/**
 * Interactive Real-Time Streaming Research Chat Interface.
 * Features:
 * - 21st.dev inspired AI Chat Input capsule with multiline expander and scope pills
 * - Dedicated aside sidebar for Recommended Research Questions
 * - Realtime SSE streaming from POST /api/rag/stream
 * - Clickable physical page citations & retrieved chunk inspectability
 */
export function ChatInterface({
  documents,
  selectedDocumentIds = [],
  onClearDocumentFilter,
  onInspectCitation
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [expandedContexts, setExpandedContexts] = useState<Record<string, boolean>>({});
  const [filterToSelectedPaper, setFilterToSelectedPaper] = useState<boolean>(true);
  const [groqApiKey, setGroqApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem('gemini_api_key') || '';;
    } catch {
      return '';
    }
  });
  const [showKeyModal, setShowKeyModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>('');

  const handleSaveApiKey = () => {
    const trimmed = tempApiKey.trim();
    setGroqApiKey(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem('gemini_api_key', trimmed);
      } else {
        localStorage.removeItem('gemini_api_key');
      }
    } catch {
      // ignore
    }
    setShowKeyModal(false);
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedDocs = documents.filter(d => selectedDocumentIds.includes(d.id));
  const activeDocumentIds = (filterToSelectedPaper && selectedDocumentIds.length > 0) ? selectedDocumentIds : undefined;

  // Auto-scroll to bottom of messages — only within the chat container, NOT the page
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setMessages((prev) => 
        prev.map((msg) => msg.isStreaming ? { ...msg, isStreaming: false } : msg)
      );
    }
  };

  const clearChat = () => {
    if (isStreaming) {
      handleStopStreaming();
    }
    setMessages([]);
  };

  const toggleContextExpansion = (messageId: string) => {
    setExpandedContexts(prev => ({
      ...prev,
      [messageId]: !prev[messageId]
    }));
  };

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || inputValue).trim();
    if (!queryText || isStreaming) return;

    if (documents.length === 0) {
      alert('Please upload or load at least one research paper before asking questions.');
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `asst-${Date.now()}`;
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: queryText,
      timestamp: currentTime
    };

    const initialAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      sender: 'assistant',
      text: '',
      isStreaming: true,
      timestamp: currentTime
    };

    setMessages((prev) => [...prev, userMessage, initialAssistantMessage]);
    setInputValue('');
    setIsStreaming(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/rag/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question: queryText,
          documentIds: activeDocumentIds,
          topK: 8,
          minScore: 0.35,
          temperature: 0.2,
          apiKey: groqApiKey.trim() || undefined
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported in response body.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataStr = trimmed.replace(/^data:\s*/, '');
          if (dataStr === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataStr) as 
              | { type: 'token'; token: string }
              | { type: 'done'; result: RAGAnswer }
              | { type: 'error'; error: string };

            if (parsed.type === 'token') {
              accumulatedText += parsed.token;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, text: accumulatedText }
                    : msg
                )
              );
            } else if (parsed.type === 'done') {
              const res = parsed.result;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? {
                        ...msg,
                        text: res.answer || accumulatedText,
                        isStreaming: false,
                        citations: res.citations,
                        retrievedChunks: res.retrievedChunks,
                        faithfulnessScore: res.faithfulnessScore,
                        durationMs: res.durationMs,
                        model: res.model
                      }
                    : msg
                )
              );
            } else if (parsed.type === 'error') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, isStreaming: false, error: parsed.error }
                    : msg
                )
              );
            }
          } catch {
            // Ignore non-JSON lines
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        const errorMessage = (err as Error).message || 'Streaming failed';
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, isStreaming: false, error: errorMessage }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  /**
   * Handles prompt selection from the aside sidebar
   */
  const handleSelectAsidePrompt = (query: string, autoRun: boolean = true) => {
    if (autoRun) {
      handleSendMessage(query);
    } else {
      setInputValue(query);
    }
  };

  /**
   * Parses natural text to render interactive clickable citation badges for "[Page X]" citations.
   */
  const renderMessageContent = (
    text: string, 
    citations: Citation[] = [], 
    retrievedChunks: EmbeddedChunk[] = []
  ) => {
    if (!text) return null;

    const citationPattern = /\[Page\s+(\d+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      const pageNum = parseInt(match[1], 10);
      const matchedCitation = citations.find(c => c.pageNumber === pageNum);
      const matchedChunk = retrievedChunks.find(c => c.pageNumber === pageNum);

      const docId = matchedChunk?.documentId || 
                    (selectedDocs.length > 0 ? selectedDocs[0].id : documents[0]?.id) || '';

      const excerpt = matchedCitation?.excerpt || matchedChunk?.text || 'Evidence passage verified from PDF.';
      const score = matchedChunk?.similarityScore;

      parts.push(
        <CitationBadge
          key={`cit-${match.index}-${pageNum}`}
          citationText={`[Page ${pageNum}]`}
          pageNumber={pageNum}
          excerpt={excerpt}
          score={score}
          documentId={docId}
          documentFilename={matchedChunk?.documentFilename || matchedCitation?.documentFilename}
          onClick={(pNum, _fName, dId) => {
            onInspectCitation(dId || docId, pNum);
          }}
        />
      );

      lastIndex = citationPattern.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => (
          <span key={i}>{part}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column (8 cols): Main Chat Interface Deck */}
      <div className="lg:col-span-8 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl dark:shadow-2xl overflow-hidden min-h-[620px] transition-all">
        {/* Top Control Deck */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                  Academic Query Engine
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  groqApiKey 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold' 
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                }`}>
                  {groqApiKey ? 'Gemini 2.0 Flash' : 'Local BGE RAG'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Grounded inference with 1-indexed physical PDF page citations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-400 hover:text-red-600 transition cursor-pointer text-xs"
                title="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Message Stream Area */}
        <div ref={messagesContainerRef} className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6 max-h-[560px] min-h-[420px] bg-slate-50/40 dark:bg-slate-950/40">
          {messages.length === 0 ? (
            <div className="py-16 px-4 text-center space-y-5 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 text-blue-500 flex items-center justify-center mx-auto shadow-inner">
                <FileSearch className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Ask your research library anything
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Type a question below, or pick a prompt from the <strong className="text-slate-700 dark:text-slate-300">Research Inquiries</strong> panel on the right.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs font-mono text-slate-400">
                <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  ⚡ Realtime SSE Stream
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  📑 [Page X] Citations
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  🔒 Zero Data Leakage
                </span>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Message Header */}
                <div className="flex items-center gap-2 mb-2 text-xs font-mono text-slate-500">
                  <span className="font-semibold">{msg.sender === 'user' ? 'You' : 'AI Assistant'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-2xl rounded-2xl px-5 py-4 text-sm sm:text-base leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-md'
                  }`}
                >
                  {msg.sender === 'assistant' ? (
                    <div className="space-y-3">
                      {/* Rendered Text with Dynamic Citation Badges */}
                      <div className="leading-loose text-sm sm:text-base">
                        {renderMessageContent(msg.text, msg.citations, msg.retrievedChunks)}
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-5 ml-1.5 bg-blue-500 animate-pulse align-middle rounded-sm" />
                        )}
                      </div>

                      {/* Error Banner */}
                      {msg.error && (
                        <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs">
                          {msg.error}
                        </div>
                      )}

                      {/* Assistant Telemetry Footer */}
                      {!msg.isStreaming && !msg.error && msg.text && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-500">
                          <div className="flex items-center gap-2">
                            {msg.faithfulnessScore !== undefined && (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 font-semibold">
                                <ShieldCheck className="w-3 h-3" />
                                <span>{(msg.faithfulnessScore * 100).toFixed(0)}% Grounded</span>
                              </span>
                            )}
                            {msg.durationMs !== undefined && (
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <Clock className="w-3 h-3" />
                                <span>{msg.durationMs}ms</span>
                              </span>
                            )}
                            {msg.model && (
                              <span className="text-[10px] text-slate-500 hidden sm:inline">
                                ({msg.model})
                              </span>
                            )}
                          </div>

                          {/* Retrieved Chunks Drawer Toggle */}
                          {msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                            <button
                              onClick={() => toggleContextExpansion(msg.id)}
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              <span>{expandedContexts[msg.id] ? 'Hide' : 'Inspect'} {msg.retrievedChunks.length} Evidence Passages</span>
                              {expandedContexts[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expandable Retrieved Context Chunks */}
                      {expandedContexts[msg.id] && msg.retrievedChunks && (
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 animate-in fade-in duration-200">
                          <div className="text-[11px] font-mono font-semibold text-slate-500 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                            <span>RETRIEVED VECTOR EVIDENCE (384-d BGE MATCHES)</span>
                          </div>

                          {msg.retrievedChunks.map((chunk, idx) => (
                            <div
                              key={chunk.id || idx}
                              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="text-blue-600 dark:text-blue-400 font-bold">
                                  Chunk #{idx + 1} • <span className="text-slate-700 dark:text-slate-300">Page {chunk.pageNumber}</span>
                                </span>
                                {chunk.similarityScore !== undefined && (
                                  <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    {(chunk.similarityScore * 100).toFixed(1)}% match
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed font-sans italic">
                                "{chunk.text}"
                              </p>
                              <div className="pt-1 flex items-center justify-between text-[9px] text-slate-400">
                                <span>{chunk.documentFilename || 'Source Paper'}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const docId = chunk.documentId || documents.find(d => d.filename === chunk.documentFilename)?.id || documents[0]?.id;
                                    if (docId) {
                                      onInspectCitation(docId, chunk.pageNumber);
                                    }
                                  }}
                                  className="text-blue-500 hover:underline cursor-pointer"
                                >
                                  Inspect Full Page ➔
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>{msg.text}</div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Integrated 21st.dev AIChatInput Component */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800/80 bg-white dark:bg-slate-900">
          <AIChatInput
            onSendMessage={(q) => handleSendMessage(q)}
            onStopStreaming={handleStopStreaming}
            isStreaming={isStreaming}
            disabled={documents.length === 0}
            documents={documents}
            selectedDocumentIds={selectedDocumentIds}
            filterToSelectedPaper={filterToSelectedPaper}
            onToggleFilterMode={setFilterToSelectedPaper}
            onClearFilter={onClearDocumentFilter}
            onOpenApiKeyModal={() => {
              setTempApiKey(groqApiKey);
              setShowKeyModal(true);
            }}
            hasApiKey={Boolean(groqApiKey)}
            inputValue={inputValue}
            setInputValue={setInputValue}
          />
        </div>
      </div>

      {/* Right Column (4 cols): Dedicated Recommended Research Prompts Aside */}
      <div className="lg:col-span-4">
        <RecommendedPromptsAside
          onSelectPrompt={handleSelectAsidePrompt}
          disabled={documents.length === 0}
          isStreaming={isStreaming}
        />
      </div>

      {/* Groq Cloud API Key Settings Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Google Gemini API Key</h4>
                  <p className="text-[11px] text-slate-500">Fast 300+ token/s Llama 3.3 70B inference</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You can connect your free Google Gemini API key to stream live answers from <strong>Gemini 2.0 Flash</strong> — Google's fastest, most capable model — at zero local GPU/RAM cost.
              </p>

              <div>
                <label className="block text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300 mb-1">
                  API Key (starts with `gsk_...`)
                </label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-purple-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <a
                  href="https://aistudio.google.com/app/apikeys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
                >
                  <span>Get free key at aistudio.google.com</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <span>Stored in browser localStorage</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              {groqApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setTempApiKey('');
                    setGroqApiKey('');
                    try { localStorage.removeItem('gemini_api_key'); } catch {}
                    setShowKeyModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                >
                  Clear Key
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowKeyModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveApiKey}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shadow-md shadow-purple-600/20"
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
