import { useState, useRef, useEffect, type TouchEvent, type MouseEvent } from 'react';
import { 
  Search, 
  FileText, 
  GitCompare, 
  Lightbulb, 
  Quote, 
  Database, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles
} from 'lucide-react';
import type { DocumentSummary } from '@research-assistant/shared';

interface Hero3DShowcaseProps {
  documents: DocumentSummary[];
  onSelectAction?: (action: 'ask' | 'summary' | 'compare' | 'gaps' | 'citations' | 'library') => void;
  onInspectPaper?: (title: string) => void;
}

interface ShowcasePaper {
  id: string;
  title: string;
  category: string;
  pages: number;
  abstract: string;
  badge?: string;
  diagramType: 'brain_mri' | 'flowchart' | 'barchart' | 'attention_blocks' | 'rl_loop';
  sectionIntro: string;
}

const DEFAULT_SHOWCASE_PAPERS: ShowcasePaper[] = [
  {
    id: 'paper-nlp',
    title: 'A Survey on Natural Language Processing',
    category: 'Computational Linguistics',
    pages: 18,
    abstract: 'Recent advancements in transformer-based language representations have transformed neural text synthesis, retrieval architectures, and contextual embedding pipelines across multilingual benchmarks.',
    diagramType: 'flowchart',
    sectionIntro: 'Natural language processing has evolved from statistical n-gram modeling to self-supervised attention representations.'
  },
  {
    id: 'paper-healthcare',
    title: 'Machine Learning in Healthcare',
    category: 'Biomedical Informatics',
    pages: 12,
    abstract: 'We systematically evaluate deep clinical prognostic models across electronic health record (EHR) longitudinal cohorts, quantifying sensitivity, specificity, and generalization under covariate shift.',
    diagramType: 'barchart',
    sectionIntro: 'Predictive clinical modeling presents unique challenges in data sparsity, missingness, and high-dimensional physiological telemetry.'
  },
  {
    id: 'paper-medical-image',
    title: 'Deep Learning for Medical Image Analysis',
    category: 'Computer Vision & Radiology',
    pages: 14,
    badge: 'PDF',
    abstract: 'Automated neuroimaging segmentation using 3D convolutional and volumetric transformer architectures achieves state-of-the-art Dice scores across multi-site magnetic resonance imaging (MRI) benchmarks.',
    diagramType: 'brain_mri',
    sectionIntro: 'Magnetic resonance imaging segmentation plays a pivotal role in automated neurodegenerative anomaly detection and surgical trajectory planning.'
  },
  {
    id: 'paper-vision',
    title: 'Transformer Models for Vision Tasks',
    category: 'Computer Vision',
    pages: 16,
    abstract: 'By applying pure self-attention mechanisms directly to sequences of flattened image patches, Vision Transformers (ViT) attain exceptional sample efficiency and transfer performance on ImageNet-1K.',
    diagramType: 'attention_blocks',
    sectionIntro: 'Convolution-free vision architectures treat 16x16 pixel patches identically to linguistic tokens in standard natural language decoders.'
  },
  {
    id: 'paper-rl',
    title: 'A Review of Reinforcement Learning',
    category: 'Autonomous Agents',
    pages: 22,
    abstract: 'A comprehensive evaluation of model-free policy gradients, Q-learning value approximations, and actor-critic methods in high-dimensional continuous control environments and decision benchmarks.',
    diagramType: 'rl_loop',
    sectionIntro: 'Sequential decision-making under Markovian uncertainty requires balancing exploration of unseen state spaces with policy exploitation.'
  }
];

export function Hero3DShowcase({
  documents,
  onSelectAction,
  onInspectPaper
}: Hero3DShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState<number>(2); // Center card active by default (Medical Image Analysis)
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [mouseTilt, setMouseTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelAccumulator = useRef<number>(0);
  const wheelDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const papers = DEFAULT_SHOWCASE_PAPERS;
  const total = papers.length;

  const handlePrev = () => {
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mouse wheel scroll navigation (natural horizontal + vertical cycling)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    wheelAccumulator.current += delta;

    if (wheelDebounceTimer.current) {
      clearTimeout(wheelDebounceTimer.current);
    }

    if (wheelAccumulator.current > 40) {
      handleNext();
      wheelAccumulator.current = 0;
    } else if (wheelAccumulator.current < -40) {
      handlePrev();
      wheelAccumulator.current = 0;
    }

    wheelDebounceTimer.current = setTimeout(() => {
      wheelAccumulator.current = 0;
    }, 180);
  };

  // 3D Mouse Parallax Tilt
  const handleStageMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      const diff = e.clientX - dragStartX;
      setDragOffset(diff);
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      setMouseTilt({ x, y });
    }
  };

  const handleStageMouseLeave = () => {
    if (isDragging) {
      handleMouseUp();
    }
    setMouseTilt({ x: 0, y: 0 });
  };

  // Mouse drag handlers
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragOffset(0);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset < -50) {
      handleNext();
    } else if (dragOffset > 50) {
      handlePrev();
    }
    setDragOffset(0);
  };

  // Touch handlers for mobile/tablet
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStartX(e.touches[0].clientX);
    setDragOffset(0);
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const diff = e.touches[0].clientX - dragStartX;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragOffset < -40) {
      handleNext();
    } else if (dragOffset > 40) {
      handlePrev();
    }
    setDragOffset(0);
  };

  return (
    <section className="relative w-full overflow-hidden pt-6 pb-16 px-4 sm:px-6 select-none">
      {/* Background Soft Pastel Glow & Ambient Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft Radial Ambient Lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-tr from-blue-100/60 via-purple-100/50 to-pink-100/40 rounded-full blur-3xl opacity-70 dark:opacity-20" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-200/40 rounded-full blur-2xl opacity-50 dark:opacity-10" />
        <div className="absolute top-20 right-10 w-80 h-80 bg-purple-200/40 rounded-full blur-2xl opacity-50 dark:opacity-10" />

        {/* Ambient Floating Orbs matching reference image */}
        <div className="absolute top-32 left-[18%] w-4 h-4 rounded-full bg-blue-400/40 blur-[1px] animate-pulse" />
        <div className="absolute top-44 left-[14%] w-3 h-3 rounded-full bg-purple-400/40 blur-[1px]" />
        <div className="absolute top-24 right-[16%] w-3.5 h-3.5 rounded-full bg-purple-500/30 blur-[1px]" />
        <div className="absolute bottom-28 left-[22%] w-5 h-5 rounded-full bg-purple-300/50 blur-[2px]" />
        <div className="absolute bottom-20 right-[20%] w-4 h-4 rounded-full bg-emerald-400/40 blur-[1px]" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header Content */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          {/* Top Pill Tag matching reference image: 📚 From Papers to Possibilities */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 shadow-sm shadow-slate-200/50 backdrop-blur-md">
            <span>📚</span>
            <span>From Papers to Possibilities</span>
          </div>

          {/* Main Headline: Research Smarter with AI */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
            Research Smarter{' '}
            <span className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-500 bg-clip-text text-transparent">
              with AI
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Upload your research papers, ask questions, get instant insights, summaries and more with the power of AI and RAG.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* 3D Curved Fan of Research Papers with Floating Action Badges              */}
        {/* ========================================================================= */}
        <div className="relative mt-12 mb-6 min-h-[440px] sm:min-h-[500px] flex items-center justify-center">
          
          {/* LEFT Floating Feature Cards (Vertical Stack matching reference image) */}
          <div className="hidden xl:flex flex-col gap-4 absolute left-0 top-1/2 -translate-y-1/2 z-30">
            <button
              onClick={() => onSelectAction?.('ask')}
              className="flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/60 dark:shadow-none hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer text-left backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ask Questions</div>
                <div className="text-[10px] text-slate-400">Grounded in verified pages</div>
              </div>
            </button>

            <button
              onClick={() => onSelectAction?.('summary')}
              className="flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/60 dark:shadow-none hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer text-left backdrop-blur-md ml-4"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-100 dark:border-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Get Summaries</div>
                <div className="text-[10px] text-slate-400">Key findings & abstracts</div>
              </div>
            </button>

            <button
              onClick={() => onSelectAction?.('compare')}
              className="flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/60 dark:shadow-none hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer text-left backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition">
                <GitCompare className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Compare Papers</div>
                <div className="text-[10px] text-slate-400">Cross-document analysis</div>
              </div>
            </button>
          </div>

          {/* RIGHT Floating Feature Cards (Vertical Stack matching reference image) */}
          <div className="hidden xl:flex flex-col gap-4 absolute right-0 top-1/2 -translate-y-1/2 z-30">
            <button
              onClick={() => onSelectAction?.('gaps')}
              className="flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/60 dark:shadow-none hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer text-left backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition">
                <Lightbulb className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Find Research Gaps</div>
                <div className="text-[10px] text-slate-400">Identify open questions</div>
              </div>
            </button>

            <button
              onClick={() => onSelectAction?.('citations')}
              className="flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/60 dark:shadow-none hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer text-left backdrop-blur-md mr-4"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition">
                <Quote className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Generate Citations</div>
                <div className="text-[10px] text-slate-400">APA, BibTeX & page links</div>
              </div>
            </button>

            <button
              onClick={() => onSelectAction?.('library')}
              className="flex items-center gap-3 p-3.5 pr-5 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/60 dark:shadow-none hover:shadow-xl hover:scale-105 transition-all duration-300 group cursor-pointer text-left backdrop-blur-md"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">Multiple Documents</div>
                <div className="text-[10px] text-slate-400">{documents.length} papers indexed</div>
              </div>
            </button>
          </div>

          {/* Left Arrow Navigation Button */}
          <button
            onClick={handlePrev}
            aria-label="Previous paper"
            className="absolute left-2 sm:left-6 md:left-12 lg:left-24 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center text-blue-600 dark:text-blue-400 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* Right Arrow Navigation Button */}
          <button
            onClick={handleNext}
            aria-label="Next paper"
            className="absolute right-2 sm:right-6 md:right-12 lg:right-24 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md hover:shadow-lg hover:scale-110 active:scale-95 transition-all duration-200 flex items-center justify-center text-blue-600 dark:text-blue-400 cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* 3D Perspective Stage Container with Wheel & Tilt Interactions */}
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleStageMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
              transform: `rotateX(${-mouseTilt.y * 6}deg) rotateY(${mouseTilt.x * 9}deg)`,
              transition: isDragging ? 'none' : 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="relative w-full max-w-5xl h-[430px] sm:h-[490px] flex items-center justify-center [perspective:1400px] cursor-grab active:cursor-grabbing will-change-transform"
          >
            {papers.map((paper, index) => {
              // Calculate relative distance from active index (-2, -1, 0, 1, 2)
              const offset = index - activeIndex;
              const isActive = offset === 0;

              // Hide cards that are far away from viewport
              if (Math.abs(offset) > 2) return null;

              // 3D positioning calculations for realistic spatial coverflow
              let translateX = offset * 180; // Spacious desktop spread
              let rotateY = offset * -22;   // Natural curved fan rotation
              let translateZ = isActive ? 80 : -Math.abs(offset) * 70;
              let scale = isActive ? 1.08 : (1 - Math.abs(offset) * 0.12);
              let zIndex = 30 - Math.abs(offset) * 5;
              let opacity = 1 - Math.abs(offset) * 0.16;

              if (isActive) {
                zIndex = 40;
                opacity = 1;
              }

              // Apply drag offset for buttery interactive dragging
              if (isDragging) {
                translateX += dragOffset * 0.45;
              }

              return (
                <div
                  key={paper.id}
                  onClick={() => {
                    if (isActive) {
                      onInspectPaper?.(paper.title);
                    } else {
                      setActiveIndex(index);
                    }
                  }}
                  style={{
                    transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                    zIndex,
                    opacity
                  }}
                  className={`absolute w-[245px] sm:w-[290px] h-[360px] sm:h-[420px] rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) p-5 flex flex-col justify-between overflow-hidden cursor-pointer select-none will-change-transform ${
                    isActive 
                      ? 'border-purple-400 dark:border-purple-500/60 shadow-2xl shadow-purple-500/20 ring-2 ring-purple-500/30' 
                      : 'border-slate-200/90 dark:border-slate-800/90 shadow-xl opacity-90 hover:opacity-100 hover:border-blue-400 dark:hover:border-slate-700'
                  }`}
                >
                  {/* Dynamic Specular Glass Reflection Layer */}
                  <div 
                    className="absolute inset-0 pointer-events-none rounded-2xl transition-opacity duration-300"
                    style={{
                      background: `radial-gradient(circle at ${50 + mouseTilt.x * 40}% ${50 + mouseTilt.y * 40}%, rgba(255, 255, 255, ${isActive ? 0.35 : 0.12}) 0%, transparent 65%)`
                    }}
                  />
                  {/* Paper Header with PDF Pill Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        {paper.category}
                      </span>
                      {paper.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-purple-600 text-white shadow-sm shadow-purple-500/30">
                          {paper.badge}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug tracking-tight line-clamp-2">
                      {paper.title}
                    </h3>

                    {/* Abstract Section with Simulated Scientific Text Lines */}
                    <div className="mt-3 space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Abstract</span>
                      <div className="space-y-1 pt-0.5">
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full w-full" />
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full w-5/6" />
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full w-4/6" />
                      </div>
                    </div>
                  </div>

                  {/* Scientific Figure / Diagram Simulation matching reference image */}
                  <div className="my-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-100 dark:border-slate-800 flex items-center justify-center min-h-[90px]">
                    {paper.diagramType === 'brain_mri' && (
                      <div className="flex items-center gap-1.5">
                        {/* 3 Brain MRI Scans as in reference image */}
                        <div className="w-16 h-16 rounded-lg bg-black border border-slate-800 flex items-center justify-center overflow-hidden p-1 shadow-inner">
                          <div className="w-12 h-14 rounded-full bg-slate-900 border border-slate-700/60 relative flex items-center justify-center">
                            <div className="w-8 h-10 rounded-full border border-blue-400/40 bg-blue-500/10" />
                            <div className="absolute w-2 h-4 bg-white/30 rounded-full blur-[1px]" />
                          </div>
                        </div>
                        <div className="w-16 h-16 rounded-lg bg-black border border-slate-800 flex items-center justify-center overflow-hidden p-1 shadow-inner">
                          <div className="w-12 h-14 rounded-full bg-slate-900 border border-slate-700/60 relative flex items-center justify-center">
                            <div className="w-9 h-11 rounded-full border border-purple-400/40 bg-purple-500/10" />
                            <div className="absolute w-3 h-4 bg-white/40 rounded-full blur-[1px]" />
                          </div>
                        </div>
                        <div className="w-16 h-16 rounded-lg bg-black border border-slate-800 flex items-center justify-center overflow-hidden p-1 shadow-inner">
                          <div className="w-12 h-14 rounded-full bg-slate-900 border border-slate-700/60 relative flex items-center justify-center">
                            <div className="w-8 h-10 rounded-full border border-teal-400/40 bg-teal-500/10" />
                            <div className="absolute w-2 h-4 bg-white/30 rounded-full blur-[1px]" />
                          </div>
                        </div>
                      </div>
                    )}

                    {paper.diagramType === 'flowchart' && (
                      <div className="flex flex-col items-center gap-1 text-[8px] font-mono text-slate-500 w-full px-2">
                        <div className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          Token Embeddings
                        </div>
                        <div className="w-0.5 h-2 bg-slate-300 dark:bg-slate-700" />
                        <div className="flex items-center gap-1">
                          <div className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            Encoder
                          </div>
                          <div className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Attention
                          </div>
                        </div>
                      </div>
                    )}

                    {paper.diagramType === 'barchart' && (
                      <div className="flex items-end gap-1.5 h-14 px-4 w-full justify-center">
                        <div className="w-2.5 h-6 bg-blue-300 rounded-t" />
                        <div className="w-2.5 h-10 bg-blue-400 rounded-t" />
                        <div className="w-2.5 h-8 bg-blue-300 rounded-t" />
                        <div className="w-2.5 h-12 bg-blue-500 rounded-t" />
                        <div className="w-2.5 h-7 bg-blue-400 rounded-t" />
                        <div className="w-2.5 h-14 bg-indigo-600 rounded-t" />
                      </div>
                    )}

                    {paper.diagramType === 'attention_blocks' && (
                      <div className="flex items-center gap-1.5 text-[8px] font-mono text-slate-500">
                        <div className="p-1 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 text-center">
                          Patch (16x16)
                        </div>
                        <span>➔</span>
                        <div className="p-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 text-center">
                          Multi-Head
                        </div>
                      </div>
                    )}

                    {paper.diagramType === 'rl_loop' && (
                      <div className="flex items-center justify-between text-[8px] font-mono text-slate-500 w-full px-2">
                        <div className="p-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                          Agent
                        </div>
                        <div className="text-[7px] text-slate-400">Action ➔<br />State ⬅</div>
                        <div className="p-1 rounded bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200">
                          Env
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Paper Footer: 1. Introduction & Physical Page Indicator */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                      1. Introduction
                    </div>
                    <div className="space-y-1 pt-1">
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full w-full" />
                      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full w-5/6" />
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{isActive ? 'Click to inspect' : 'Click to bring forward'}</span>
                      <span>Page {index + 1}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination Dots with Glowing Capsule Indicator */}
        <div className="flex items-center justify-center gap-2 mt-4">
          {papers.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`transition-all duration-300 cursor-pointer ${
                i === activeIndex
                  ? 'w-7 h-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-sm shadow-purple-500/50'
                  : 'w-2 h-2 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 rounded-full'
              }`}
            />
          ))}
        </div>

        {/* Interactive Scroll & Navigation Hint */}
        <div className="flex items-center justify-center mt-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-mono bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 backdrop-blur-md shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span>🖱️ Scroll wheel • ↔ Drag • ⌨️ Arrow keys to rotate in 3D</span>
          </div>
        </div>

        {/* Action Bar Below Hero */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#workspace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-600/25 hover:shadow-blue-600/35 hover:-translate-y-0.5 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Upload Research Papers
          </a>
          <a
            href="#chat"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm font-semibold border border-slate-200 dark:border-slate-700 shadow-sm transition hover:-translate-y-0.5 cursor-pointer"
          >
            <Search className="w-4 h-4 text-blue-500" />
            Open Research Assistant
          </a>
        </div>
      </div>
    </section>
  );
}
