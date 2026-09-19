import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Sparkles, ArrowDown } from "lucide-react";

interface YouCanScrollProps {
  onActionClick?: (target: "chat" | "workspace" | "telemetry" | "key") => void;
}

const WORDS = [
  "query.",
  "synthesize.",
  "extract.",
  "cite.",
  "verify.",
  "reason.",
  "explore.",
  "benchmark.",
  "compare.",
  "ingest.",
  "chunk.",
  "embed.",
  "discover.",
  "analyze.",
  "accelerate.",
  "ground.",
  "deconstruct.",
  "unify.",
  "trace.",
  "stream.",
  "scale.",
  "master your research.",
];

/**
 * 21st.dev "You Can Scroll" component by @jh3yy – faithfully adapted for
 * PaperMind Research Assistant.
 *
 * GSAP ScrollTrigger drives:
 *   • A dimmer timeline that fades sibling words so only the current word
 *     is fully lit.
 *   • A hue timeline that scrubs an OKLCH --hue CSS variable through the
 *     colour spectrum as the user scrolls.
 *   • Chroma entry/exit tweens so colour saturates in and out smoothly.
 */
export function YouCanScroll({ onActionClick }: YouCanScrollProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    const list = listRef.current;
    if (!section || !list) return;

    // Collect <li> elements
    const items = gsap.utils.toArray<HTMLElement>(list.querySelectorAll("li"));

    // Set initial state: first item full, rest dim
    gsap.set(items, { opacity: (i) => (i !== 0 ? 0.15 : 1) });

    // ----- Dimmer: walk brightness across items as scroll progresses -----
    const dimmer = gsap
      .timeline()
      .to(items.slice(1), { opacity: 1, stagger: 0.5 })
      .to(items.slice(0, items.length - 1), { opacity: 0.15, stagger: 0.5 }, 0);

    const dimmerScrub = ScrollTrigger.create({
      trigger: items[0],
      endTrigger: items[items.length - 1],
      start: "center center+=80",
      end: "center center-=80",
      animation: dimmer,
      scrub: 0.25,
    });

    // ----- Hue: OKLCH --hue scrubs from blue (220) to pink (340) -----
    const hueScroller = gsap.timeline().fromTo(
      section,
      { "--hue": "220" },
      { "--hue": "340", ease: "none" }
    );

    const hueScrub = ScrollTrigger.create({
      trigger: items[0],
      endTrigger: items[items.length - 1],
      start: "center center+=80",
      end: "center center-=80",
      animation: hueScroller,
      scrub: 0.25,
    });

    // ----- Chroma: saturate in at top, desaturate out at bottom -----
    const chromaIn = gsap.fromTo(
      section,
      { "--chroma": "0" },
      {
        "--chroma": "0.28",
        ease: "none",
        scrollTrigger: {
          scrub: 0.25,
          trigger: items[0],
          start: "center center+=140",
          end: "center center",
        },
      }
    );

    const chromaOut = gsap.fromTo(
      section,
      { "--chroma": "0.28" },
      {
        "--chroma": "0",
        ease: "none",
        scrollTrigger: {
          scrub: 0.25,
          trigger: items[items.length - 2] ?? items[items.length - 1],
          start: "center center",
          end: "center center-=140",
        },
      }
    );

    return () => {
      dimmerScrub.kill();
      hueScrub.kill();
      chromaIn.scrollTrigger?.kill();
      chromaOut.scrollTrigger?.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="you-can-scroll"
      className="relative w-full bg-[#050510] text-white overflow-hidden rounded-3xl my-10"
      style={
        {
          "--hue": "220",
          "--chroma": "0",
          "--lightness": "70%",
        } as React.CSSProperties
      }
    >
      {/* ── decorative glows ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full bg-blue-900/30 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] rounded-full bg-purple-900/20 blur-[100px]" />
      </div>

      {/* ── header strip ── */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-10 pb-6 border-b border-white/5 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-violet-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/50 font-mono">
              PaperMind · Research Engine
            </p>
            <p className="text-xs text-white/30 font-mono">
              Scroll to discover what you can do
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-white/30 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <ArrowDown className="w-3.5 h-3.5 animate-bounce text-blue-400" />
          Scroll to scrub
        </div>
      </div>

      {/* ── main two-column area ── */}
      <div className="relative z-10 flex flex-col md:flex-row items-start gap-10 px-8 py-16">
        {/* Left sticky column */}
        <div className="md:sticky md:top-28 shrink-0 max-w-xs space-y-6">
          <h2 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05] text-white">
            with this
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-300 to-pink-400 bg-clip-text text-transparent">
              assistant.
            </span>
          </h2>

          <p className="text-sm text-white/50 leading-relaxed">
            A specialized academic intelligence engine that eliminates hallucinations
            with 1-indexed physical PDF page citations and 384-d vector retrieval.
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onActionClick?.("chat")}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all duration-200 cursor-pointer"
            >
              Start Querying ➔
            </button>
            <button
              type="button"
              onClick={() => onActionClick?.("workspace")}
              className="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium border border-white/10 transition-all duration-200 cursor-pointer"
            >
              Upload PDF
            </button>
          </div>
        </div>

        {/* Right kinetic word list */}
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-white/20 tracking-tight font-mono mb-6">
            you can —
          </p>

          <ul
            ref={listRef}
            aria-hidden="true"
            className="list-none p-0 m-0 space-y-3 sm:space-y-4"
          >
            {WORDS.map((word, i) => (
              <li
                key={i}
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold leading-tight tracking-tight transition-opacity duration-100 cursor-default select-none"
                style={
                  {
                    color: `oklch(var(--lightness) var(--chroma) calc(var(--hue) + ${i * 7}deg))`,
                  } as React.CSSProperties
                }
              >
                {word}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── footer ── */}
      <div className="relative z-10 px-8 pb-10 pt-4 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/25 flex-wrap gap-2">
        <span>⚡ 384-dimensional dense vectors · BAAI/bge-small-en-v1.5 · Local ONNX inference</span>
        <span>PaperMind Academic Intelligence © 2026</span>
      </div>
    </section>
  );
}

export default YouCanScroll;
