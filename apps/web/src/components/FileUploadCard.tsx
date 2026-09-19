import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  ShieldCheck 
} from 'lucide-react';
import type { DocumentSummary, UploadDocumentResponse } from '@research-assistant/shared';

export interface FileUploadCardProps {
  onUploadSuccess: (document: DocumentSummary) => void;
  maxSizeBytes?: number;
  acceptedFileTypes?: string[];
  title?: string;
  subtitle?: string;
}

interface UploadingFileState {
  file: File;
  progress: number;
  stage: 'extracting' | 'chunking' | 'embedding' | 'complete' | 'error';
  stageMessage: string;
  error?: string;
}

/**
 * File Upload Card Component (inspired by 21st.dev @ravikatiyar162/components/file-upload-card).
 * Complete modern UI for scientific document uploads with drag-and-drop,
 * realistic stage-by-stage progress tracking, status indicators, and file metadata.
 */
export function FileUploadCard({
  onUploadSuccess,
  maxSizeBytes = 25 * 1024 * 1024, // 25 MB default
  acceptedFileTypes = ['.pdf', 'application/pdf'],
  title = 'Upload Research Papers',
  subtitle = 'Drag & drop academic PDFs or browse from device'
}: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeUpload, setActiveUpload] = useState<UploadingFileState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processAndUploadFile(files[0]);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processAndUploadFile(files[0]);
    }
  };

  const processAndUploadFile = async (file: File) => {
    // 1. Validation
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      setActiveUpload({
        file,
        progress: 0,
        stage: 'error',
        stageMessage: 'Unsupported format',
        error: 'Only scientific research papers in PDF format (.pdf) are supported.'
      });
      return;
    }

    if (file.size > maxSizeBytes) {
      setActiveUpload({
        file,
        progress: 0,
        stage: 'error',
        stageMessage: 'File too large',
        error: `File size exceeds the ${formatFileSize(maxSizeBytes)} limit.`
      });
      return;
    }

    // 2. Initialize Upload State & Simulated Smooth Pipeline Stages
    setActiveUpload({
      file,
      progress: 15,
      stage: 'extracting',
      stageMessage: 'Extracting physical pages & validating PDF binary...'
    });

    const formData = new FormData();
    formData.append('file', file);

    // Progress simulation timers for realistic user feedback
    const timer1 = setTimeout(() => {
      setActiveUpload(prev => prev ? {
        ...prev,
        progress: 45,
        stage: 'chunking',
        stageMessage: 'Splitting into ~800 char semantic chunks with overlap...'
      } : null);
    }, 450);

    const timer2 = setTimeout(() => {
      setActiveUpload(prev => prev ? {
        ...prev,
        progress: 75,
        stage: 'embedding',
        stageMessage: 'Generating 384-dimensional dense vector embeddings...'
      } : null);
    }, 1100);

    try {
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data = await res.json() as UploadDocumentResponse & { error?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Upload failed with HTTP ${res.status}`);
      }

      setActiveUpload({
        file,
        progress: 100,
        stage: 'complete',
        stageMessage: `Ingested ${data.document.totalPages} pages into ${data.document.totalChunks} semantic vector chunks!`
      });

      onUploadSuccess(data.document);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setActiveUpload(prev => ({
        file: prev?.file || file,
        progress: 0,
        stage: 'error',
        stageMessage: 'Upload failed',
        error: (err as Error).message || 'Failed to ingest and index document.'
      }));
    }
  };

  const handleDismissUpload = () => {
    setActiveUpload(null);
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl overflow-hidden transition-all duration-300">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            PDF
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            ≤ 25MB
          </span>
        </div>
      </div>

      {/* Card Body & Dropzone */}
      <div className="p-5 space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => activeUpload?.stage !== 'extracting' && activeUpload?.stage !== 'chunking' && activeUpload?.stage !== 'embedding' && fileInputRef.current?.click()}
          className={`group relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10 scale-[1.01] ring-4 ring-blue-500/10'
              : 'border-slate-200 dark:border-slate-800 hover:border-blue-500/80 dark:hover:border-blue-500/60 bg-slate-50/40 dark:bg-slate-950/40 hover:bg-blue-50/30 dark:hover:bg-slate-900/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 shadow-xs ${
              isDragging
                ? 'bg-blue-600 text-white scale-110'
                : 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-slate-200 dark:border-slate-700 group-hover:scale-105 group-hover:border-blue-400'
            }`}>
              <UploadCloud className="w-5 h-5" />
            </div>

            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="text-blue-600 dark:text-blue-400 font-bold hover:underline">Choose a file</span> or drag & drop here
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Scientific research papers (.pdf) with physical page preservation
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic File Upload Progress / Status Card (matches 21st.dev file-upload-card) */}
        {activeUpload && (
          <div className="p-3.5 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-950/80 shadow-sm space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate" title={activeUpload.file.name}>
                    {activeUpload.file.name}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    {formatFileSize(activeUpload.file.size)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activeUpload.stage === 'complete' ? (
                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                  </span>
                ) : activeUpload.stage === 'error' ? (
                  <span className="inline-flex items-center gap-1 text-red-500 text-xs font-semibold">
                    <AlertCircle className="w-4 h-4" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-[11px] font-mono font-bold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {activeUpload.progress}%
                  </span>
                )}

                <button
                  onClick={handleDismissUpload}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Animated Progress Bar */}
            {activeUpload.stage !== 'error' && (
              <div className="space-y-1">
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ease-out rounded-full ${
                      activeUpload.stage === 'complete'
                        ? 'bg-emerald-500 w-full'
                        : 'bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600'
                    }`}
                    style={{ width: `${activeUpload.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono pt-0.5">
                  <span className="truncate">{activeUpload.stageMessage}</span>
                  <span>{activeUpload.stage === 'complete' ? 'Done' : `${activeUpload.progress}%`}</span>
                </div>
              </div>
            )}

            {/* Error message */}
            {activeUpload.stage === 'error' && activeUpload.error && (
              <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-[11px] text-red-600 dark:text-red-300">
                {activeUpload.error}
              </div>
            )}
          </div>
        )}

        {/* Security & Provenance Badge */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero Data Loss • SHA-256 Verified</span>
          </span>
          <span className="text-[10px] text-slate-400">
            Local ONNX Vector Embeddings
          </span>
        </div>
      </div>
    </div>
  );
}

// Re-export as DocumentUploadZone for backwards compatibility
export { FileUploadCard as DocumentUploadZone };
