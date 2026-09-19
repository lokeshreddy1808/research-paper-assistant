import { useState, useEffect } from 'react';
import { Database, Layers, FileText, Cpu, RefreshCw } from 'lucide-react';
import type { VectorStoreStats } from '@research-assistant/shared';

interface VectorStoreStatsCardProps {
  refreshTrigger?: number;
}

/**
 * Real-time Telemetry Card displaying active in-memory Vector Database metrics.
 */
export function VectorStoreStatsCard({ refreshTrigger }: VectorStoreStatsCardProps) {
  const [stats, setStats] = useState<VectorStoreStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rag/stats');
      if (res.ok) {
        const data = await res.json() as { ok: boolean; stats: VectorStoreStats };
        setStats(data.stats);
      }
    } catch {
      // Ignore background stats fetch errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [refreshTrigger]);

  return (
    <div className="p-4 bg-white/90 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-slate-900 dark:text-white">In-Memory Vector Store</h4>
            <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">Exact k-NN • Sub-millisecond scan</p>
          </div>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          title="Refresh Vector Store Stats"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
        <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Layers className="w-3 h-3 text-purple-500 dark:text-purple-400" /> Chunks
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            {stats ? stats.totalChunks : '0'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <FileText className="w-3 h-3 text-blue-500 dark:text-blue-400" /> Papers
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
            {stats ? stats.totalDocuments : '0'}
          </div>
        </div>

        <div className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <div className="text-[10px] text-slate-500 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-emerald-500 dark:text-emerald-400" /> Dims
          </div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats ? stats.dimensions : 384}
          </div>
        </div>
      </div>
    </div>
  );
}
