import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { extractPdfDocument, validatePdfBuffer } from '@research-assistant/core';
import type { 
  UploadDocumentResponse, 
  DeleteDocumentResponse 
} from '@research-assistant/shared';
import { ragService } from '../services/ragService.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Store uploaded files in memory as Buffers (0 temporary files on disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  }
});

/**
 * POST /api/documents/upload
 * Handles multipart PDF upload, page-by-page extraction, chunking, embedding, and indexing.
 */
router.post(
  '/upload',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ ok: false, error: 'No PDF file attached under field "file".' });
        return;
      }

      const buffer = new Uint8Array(req.file.buffer);
      const filename = req.file.originalname || 'document.pdf';

      // 1. Validate PDF magic bytes and size
      try {
        validatePdfBuffer(buffer);
      } catch (validationErr) {
        res.status(400).json({ ok: false, error: (validationErr as Error).message });
        return;
      }

      logger.info({ filename, size: buffer.length }, 'Processing uploaded PDF');

      // 2. Parse PDF page-by-page
      const parsedDoc = await extractPdfDocument(buffer, filename);

      // 3. Ingest into RAG pipeline (chunk + embed + store)
      const ingestResult = await ragService.getPipeline().ingestDocument(parsedDoc);

      // 4. Register in active service registry
      const summary = ragService.registerDocument(parsedDoc, ingestResult.totalChunks);

      const response: UploadDocumentResponse = {
        ok: true,
        document: summary,
        message: `Successfully ingested ${summary.totalPages} pages into ${summary.totalChunks} semantic chunks.`
      };

      res.status(201).json(response);
    } catch (err) {
      logger.error(err, 'Failed to process document upload');
      res.status(500).json({
        ok: false,
        error: (err as Error).message || 'Failed to parse and ingest document'
      });
    }
  }
);

/**
 * GET /api/documents
 * Lists all indexed documents with summary statistics.
 */
router.get('/', (_req: Request, res: Response): void => {
  const documents = ragService.listDocuments();
  res.status(200).json({ ok: true, documents });
});

// Sample benchmark papers definition
const SAMPLE_BENCHMARKS = [
  {
    id: 'sample-attention',
    filename: 'Attention_Is_All_You_Need.pdf',
    title: 'Attention Is All You Need',
    authors: 'Vaswani et al. (NeurIPS 2017)',
    description: 'Seminal paper introducing the Transformer architecture, replacing recurrent layers entirely with multi-head self-attention mechanisms.',
    pages: 4,
    sizeKb: 5.2
  },
  {
    id: 'sample-resnet',
    filename: 'Deep_Residual_Learning.pdf',
    title: 'Deep Residual Learning for Image Recognition',
    authors: 'He et al. (CVPR 2016)',
    description: 'Groundbreaking residual learning framework (ResNet) enabling training of substantially deeper neural networks via identity skip connections.',
    pages: 4,
    sizeKb: 4.9
  }
];

const resolveSamplePath = (filename: string): string => {
  const candidates = [
    path.resolve(process.cwd(), 'data/sample_papers', filename),
    path.resolve(process.cwd(), '../../data/sample_papers', filename),
    path.resolve(__dirname, '../../../../data/sample_papers', filename),
    path.resolve(__dirname, '../../../data/sample_papers', filename)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
};

/**
 * GET /api/documents/samples
 * Returns available benchmark sample papers and indicates if they are currently loaded.
 */
router.get('/samples', (_req: Request, res: Response): void => {
  const loadedDocs = ragService.listDocuments();
  const samples = SAMPLE_BENCHMARKS.map(sample => {
    const loadedDoc = loadedDocs.find(d => d.filename === sample.filename);
    return {
      ...sample,
      isLoaded: Boolean(loadedDoc),
      loadedDocId: loadedDoc?.id
    };
  });
  res.status(200).json({ ok: true, samples });
});

/**
 * POST /api/documents/samples/load
 * Loads a specified sample benchmark paper on demand without cluttering the main library unwantedly.
 */
router.post('/samples/load', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filename } = req.body as { filename?: string };
    const targetFilename = filename || 'Attention_Is_All_You_Need.pdf';
    const sampleDef = SAMPLE_BENCHMARKS.find(s => s.filename === targetFilename);

    if (!sampleDef) {
      res.status(404).json({ ok: false, error: `Unknown sample paper: ${targetFilename}` });
      return;
    }

    // Check if already loaded
    const existing = ragService.listDocuments().find(d => d.filename === sampleDef.filename);
    if (existing) {
      res.status(200).json({
        ok: true,
        document: existing,
        message: `Sample paper "${sampleDef.title}" is already loaded.`
      });
      return;
    }

    const filePath = resolveSamplePath(sampleDef.filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ ok: false, error: `Sample paper file not found on disk at: ${filePath}` });
      return;
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const uint8 = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
    const parsedDoc = await extractPdfDocument(uint8, sampleDef.filename);
    const ingestResult = await ragService.getPipeline().ingestDocument(parsedDoc);
    const summary = ragService.registerDocument(parsedDoc, ingestResult.totalChunks);

    logger.info({ filename: sampleDef.filename, chunks: ingestResult.totalChunks }, 'Sample paper loaded on demand');

    res.status(201).json({
      ok: true,
      document: summary,
      message: `Successfully loaded sample benchmark "${sampleDef.title}".`
    });
  } catch (err) {
    logger.error(err, 'Failed to load sample paper');
    res.status(500).json({
      ok: false,
      error: (err as Error).message || 'Failed to load sample paper'
    });
  }
});

/**
 * GET /api/documents/:id
 * Retrieves full document details and extracted page texts.
 */
router.get('/:id', (req: Request, res: Response): void => {
  const docId = String(req.params.id);
  const document = ragService.getDocument(docId);
  if (!document) {
    res.status(404).json({ ok: false, error: `Document with ID "${docId}" not found.` });
    return;
  }
  res.status(200).json({ ok: true, document });
});

/**
 * DELETE /api/documents/:id
 * Removes a document and all its indexed vector chunks.
 */
router.delete('/:id', (req: Request, res: Response): void => {
  const docId = String(req.params.id);
  const result = ragService.deleteDocument(docId);
  if (!result.deleted) {
    res.status(404).json({ ok: false, error: `Document with ID "${docId}" not found.` });
    return;
  }

  const response: DeleteDocumentResponse = {
    ok: true,
    documentId: docId,
    deletedChunks: result.deletedChunks
  };
  res.status(200).json(response);
});

export { router as documentRoutes };
