import { useState, useRef } from 'react';
import { 
  Sparkles, 
  Layers, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Compass,
  Code2,
  Lock
} from 'lucide-react';

interface FeatureCard {
  id: string;
  badge: string;
  badgeColor: string;
  lead: string;
  title: string;
  description: string;
  codeSnippet?: string;
  metricLabel: string;
  metricValue: string;
  actionText: string;
  actionTarget: 'chat' | 'workspace' | 'telemetry' | 'key';
  presetQuery?: string;
  gradient: string;
  icon: typeof Sparkles;
}

const CAPABILITIES: FeatureCard[] = [
  {
    id: 'equations',
    badge: 'Mathematical Ingestion',
    badgeColor: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/30',
    lead: 'YOU CAN',
    title: 'Deconstruct Dense Equations & Attention Matrices',
    description: 'Instantly unpack complex mathematical definitions, scaled dot-product attention formulations, softmax projections, and tensor dimensions without reading 20-page appendices.',
    codeSnippet: 'Attention(Q, K, V) = softmax( (Q * K^T) / sqrt(d_k) ) * V',
    metricLabel: 'Vector Resolution',
    metricValue: '384 Dimensions',
    actionText: 'Ask About Architecture',
    actionTarget: 'chat',
    presetQuery: 'How is the scaled dot-product attention mathematically formulated and what dimensions are used?',
    gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    icon: Code2
  },
  {
    id: 'synthesis',
    badge: 'Multi-Document RAG',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    lead: 'YOU CAN',
    title: 'Cross-Synthesize Multiple arXiv & IEEE Papers',
    description: 'Select two, five, or ten papers to compare methodologies, loss functions, hardware requirements, and baseline performance in a single coherent prompt.',
    codeSnippet: 'Scope: [ "Attention Is All You Need", "BERT", "DeepSeek R1" ]',
    metricLabel: 'Simultaneous Papers',
    metricValue: 'Multi-Select Scoped',
    actionText: 'Explore Workspace',
    actionTarget: 'workspace',
    gradient: 'from-purple-500/20 via-pink-500/10 to-transparent',
    icon: Layers
  },
  {
    id: 'citations',
    badge: 'Citation Guard',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    lead: 'YOU CAN',
    title: 'Trace Every Answer to Exact Physical PDF Pages',
    description: 'Eliminate AI hallucinations. Every factual sentence is backed by an interactive [Page X] badge that opens the original PDF excerpt and cosine similarity score.',
    codeSnippet: 'Grounding Verification: Cosine Similarity >= 0.50 [Page 4, Lines 12-28]',
    metricLabel: 'Citation Precision',
    metricValue: '100% Verifiable',
    actionText: 'View Telemetry Deck',
    actionTarget: 'telemetry',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    icon: ShieldCheck
  },
  {
    id: 'groq-speed',
    badge: 'Zero-RAM Cloud Speed',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    lead: 'YOU CAN',
    title: 'Stream 300+ Tokens/s with Groq Llama 3.3 70B',
    description: 'Experience ultra-fast real-time inference at near zero local compute overhead. Stream rich academic answers with high token throughput and full reasoning.',
    codeSnippet: 'Engine: groq/llama-3.3-70b-versatile @ 320 tok/sec',
    metricLabel: 'Streaming Latency',
    metricValue: '< 150ms TTFT',
    actionText: 'Configure API Key',
    actionTarget: 'key',
    gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
    icon: Zap
  },
  {
    id: 'local-privacy',
    badge: '100% Offline Privacy',
    badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    lead: 'YOU CAN',
    title: 'Process Sensitive Papers with Local BAAI Embeddings',
    description: 'PDF text extraction, semantic chunking (~800 characters), and vector embeddings run completely offline on your device with no external vector database needed.',
    codeSnippet: 'Local Model: BAAI/bge-small-en-v1.5 (In-Memory Vector Space)',
    metricLabel: 'Data Privacy',
    metricValue: 'Zero Data Leakage',
    actionText: 'Upload Custom PDF',
    actionTarget: 'workspace',
    gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    icon: Lock
  },
  {
    id: 'gaps',
    badge: 'Empirical Critique',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    lead: 'YOU CAN',
    title: 'Detect Research Gaps & Methodology Conflicts',
    description: 'Prompt the assistant to critically scrutinize paper limitations, compute requirements, dataset biases, missing ablation studies, and proposed future research.',
    codeSnippet: 'Critique: "What limitations or negative trade-offs did the authors mention?"',
    metricLabel: 'Critical Analysis',
    metricValue: 'Ablation & Gaps',
    actionText: 'Ask About Gaps',
    actionTarget: 'chat',
    presetQuery: 'What limitations, trade-offs, or failure modes did the authors identify in their methodology?',
    gradient: 'from-rose-500/20 via-red-500/10 to-transparent',
    icon: Compass
  }
];

interface YouCanScrollProps {
  onActionClick: (target: 'chat' | 'workspace' | 'telemetry' | 'key', presetQuery?: string) => void;
}

/**
 * Interactive 3D Kinetic Scroll Component inspired by 21st.dev @jh3yy_deleted/components/you-can-scroll
 * Showcases what users can do with the Research Assistant through spatial kinetic cards,
 * ticker banners, and direct interactive action triggers.
 */
export function YouCanScrollShowcase({ onActionClick }: YouCanScrollProps) {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Mouse 3D tilt handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev + 1) % CAPABILITIES.length);
  };

  const prevSlide = () => {
    setActiveIndex((prev) => (prev - 1 + CAPABILITIES.length) % CAPABILITIES.length);
  };

  const currentCap = CAPABILITIES[activeIndex];
  const IconComponent = currentCap.icon;

  return (
    <section 
      id="you-can-scroll" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800/90 shadow-2xl p-6 sm:p-10 my-8 text-white"
      style={{ perspective: '1200px' }}
    >
      {/* Background Animated Kinetic Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950 pointer-events-none" />
      <div 
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none transition-transform duration-700"
        style={{
          transform: `translate(${mousePos.x * 40}px, ${mousePos.y * 40}px)`
        }}
      />
      <div 
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none transition-transform duration-700"
        style={{
          transform: `translate(${mousePos.x * -40}px, ${mousePos.y * -40}px)`
        }}
      />

      {/* Kinetic Scrolling Infinite Marquee Ticker */}
      <div className="relative overflow-hidden py-2 -mx-6 sm:-mx-10 border-y border-slate-800/60 bg-slate-900/40 mb-8 select-none">
        <div className="flex whitespace-nowrap animate-marquee gap-8 text-[11px] font-mono tracking-widest text-slate-400">
          <span>YOU CAN QUERY COMPLEX MATHEMATICS</span>
          <span className="text-blue-500">•</span>
          <span>YOU CAN SYNTHESIZE MULTIPLE PAPERS</span>
          <span className="text-purple-500">•</span>
          <span>YOU CAN VERIFY PHYSICAL CITATIONS</span>
          <span className="text-emerald-500">•</span>
          <span>YOU CAN STREAM 300+ TOK/S VIA GROQ</span>
          <span className="text-amber-500">•</span>
          <span>YOU CAN CRITIQUE METHODOLOGY GAPS</span>
          <span className="text-cyan-500">•</span>
          <span>YOU CAN RUN 100% OFFLINE BGE EMBEDDINGS</span>
          <span className="text-rose-500">•</span>
          <span>YOU CAN QUERY COMPLEX MATHEMATICS</span>
          <span className="text-blue-500">•</span>
          <span>YOU CAN SYNTHESIZE MULTIPLE PAPERS</span>
          <span className="text-purple-500">•</span>
        </div>
      </div>

      {/* Header Section */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-800/80">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" style={{ animationDuration: '4s' }} />
            <span>Interactive Capability Deck</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Explore <span className="bg-gradient-to-r from-blue-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">What You Can Do</span>
          </h2>
          <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
            Scroll, switch, or interact with capabilities below to directly trigger AI queries, synthesis pipelines, and verified citations.
          </p>
        </div>

        {/* Carousel Slide Indicators & Controls */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400 mr-2">
            <span className="text-white font-bold">{String(activeIndex + 1).padStart(2, '0')}</span>
            <span>/</span>
            <span>{String(CAPABILITIES.length).padStart(2, '0')}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={prevSlide}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Previous Capability"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextSlide}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              title="Next Capability"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main 3D Spatial Feature Card */}
      <div className="relative z-10 py-8">
        <div 
          className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center transition-transform duration-500 ease-out"
          style={{
            transform: `rotateY(${mousePos.x * 6}deg) rotateX(${mousePos.y * -6}deg)`
          }}
        >
          {/* Left Column: Big Statement & Text */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold border backdrop-blur-md"
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.8)'
                }}
              >
                <span className={`px-2 py-0.5 rounded-full text-[11px] ${currentCap.badgeColor}`}>
                  {currentCap.badge}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">Feature 0{activeIndex + 1}</span>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-mono tracking-widest text-blue-400 uppercase font-bold">
                  {currentCap.lead}
                </span>
                <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                  {currentCap.title}
                </h3>
              </div>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl pt-1">
                {currentCap.description}
              </p>
            </div>

            {/* Code / Logic Preview Box */}
            {currentCap.codeSnippet && (
              <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs text-cyan-300 space-y-1.5 shadow-inner">
                <div className="flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-800 pb-1">
                  <span>LIVE REASONING PATTERN</span>
                  <span>Grounding Engine</span>
                </div>
                <div className="overflow-x-auto py-1 text-slate-200">
                  {currentCap.codeSnippet}
                </div>
              </div>
            )}

            {/* Action Trigger Row */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onActionClick(currentCap.actionTarget, currentCap.presetQuery)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all duration-200 cursor-pointer group"
              >
                <span>{currentCap.actionText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                <span className="text-slate-500">{currentCap.metricLabel}:</span>
                <span className="font-bold text-white">{currentCap.metricValue}</span>
              </div>
            </div>
          </div>

          {/* Right Column: 3D Holographic Card Viewport */}
          <div className="lg:col-span-5 flex justify-center">
            <div 
              className={`w-full max-w-md rounded-2xl p-6 bg-gradient-to-b ${currentCap.gradient} border border-slate-700/80 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-blue-400 transition-all duration-300`}
              style={{
                boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px 2px rgba(59, 130, 246, 0.15)'
              }}
            >
              {/* Corner Glass Specular */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

              {/* Icon Sphere */}
              <div className="w-14 h-14 rounded-2xl bg-slate-900/90 border border-slate-700 flex items-center justify-center text-blue-400 shadow-xl mb-6 group-hover:scale-110 transition-transform">
                <IconComponent className="w-7 h-7" />
              </div>

              {/* Interactive Card Telemetry */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400 border-b border-slate-700/60 pb-2">
                  <span>SYSTEM CAPABILITY</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-white">
                    {currentCap.title}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-relaxed">
                    Integrated across the document chunker, vector database, and real-time streaming pipeline.
                  </div>
                </div>

                {/* Mini Metric Pills */}
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">ENGINE</span>
                    <span className="text-slate-200">Local + Groq</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-500 block text-[9px]">GROUNDING</span>
                    <span className="text-emerald-400 font-bold">1-Indexed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Horizontal Quick-Nav Thumbnails */}
      <div className="relative z-10 pt-6 border-t border-slate-800/80">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {CAPABILITIES.map((cap, idx) => {
            const CapIcon = cap.icon;
            const isSelected = idx === activeIndex;
            return (
              <button
                key={cap.id}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`p-2.5 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <CapIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="font-mono text-[9px] text-slate-500">0{idx + 1}</span>
                </div>
                <div className="text-[11px] font-semibold line-clamp-1">
                  {cap.badge}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
