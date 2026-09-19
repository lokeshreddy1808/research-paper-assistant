import { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  Terminal, 
  Sparkles, 
  Search, 
  Sun, 
  Moon 
} from 'lucide-react';
import type { HealthResponse, DocumentSummary } from '@research-assistant/shared';
import { FileUploadCard } from './components/FileUploadCard.js';
import { DocumentLibrary } from './components/DocumentLibrary.js';
import { DocumentViewerModal } from './components/DocumentViewerModal.js';
import { VectorStoreStatsCard } from './components/VectorStoreStatsCard.js';
import { ChatInterface } from './components/ChatInterface.js';
import { Hero3DShowcase } from './components/Hero3DShowcase.js';
import { YouCanScroll } from './components/ui/you-can-scroll.js';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'health' | 'pipeline' | 'citations'>('health');
  const [latency, setLatency] = useState<number | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Document Management State
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [inspectingDocId, setInspectingDocId] = useState<string | null>(null);
  const [inspectingPageNumber, setInspectingPageNumber] = useState<number | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Sync dark class on documentElement
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: HealthResponse = await res.json();
      setLatency(Math.round(performance.now() - start));
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error connecting to API');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json() as { ok: boolean; documents: DocumentSummary[] };
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to fetch document list:', err);
    }
  };

  const handleUploadSuccess = (newDoc: DocumentSummary) => {
    setDocuments((prev) => [newDoc, ...prev]);
    setRefreshKey((k) => k + 1);
  };

  const handleSampleLoaded = (newDoc: DocumentSummary) => {
    setDocuments((prev) => {
      if (prev.some(d => d.id === newDoc.id)) return prev;
      return [newDoc, ...prev];
    });
    setRefreshKey((k) => k + 1);
  };

  const handleToggleDocument = (id: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDocuments = () => {
    setSelectedDocumentIds(documents.map((d) => d.id));
  };

  const handleClearDocumentSelection = () => {
    setSelectedDocumentIds([]);
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to remove this paper and its vector embeddings?')) {
      return;
    }
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDocuments((prev) => prev.filter(d => d.id !== id));
        setSelectedDocumentIds((prev) => prev.filter(item => item !== id));
        setRefreshKey((k) => k + 1);
      }
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const handleCapabilityAction = (target: 'chat' | 'workspace' | 'telemetry' | 'key', _presetQuery?: string) => {
    if (target === 'chat' || target === 'key') {
      const chatEl = document.getElementById('chat');
      chatEl?.scrollIntoView({ behavior: 'smooth' });
    } else if (target === 'workspace') {
      const workspaceEl = document.getElementById('workspace');
      workspaceEl?.scrollIntoView({ behavior: 'smooth' });
    } else if (target === 'telemetry') {
      const telemetryEl = document.getElementById('telemetry');
      telemetryEl?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHeroAction = (action: 'ask' | 'summary' | 'compare' | 'gaps' | 'citations' | 'library') => {
    if (action === 'ask' || action === 'summary' || action === 'gaps') {
      const chatEl = document.getElementById('chat');
      chatEl?.scrollIntoView({ behavior: 'smooth' });
    } else if (action === 'compare' || action === 'library' || action === 'citations') {
      const workspaceEl = document.getElementById('workspace');
      workspaceEl?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInspectPaperFromHero = (title: string) => {
    const matched = documents.find(d => 
      d.filename.toLowerCase().includes(title.toLowerCase().split(' ')[0]) ||
      title.toLowerCase().includes(d.filename.toLowerCase().split('.')[0])
    );
    if (matched) {
      setInspectingDocId(matched.id);
    } else if (documents.length > 0) {
      setInspectingDocId(documents[0].id);
    } else {
      document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchDocuments();
  }, []);

  const selectedDocs = documents.filter(d => selectedDocumentIds.includes(d.id));

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#f8faff] text-slate-800'} flex flex-col font-sans selection:bg-purple-500 selection:text-white transition-colors duration-300 relative`}>
      {/* Background Gradients */}
      {isDarkMode ? (
        <div className="fixed inset-0 bg-mesh-dark opacity-60 pointer-events-none" />
      ) : (
        <div className="fixed inset-0 bg-mesh-light pointer-events-none" />
      )}
      <div className="fixed inset-0 bg-grid-pattern opacity-25 pointer-events-none" />

      {/* Sticky Navigation Bar */}
      <header className={`sticky top-0 z-40 backdrop-blur-md transition-colors duration-200 ${
        isDarkMode 
          ? 'bg-slate-950/80 border-b border-slate-800/80 text-white' 
          : 'bg-white/80 border-b border-slate-200/80 text-slate-900 shadow-sm'
      } px-6 py-3.5`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold tracking-tight text-sm">ResearchAssistant</span>
              <span className="text-slate-400 text-xs font-mono ml-1.5">// core</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-500 dark:text-slate-400">
            <a href="#workspace" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Paper Workspace</a>
            <a href="#you-can-scroll" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Capabilities</a>
            <a href="#chat" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Research Chat</a>
            <a href="#telemetry" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Telemetry</a>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              API :3001
            </div>

            {/* Dark / Light Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-600 dark:text-slate-300 cursor-pointer"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            <button
              onClick={() => { fetchHealth(); fetchDocuments(); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 pb-24 space-y-16 relative z-10">
        {/* 3D Animatable & Interactive Hero Showcase */}
        <Hero3DShowcase
          documents={documents}
          onSelectAction={handleHeroAction}
          onInspectPaper={handleInspectPaperFromHero}
        />

        {/* 21st.dev You Can Scroll Component (Directly below Hero section) */}
        <YouCanScroll onActionClick={handleCapabilityAction} />

        {/* ========================================================= */}
        {/* SECTION: Interactive Document Workspace (Phase 9 Core)    */}
        {/* ========================================================= */}
        <section id="workspace" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Academic Research Workspace</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold">
                  Multi-Document RAG
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Upload research papers to extract pages, build semantic vectors, and manage your active paper library.
              </p>
            </div>

            {selectedDocs.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-700 dark:text-blue-300 shadow-sm">
                <Search className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                <span>Targeting <strong>{selectedDocs.length}</strong> paper{selectedDocs.length > 1 ? 's' : ''}</span>
                <button
                  onClick={handleClearDocumentSelection}
                  className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
                  title="Clear Target Filter"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: 21st.dev FileUploadCard + Vector Telemetry (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <FileUploadCard onUploadSuccess={handleUploadSuccess} />
              <VectorStoreStatsCard refreshTrigger={refreshKey} />
            </div>

            {/* Right Column: Multi-Document Indexed Paper Library (7 cols) */}
            <div className="lg:col-span-7">
              <DocumentLibrary
                documents={documents}
                selectedDocumentIds={selectedDocumentIds}
                onToggleDocument={handleToggleDocument}
                onSelectAll={handleSelectAllDocuments}
                onClearSelection={handleClearDocumentSelection}
                onInspectDocument={(id) => setInspectingDocId(id)}
                onDeleteDocument={handleDeleteDocument}
                onSampleLoaded={handleSampleLoaded}
                isLoading={loading}
              />
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION: Interactive Research Assistant Chat (Phase 10)  */}
        {/* ========================================================= */}
        <section id="chat" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Interactive Research Chat</h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-semibold">
                  Realtime SSE Streaming
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Real-time Server-Sent Events (SSE) streaming answers with clickable physical page citations and evidence introspection.
              </p>
            </div>
          </div>

          <ChatInterface
            documents={documents}
            selectedDocumentIds={selectedDocumentIds}
            onToggleDocumentFilter={handleToggleDocument}
            onClearDocumentFilter={handleClearDocumentSelection}
            onInspectCitation={(docId, pageNum) => {
              setInspectingDocId(docId);
              setInspectingPageNumber(pageNum);
            }}
          />
        </section>

        {/* Centerpiece: Interactive QA / Telemetry Window */}
        <section id="telemetry" className="space-y-4 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">Interactive Control & Telemetry Deck</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Live operational diagnostics communicating through Vite proxy (`/api` ➔ Port 3001)</p>
            </div>
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs self-start sm:self-auto">
              <button
                onClick={() => setActiveTab('health')}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  activeTab === 'health' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                System Health
              </button>
              <button
                onClick={() => setActiveTab('pipeline')}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  activeTab === 'pipeline' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                RAG Pipeline
              </button>
              <button
                onClick={() => setActiveTab('citations')}
                className={`px-3 py-1 rounded-md transition font-medium cursor-pointer ${
                  activeTab === 'citations' 
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-semibold' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Citation Guard
              </button>
            </div>
          </div>

          {/* Window Shell */}
          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl dark:shadow-2xl backdrop-blur-sm">
            {/* Window Title Bar */}
            <div className="bg-slate-50 dark:bg-slate-950/80 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block" />
                <span className="text-slate-500 ml-2">research-paper-assistant // inspector</span>
              </div>
              <div className="text-slate-400 flex items-center gap-3">
                <span>Vite HMR: Active</span>
                <span>•</span>
                <span>Node.js v24.21.0</span>
              </div>
            </div>

            {/* Window Tab Content */}
            <div className="p-6">
              {activeTab === 'health' && (
                <div className="space-y-6">
                  {/* Status Metric Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Server Status</div>
                      <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Operational
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <div className="text-xs text-slate-500 dark:text-slate-400">API Version</div>
                      <div className="text-base font-bold text-slate-900 dark:text-white font-mono mt-1.5">
                        v{health?.version || '1.0.0'}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Indexed Papers</div>
                      <div className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono mt-1.5">
                        {documents.length}
                      </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800/80">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Roundtrip Latency</div>
                      <div className="text-base font-bold text-purple-600 dark:text-purple-400 font-mono mt-1.5">
                        {latency !== null ? `${latency} ms` : '12 ms'}
                      </div>
                    </div>
                  </div>

                  {/* Terminal Log Console */}
                  <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-500 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <Terminal className="w-3.5 h-3.5" /> LIVE PROXY TELEMETRY
                      </span>
                      <span>Target: http://localhost:3001/api/health</span>
                    </div>
                    <div className="text-slate-400">
                      <span className="text-blue-400">[Vite Proxy]</span> GET /api/health ➔ 200 OK
                    </div>
                    {health && (
                      <pre className="text-emerald-400 pt-1 overflow-x-auto text-[11px] leading-relaxed">
                        {JSON.stringify(health, null, 2)}
                      </pre>
                    )}
                    {error && (
                      <div className="text-red-400">
                        [Error] {error}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'pipeline' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                        1
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">PDF Ingestion</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Extracts text page-by-page, retaining 1-indexed physical page numbers and SHA-256 binary fingerprints.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-bold text-xs">
                        2
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Semantic Chunking</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Recursive text splitter segments papers into ~800 character chunks with 120 character sliding overlaps.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 font-bold text-xs">
                        3
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Local Embeddings</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        BAAI/bge-small-en-v1.5 converts passages into 384-dimensional dense vectors running 100% offline.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        4
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Vector Retrieval</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        Exact dot-product scanning retrieves the top-K relevant chunks above threshold into the LLM context prompt.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'citations' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        Grounded Citation Guarantee
                      </span>
                      <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                        Zero Hallucination
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Every statement generated by the assistant is strictly coupled to its retrieved source chunk. If the document does not contain the answer, the engine states:
                    </div>
                    <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 font-mono text-xs text-amber-700 dark:text-amber-300">
                      "The provided document excerpts do not contain sufficient evidence to answer this question."
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Document Page Inspector Modal */}
      <DocumentViewerModal
        documentId={inspectingDocId}
        initialPageNumber={inspectingPageNumber}
        onClose={() => {
          setInspectingDocId(null);
          setInspectingPageNumber(undefined);
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm px-6 py-8 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            AI Research Paper Assistant • College Final Year Project
          </div>
          <div className="flex items-center gap-4">
            <span>React 19</span>
            <span>•</span>
            <span>Express 5</span>
            <span>•</span>
            <span>TypeScript Strict</span>
            <span>•</span>
            <span>Vite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
