import { useState } from 'react';
import { 
  Sparkles, 
  Cpu, 
  Users, 
  BarChart3, 
  Compass, 
  Search, 
  ChevronRight,
  Send,
  CornerDownLeft,
  ChevronDown
} from 'lucide-react';

interface PromptCategory {
  id: string;
  name: string;
  icon: typeof Sparkles;
  color: string;
  badgeBg: string;
  prompts: {
    title: string;
    description: string;
    query: string;
  }[];
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'architecture',
    name: 'Architecture & Methods',
    icon: Cpu,
    color: 'text-blue-500 dark:text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    prompts: [
      {
        title: 'Core Architecture',
        description: 'Multi-head attention & feedforward mechanics',
        query: 'What is the primary architecture proposed in the paper and how do the key layers operate?'
      },
      {
        title: 'Mathematical Formulation',
        description: 'Attention equations and scaling factors',
        query: 'How is the scaled dot-product attention mathematically formulated and what dimensions are used?'
      },
      {
        title: 'Training Hyperparameters',
        description: 'Optimizers, learning rate warmup, dropout',
        query: 'What optimizer, learning rate schedule, and regularization methods were used during training?'
      }
    ]
  },
  {
    id: 'authors',
    name: 'Authors & Metadata',
    icon: Users,
    color: 'text-purple-500 dark:text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    prompts: [
      {
        title: 'Author Bylines & Affiliations',
        description: 'Lead researchers and institutional origin',
        query: 'Who are the primary authors of this paper and which institutions or universities are they from?'
      },
      {
        title: 'Core Contribution Summary',
        description: 'Executive abstract in 3 clear points',
        query: 'Summarize the primary scientific contribution and why this work was groundbreaking in 3 bullet points.'
      }
    ]
  },
  {
    id: 'benchmarks',
    name: 'Benchmarks & Results',
    icon: BarChart3,
    color: 'text-emerald-500 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    prompts: [
      {
        title: 'Quantitative Evaluation',
        description: 'BLEU, accuracy, latency comparisons',
        query: 'What quantitative benchmark results were achieved and how do they compare against existing SOTA baselines?'
      },
      {
        title: 'Datasets & Compute',
        description: 'Training hardware (GPUs/TPUs) & dataset sizes',
        query: 'What datasets were used for training and evaluation, and what computational hardware was required?'
      }
    ]
  },
  {
    id: 'gaps',
    name: 'Gaps & Future Work',
    icon: Compass,
    color: 'text-amber-500 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    prompts: [
      {
        title: 'Limitations & Constraints',
        description: 'Quadratic complexity, memory, context windows',
        query: 'What limitations, trade-offs, or failure modes did the authors identify in their methodology?'
      },
      {
        title: 'Future Research Directions',
        description: 'Open questions and proposed extensions',
        query: 'What future research directions and application domains do the authors suggest for subsequent work?'
      }
    ]
  }
];

interface RecommendedPromptsAsideProps {
  onSelectPrompt: (query: string, autoRun?: boolean) => void;
  disabled?: boolean;
  isStreaming?: boolean;
}

/**
 * Dedicated Aside Deck for Recommended Prompts & Inquiries.
 * Keeps the chat input area spacious and uncluttered while providing
 * quick-access domain research questions.
 */
export function RecommendedPromptsAside({
  onSelectPrompt,
  disabled = false,
  isStreaming = false
}: RecommendedPromptsAsideProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const filteredCategories = PROMPT_CATEGORIES.filter((cat) => {
    if (activeCategory !== 'all' && cat.id !== activeCategory) return false;
    return true;
  }).map((cat) => {
    if (!searchFilter.trim()) return cat;
    const matchingPrompts = cat.prompts.filter(
      (p) =>
        p.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.description.toLowerCase().includes(searchFilter.toLowerCase()) ||
        p.query.toLowerCase().includes(searchFilter.toLowerCase())
    );
    return { ...cat, prompts: matchingPrompts };
  }).filter((cat) => cat.prompts.length > 0);

  return (
    <aside className="w-full lg:w-80 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm h-full max-h-[750px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Research Inquiries
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Curated prompt blueprints
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="lg:hidden p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>

      {!isCollapsed && (
        <>
          {/* Search Box */}
          <div className="pt-3 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter prompts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-2.5 pt-0.5 border-b border-slate-100 dark:border-slate-800/60">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              All
            </button>
            {PROMPT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1 rounded-lg text-[10px] font-medium transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                  activeCategory === cat.id
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{cat.name.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          {/* Prompts List */}
          <div className="flex-1 overflow-y-auto space-y-4 pt-3 pr-1">
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No matching inquiries found.
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.id} className="space-y-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-slate-500 dark:text-slate-400">
                      <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                      <span>{cat.name}</span>
                    </div>

                    <div className="space-y-2">
                      {cat.prompts.map((prompt, idx) => (
                        <div
                          key={idx}
                          className="group p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-400/80 dark:hover:border-blue-500/60 hover:shadow-md transition-all duration-200 text-left space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              {prompt.title}
                            </h4>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => onSelectPrompt(prompt.query, false)}
                                title="Insert into input"
                                disabled={disabled || isStreaming}
                                className="p-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] cursor-pointer"
                              >
                                <CornerDownLeft className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectPrompt(prompt.query, true)}
                                title="Ask immediately"
                                disabled={disabled || isStreaming}
                                className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {prompt.description}
                          </p>

                          <button
                            type="button"
                            onClick={() => onSelectPrompt(prompt.query, true)}
                            disabled={disabled || isStreaming}
                            className="w-full pt-1 flex items-center justify-between text-[10px] font-mono text-blue-600 dark:text-blue-400 group-hover:underline cursor-pointer"
                          >
                            <span>Query this topic</span>
                            <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </aside>
  );
}
