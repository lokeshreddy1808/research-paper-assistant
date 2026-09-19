import { useState, useEffect } from 'react';
import { 
  FileText, 
  Trash2, 
  Eye, 
  Layers, 
  Calendar, 
  HardDrive, 
  CheckCircle2, 
  CheckSquare, 
  Square, 
  BookOpen, 
  Sparkles, 
  DownloadCloud, 
  X 
} from 'lucide-react';
import type { DocumentSummary } from '@research-assistant/shared';

export interface SampleBenchmarkDef {
  id: string;
  filename: string;
  title: string;
  authors: string;
  description: string;
  pages: number;
  sizeKb: number;
  isLoaded: boolean;
  loadedDocId?: string;
}

interface DocumentLibraryProps {
  documents: DocumentSummary[];
  selectedDocumentIds: string[];
  onToggleDocument: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInspectDocument: (id: string) => void;
  onDeleteDocument: (id: string) => void;
  onSampleLoaded?: (doc: DocumentSummary) => void;
  isLoading?: boolean;
}

const SAMPLE_BENCHMARK_NAMES = [
  'Attention_Is_All_You_Need.pdf',
  'Deep_Residual_Learning.pdf'
];

/**
 * Interactive Multi-Document Paper Library.
 * Supports multi-selection, benchmark sample paper on-demand loading,
 * and clear separation between user-uploaded research and demo benchmark papers.
 */
export function DocumentLibrary({
  documents,
  selectedDocumentIds,
  onToggleDocument,
  onSelectAll,
  onClearSelection,
  onInspectDocument,
  onDeleteDocument,
  onSampleLoaded,
  isLoading
}: DocumentLibraryProps) {
  const [isSampleModalOpen, setIsSampleModalOpen] = useState<boolean>(false);
  const [samples, setSamples] = useState<SampleBenchmarkDef[]>([]);
  const [loadingSampleFilename, setLoadingSampleFilename] = useState<string | null>(null);

  // Distinguish user-uploaded papers from sample benchmark papers
  const userDocuments = documents.filter(d => !SAMPLE_BENCHMARK_NAMES.includes(d.filename));
  const loadedSampleDocuments = documents.filter(d => SAMPLE_BENCHMARK_NAMES.includes(d.filename));

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString: string): string => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  // Fetch available sample papers
  const fetchSamples = async () => {
    try {
      const res = await fetch('/api/documents/samples');
      if (res.ok) {
        const data = await res.json() as { ok: boolean; samples: SampleBenchmarkDef[] };
        setSamples(data.samples);
      }
    } catch (err) {
      console.error('Failed to fetch benchmark sample papers:', err);
    }
  };

  useEffect(() => {
    if (isSampleModalOpen) {
      fetchSamples();
    }
  }, [isSampleModalOpen, documents]);

  // Load sample paper on demand
  const handleLoadSample = async (filename: string) => {
    setLoadingSampleFilename(filename);
    try {
      const res = await fetch('/api/documents/samples/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        const data = await res.json() as { ok: boolean; document: DocumentSummary; message: string };
        if (data.document && onSampleLoaded) {
          onSampleLoaded(data.document);
        }
        await fetchSamples();
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to load' }));
        alert(`Error loading sample paper: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Failed to load sample paper:', err);
    } finally {
      setLoadingSampleFilename(null);
    }
  };

  const allSelected = documents.length > 0 && selectedDocumentIds.length === documents.length;

  return (
    <div className="space-y-4">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Paper Library</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {documents.length} Total
              </span>
            </h3>

            {selectedDocumentIds.length > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                {selectedDocumentIds.length} Selected for Query
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select multiple papers to query across them simultaneously with verified page citations
          </p>
        </div>

        {/* Action Controls & Sample Paper Drawer Trigger */}
        <div className="flex items-center gap-2 flex-wrap">
          {documents.length > 0 && (
            <>
              <button
                onClick={allSelected ? onClearSelection : onSelectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 transition cursor-pointer shadow-xs"
                title={allSelected ? 'Deselect all papers' : 'Select all papers'}
              >
                {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-blue-600" /> : <Square className="w-3.5 h-3.5" />}
                <span>{allSelected ? 'Deselect All' : `Select All (${documents.length})`}</span>
              </button>

              {selectedDocumentIds.length > 0 && (
                <button
                  onClick={onClearSelection}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Clear ({selectedDocumentIds.length})
                </button>
              )}
            </>
          )}

          {/* Dedicated On-Demand Sample Papers Button (Keeps samples completely side & clean) */}
          <button
            onClick={() => setIsSampleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 text-purple-700 dark:text-purple-300 border border-purple-300/60 dark:border-purple-800/80 transition shadow-xs cursor-pointer"
            title="Browse and load benchmark sample papers on demand"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-500" />
            <span>Sample Papers</span>
            {loadedSampleDocuments.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-600 text-white font-mono">
                {loadedSampleDocuments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Empty State */}
      {documents.length === 0 && !isLoading && (
        <div className="p-8 text-center rounded-2xl bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center text-blue-500 mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-800 dark:text-slate-200 font-bold">No research papers in workspace</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Upload your PDF documents above to extract pages and generate semantic vectors, or load standard benchmark papers from the Sample Papers button.
            </p>
          </div>
          <button
            onClick={() => setIsSampleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition shadow-md shadow-purple-500/20 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            View Sample Benchmark Papers
          </button>
        </div>
      )}

      {/* Main Document Grid (User Papers prioritized) */}
      <div className="space-y-4">
        {userDocuments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {userDocuments.map((doc) => {
              const isSelected = selectedDocumentIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  onClick={() => onToggleDocument(doc.id)}
                  className={`relative p-4 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-3 cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-slate-900/95 border-2 border-blue-500 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/20'
                      : 'bg-white/95 dark:bg-slate-900/50 border border-slate-200/90 dark:border-slate-800/80 hover:border-blue-400 dark:hover:border-slate-700 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Top Row: Title, Checkbox & Action Icons */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center transition-colors ${
                        isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-slate-300 border border-blue-100 dark:border-slate-700'
                      }`}>
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate" title={doc.title || doc.filename}>
                          {doc.title || doc.filename}
                        </h4>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate" title={doc.filename}>
                          {doc.filename}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onInspectDocument(doc.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
                        title="Inspect Extracted Pages"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteDocument(doc.id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 transition cursor-pointer"
                        title="Delete Document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onToggleDocument(doc.id)}
                        className={`p-1.5 rounded-lg transition ${
                          isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 hover:text-slate-500'
                        }`}
                        title={isSelected ? 'Deselect paper' : 'Select paper for multi-doc querying'}
                      >
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Metadata Badges */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <FileText className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{doc.totalPages} Pages</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <Layers className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{doc.totalChunks} Chunks</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <HardDrive className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                      <span>{formatFileSize(doc.fileSizeBytes)}</span>
                    </div>
                  </div>

                  {/* Selection Status Bar */}
                  <div className="pt-1 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {formatDate(doc.createdAt)}
                    </span>

                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}>
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          Selected
                        </>
                      ) : (
                        'Click to Select'
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Distinct Collapsible Section for Benchmark Samples (Only when loaded) */}
        {loadedSampleDocuments.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-purple-500" />
                Benchmark Sample Papers ({loadedSampleDocuments.length})
              </span>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono">
                Loaded on demand
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {loadedSampleDocuments.map((doc) => {
                const isSelected = selectedDocumentIds.includes(doc.id);

                return (
                  <div
                    key={doc.id}
                    onClick={() => onToggleDocument(doc.id)}
                    className={`relative p-3.5 rounded-2xl transition-all duration-200 flex flex-col justify-between space-y-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50/50 dark:bg-purple-950/30 border-2 border-purple-500 shadow-sm'
                        : 'bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {doc.title || doc.filename}
                            </h4>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                              Benchmark
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{doc.filename}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onInspectDocument(doc.id)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          title="Inspect Pages"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onDeleteDocument(doc.id)}
                          className="p-1 rounded text-slate-400 hover:text-red-500"
                          title="Remove Benchmark Paper"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onToggleDocument(doc.id)}
                          className={`p-1 ${isSelected ? 'text-purple-600' : 'text-slate-300'}`}
                        >
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <span>{doc.totalPages} Pages • {doc.totalChunks} Chunks</span>
                      <span className={isSelected ? 'text-purple-600 font-semibold' : ''}>
                        {isSelected ? 'Selected ✓' : 'Click to select'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal / Side Drawer for Benchmark Sample Papers */}
      {isSampleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Sample Benchmark Papers</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Load canonical AI research papers on demand</p>
                </div>
              </div>

              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                These standard benchmark papers are kept on the side so your workspace stays clean. Click below to load them into your active RAG vector index whenever you want to test attention queries or residual learning benchmarks.
              </p>

              <div className="space-y-3">
                {samples.map((sample) => (
                  <div
                    key={sample.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col justify-between space-y-3 hover:border-purple-300 dark:hover:border-purple-800/80 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">{sample.title}</h4>
                          <p className="text-[11px] font-mono text-purple-600 dark:text-purple-400 font-medium mt-0.5">
                            {sample.authors}
                          </p>
                        </div>
                        {sample.isLoaded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Loaded
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-200/60 dark:bg-slate-800">
                            {sample.pages} pages • {sample.sizeKb} KB
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                        {sample.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        File: {sample.filename}
                      </span>

                      {sample.isLoaded ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              if (sample.loadedDocId) {
                                onToggleDocument(sample.loadedDocId);
                              }
                              setIsSampleModalOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shadow-xs"
                          >
                            <Sparkles className="w-3 h-3" />
                            Select in Chat
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleLoadSample(sample.filename)}
                          disabled={loadingSampleFilename === sample.filename}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white transition shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          <DownloadCloud className={`w-3.5 h-3.5 ${loadingSampleFilename === sample.filename ? 'animate-bounce' : ''}`} />
                          <span>{loadingSampleFilename === sample.filename ? 'Indexing Pages...' : 'Load Paper'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Benchmark papers are cached locally in /data/sample_papers</span>
              <button
                onClick={() => setIsSampleModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
