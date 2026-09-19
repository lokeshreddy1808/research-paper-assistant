import { useState, useEffect } from 'react';
import { X, FileText, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import type { ParsedDocument } from '@research-assistant/shared';

interface DocumentViewerModalProps {
  documentId: string | null;
  initialPageNumber?: number;
  onClose: () => void;
}

/**
 * Interactive Document Page Inspector Modal.
 * Renders physical pages, character counts, scanned status, and extracted text.
 */
export function DocumentViewerModal({ documentId, initialPageNumber = 1, onClose }: DocumentViewerModalProps) {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [selectedPageNumber, setSelectedPageNumber] = useState<number>(initialPageNumber);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId) return;

    const fetchDocumentDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/documents/${documentId}`);
        if (!res.ok) {
          throw new Error(`Failed to load document (HTTP ${res.status})`);
        }
        const data = await res.json() as { ok: boolean; document: ParsedDocument };
        setDocument(data.document);
        setSelectedPageNumber(initialPageNumber || 1);
      } catch (err) {
        setError((err as Error).message || 'Failed to load document details');
      } finally {
        setLoading(false);
      }
    };

    fetchDocumentDetails();
  }, [documentId, initialPageNumber]);

  if (!documentId) return null;

  const activePage = document?.pages.find(p => p.pageNumber === selectedPageNumber);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {document?.metadata.title || document?.filename || 'Document Inspector'}
              </h3>
              <p className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>{document?.filename}</span>
                {document && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[220px]" title={document.sha256}>
                      SHA-256: {document.sha256.slice(0, 12)}...
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <p className="text-xs">Loading extracted pages from memory...</p>
            </div>
          )}

          {error && (
            <div className="flex-1 p-8 text-center text-red-400 space-y-2">
              <AlertTriangle className="w-6 h-6 mx-auto" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          {!loading && !error && document && (
            <>
              {/* Left Sidebar: 1-Indexed Physical Page Tabs */}
              <div className="w-full md:w-56 border-r border-slate-800 bg-slate-950/50 p-3 overflow-y-auto max-h-[220px] md:max-h-none space-y-1">
                <div className="text-[10px] font-mono uppercase text-slate-500 px-2 py-1">
                  Physical Pages ({document.totalPages})
                </div>
                {document.pages.map((page) => {
                  const isSelected = page.pageNumber === selectedPageNumber;
                  return (
                    <button
                      key={page.pageNumber}
                      onClick={() => setSelectedPageNumber(page.pageNumber)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 font-medium'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 font-mono">
                        <FileText className="w-3.5 h-3.5" />
                        Page {page.pageNumber}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {page.characterCount}c
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right Main Pane: Active Page Excerpt */}
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                {activePage ? (
                  <>
                    {/* Page Metric Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs font-mono">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="font-semibold text-white">Physical Page {activePage.pageNumber}</span>
                        <span className="text-slate-600">•</span>
                        <span>{activePage.characterCount} Characters</span>
                        <span className="text-slate-600">•</span>
                        <span>~{Math.ceil(activePage.characterCount / 4)} Tokens</span>
                      </div>

                      <div>
                        {activePage.isScanned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> Scanned / Low Density
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" /> Extracted Text
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Page Text Viewer */}
                    <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800/80 text-slate-300 text-xs leading-relaxed font-mono whitespace-pre-wrap max-h-[420px] overflow-y-auto selection:bg-blue-600 selection:text-white">
                      {activePage.text || (
                        <span className="text-slate-500 italic">No extractable plain text found on this page.</span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-12">Select a page to view text</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
