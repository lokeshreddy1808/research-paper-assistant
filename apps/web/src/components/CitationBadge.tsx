import { useState } from 'react';
import { BookmarkCheck, ExternalLink, ShieldCheck, AlertCircle } from 'lucide-react';

export interface CitationBadgeProps {
  /** Text representation, e.g. "[Page 2]" */
  citationText: string;
  /** 1-indexed page number */
  pageNumber: number;
  /** Name of the paper if multi-document */
  documentFilename?: string;
  /** Associated document ID if mapped */
  documentId?: string;
  /** Whether citation is verified against retrieved chunks */
  verified?: boolean;
  /** Direct passage excerpt backing the citation */
  excerpt?: string;
  /** Similarity score (0.00 - 1.00) */
  score?: number;
  /** Callback triggered when user clicks the citation badge */
  onClick?: (pageNumber: number, documentFilename?: string, documentId?: string) => void;
}

/**
 * Interactive Clickable Citation Badge.
 * Renders physical PDF page citations (e.g. "[Page 2]") as clickable badges that allow
 * the user to jump directly to the verified page in the document inspector.
 */
export function CitationBadge({
  citationText,
  pageNumber,
  documentFilename,
  documentId,
  verified = true,
  excerpt,
  score,
  onClick
}: CitationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick) {
      onClick(pageNumber, documentFilename, documentId);
    }
  };

  return (
    <span 
      className="relative inline-block align-baseline mx-0.5"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium transition cursor-pointer border select-none ${
          verified
            ? 'bg-blue-950/60 text-blue-300 border-blue-500/40 hover:bg-blue-900/70 hover:border-blue-400 hover:text-white shadow-sm'
            : 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/70 hover:border-amber-400'
        }`}
        title={`Click to inspect Page ${pageNumber}${documentFilename ? ` in ${documentFilename}` : ''}`}
      >
        {verified ? (
          <BookmarkCheck className="w-3 h-3 text-blue-400" />
        ) : (
          <AlertCircle className="w-3 h-3 text-amber-400" />
        )}
        <span>{citationText.replace(/[\[\]]/g, '')}</span>
        <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
      </button>

      {/* Hover Popover Preview */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl z-50 text-left pointer-events-none animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-white">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Physical Page {pageNumber}</span>
            </div>
            {score !== undefined && (
              <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                {(score * 100).toFixed(0)}% match
              </span>
            )}
          </div>

          {documentFilename && (
            <div className="text-[10px] text-slate-400 font-mono truncate mb-1.5">
              📄 {documentFilename}
            </div>
          )}

          {excerpt ? (
            <p className="text-[11px] text-slate-300 line-clamp-3 leading-relaxed italic bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
              "{excerpt}"
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 leading-tight">
              Click to open verified page in document viewer.
            </p>
          )}

          <div className="text-[9px] text-blue-400 mt-1.5 flex items-center gap-1">
            <span>Click badge to view full page text</span>
          </div>
        </div>
      )}
    </span>
  );
}
