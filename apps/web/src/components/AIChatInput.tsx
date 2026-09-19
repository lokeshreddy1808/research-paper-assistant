import { useState, useRef, useEffect, type KeyboardEvent, type FormEvent } from 'react';
import { 
  Send, 
  Layers, 
  StopCircle, 
  X, 
  Cpu, 
  ShieldCheck
} from 'lucide-react';
import type { DocumentSummary } from '@research-assistant/shared';

interface AIChatInputProps {
  onSendMessage: (query: string) => void;
  onStopStreaming?: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  documents: DocumentSummary[];
  selectedDocumentIds: string[];
  filterToSelectedPaper: boolean;
  onToggleFilterMode: (filter: boolean) => void;
  onClearFilter?: () => void;
  onOpenApiKeyModal: () => void;
  hasApiKey: boolean;
  inputValue: string;
  setInputValue: (val: string) => void;
}

/**
 * Modern AI Chat Input component inspired by 21st.dev @preetsuthar17/components/ai-chat-input
 * Features:
 * - Auto-expanding multiline input with smooth spring styling
 * - Glowing focus border and backdrop glassmorphism
 * - Integrated Target scope pill selector
 * - Fast Groq API Key / Local Engine indicator pill
 * - Quick query preset triggers & stop generation controls
 */
export function AIChatInput({
  onSendMessage,
  onStopStreaming,
  isStreaming,
  disabled = false,
  documents,
  selectedDocumentIds,
  filterToSelectedPaper,
  onToggleFilterMode,
  onClearFilter,
  onOpenApiKeyModal,
  hasApiKey,
  inputValue,
  setInputValue
}: AIChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      // Clamp between 48px and 160px
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 48), 160)}px`;
    }
  }, [inputValue]);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isStreaming || disabled) return;
    onSendMessage(inputValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectedDocs = documents.filter(d => selectedDocumentIds.includes(d.id));

  return (
    <div className="w-full relative">
      {/* Outer Glow Container */}
      <div 
        className={`relative rounded-2xl transition-all duration-300 ${
          isFocused 
            ? 'ring-2 ring-blue-500/50 dark:ring-blue-400/40 shadow-xl shadow-blue-500/10 dark:shadow-blue-500/5' 
            : 'hover:border-slate-300 dark:hover:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-black/40'
        } bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 backdrop-blur-xl overflow-hidden`}
      >
        {/* Top Active Scope Ribbon */}
        <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between text-xs border-b border-slate-100 dark:border-slate-800/60 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Target Scope Pill */}
            {selectedDocs.length > 0 ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-[11px] font-medium animate-in fade-in duration-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <button
                  type="button"
                  onClick={() => onToggleFilterMode(!filterToSelectedPaper)}
                  className="hover:underline cursor-pointer flex items-center gap-1 font-mono"
                  title="Toggle between scoped paper and global library"
                >
                  <span>{filterToSelectedPaper ? `Targeting ${selectedDocs.length} paper${selectedDocs.length > 1 ? 's' : ''}` : 'All Indexed Papers'}</span>
                </button>
                {onClearFilter && (
                  <button
                    type="button"
                    onClick={onClearFilter}
                    className="p-0.5 hover:text-red-500 text-slate-400 rounded transition cursor-pointer"
                    title="Clear filter selection"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-mono">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Scope: All {documents.length} Indexed Paper{documents.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Model / Engine Pill */}
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono transition cursor-pointer ${
                hasApiKey
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60'
                  : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-100'
              }`}
              title="Click to configure Google Gemini API Key for fast AI streaming"
            >
              <Cpu className="w-3 h-3" />
              <span>{hasApiKey ? 'Gemini 3.6 Flash' : 'Gemini API Key'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span className="hidden sm:inline">Cos-Sim Top-4</span>
            <span title="Grounding Guard Active" className="inline-flex items-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            </span>
          </div>
        </div>

        {/* Textarea Area */}
        <form onSubmit={handleSubmit} className="relative flex flex-col">
          <div className="p-3 sm:p-4 pb-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled || isStreaming}
              rows={1}
              placeholder={
                documents.length === 0
                  ? 'Upload or load a paper above to start asking questions...'
                  : selectedDocs.length > 0 && filterToSelectedPaper
                  ? `Ask a question about ${selectedDocs.length === 1 ? `"${selectedDocs[0].filename}"` : `${selectedDocs.length} selected papers`}...`
                  : 'Ask any research question across all indexed papers (e.g., methodology, equations, benchmarks)...'
              }
              className="w-full bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm sm:text-base outline-none resize-none leading-relaxed transition font-sans"
              style={{ minHeight: '48px', maxHeight: '160px' }}
            />
          </div>

          {/* Bottom Controls Bar */}
          <div className="px-3 sm:px-4 pb-3 pt-1 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/40">
            {/* Quick Helper Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[11px] text-slate-400 dark:text-slate-500 hidden md:inline font-mono">
                Hint:
              </span>
              <button
                type="button"
                onClick={() => setInputValue('Summarize the primary contributions and architecture in 3 bullet points.')}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-400 transition cursor-pointer whitespace-nowrap"
              >
                ⚡ Summary
              </button>
              <button
                type="button"
                onClick={() => setInputValue('Who are the authors, their affiliations, and the publication date?')}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-400 transition cursor-pointer whitespace-nowrap"
              >
                👥 Authors
              </button>
              <button
                type="button"
                onClick={() => setInputValue('What were the key quantitative benchmark results and SOTA comparisons?')}
                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] text-slate-600 dark:text-slate-400 transition cursor-pointer whitespace-nowrap"
              >
                📊 Benchmarks
              </button>
            </div>

            {/* Right Action: Send / Stop button */}
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {inputValue.trim().length > 0 && !isStreaming && (
                <button
                  type="button"
                  onClick={() => setInputValue('')}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
                  title="Clear text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {isStreaming ? (
                <button
                  type="button"
                  onClick={onStopStreaming}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-md shadow-red-600/20 transition-all duration-200 cursor-pointer animate-pulse"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim() || documents.length === 0 || disabled}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-800 dark:disabled:to-slate-800 text-white disabled:text-slate-400 dark:disabled:text-slate-600 text-xs font-semibold shadow-md shadow-blue-500/20 disabled:shadow-none transition-all duration-200 cursor-pointer disabled:cursor-not-allowed group"
                >
                  <span>Query</span>
                  <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Keyboard Shortcut Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-3 pt-2">
        <div className="flex items-center gap-1">
          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-400">Enter ↵</span>
          <span>to ask</span>
          <span className="mx-1">•</span>
          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-400">Shift + Enter</span>
          <span>for new line</span>
        </div>
        <div className="hidden sm:inline font-mono">
          Physical Page Grounding
        </div>
      </div>
    </div>
  );
}
