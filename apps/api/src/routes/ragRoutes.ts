import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { QueryResponse } from '@research-assistant/shared';
import { ragService } from '../services/ragService.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Strict Zod schema for query requests
const querySchema = z.object({
  question: z.string().trim().min(2, 'Question must be at least 2 characters long'),
  documentId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  topK: z.coerce.number().int().min(1).max(20).optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
  model: z.string().optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  apiKey: z.string().optional()
});

/**
 * POST /api/rag/query
 * Executes full non-streaming RAG synthesis and returns verified citations.
 */
router.post('/query', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = querySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        error: parseResult.error.issues.map(i => i.message).join(', ')
      });
      return;
    }

    const { question, documentId, documentIds, topK, minScore, model, temperature, apiKey } = parseResult.data;
    const resolvedApiKey = apiKey || (req.headers['x-groq-api-key'] as string | undefined);

    logger.info({ question, documentId, documentIds, topK, hasCustomKey: Boolean(resolvedApiKey) }, 'Executing RAG query');

    const result = await ragService.getPipeline().query(question, {
      documentId,
      documentIds,
      topK,
      minScore,
      model,
      temperature,
      apiKey: resolvedApiKey
    });

    const response: QueryResponse = {
      ok: true,
      result
    };

    res.status(200).json(response);
  } catch (err) {
    logger.error(err, 'RAG query failed');
    res.status(500).json({
      ok: false,
      error: (err as Error).message || 'Failed to process RAG query'
    });
  }
});

/**
 * POST /api/rag/stream
 * Server-Sent Events (SSE) streaming endpoint delivering tokens in real time.
 */
router.post('/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const parseResult = querySchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        ok: false,
        error: parseResult.error.issues.map(i => i.message).join(', ')
      });
      return;
    }

    const { question, documentId, documentIds, topK, minScore, model, temperature, apiKey } = parseResult.data;
    const resolvedApiKey = apiKey || (req.headers['x-groq-api-key'] as string | undefined);

    logger.info({ question, documentId, documentIds, hasCustomKey: Boolean(resolvedApiKey) }, 'Starting streaming RAG query');

    // Configure Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering
    res.flushHeaders();

    let isClosed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        isClosed = true;
      }
    });

    const result = await ragService.getPipeline().streamQuery(
      question,
      (token: string) => {
        if (!isClosed && res.writable) {
          res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
        }
      },
      {
        documentId,
        documentIds,
        topK,
        minScore,
        model,
        temperature,
        apiKey: resolvedApiKey
      }
    );

    if (res.writable && !res.writableEnded) {
      // Send final completion with citations and metadata
      res.write(`data: ${JSON.stringify({ type: 'done', result })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    logger.error(err, 'Streaming RAG query failed');
    if (!res.headersSent) {
      res.status(500).json({
        ok: false,
        error: (err as Error).message || 'Streaming failed'
      });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (err as Error).message })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/rag/stats
 * Returns operational statistics for the active vector store.
 */
router.get('/stats', (_req: Request, res: Response): void => {
  const stats = ragService.getStats();
  res.status(200).json({ ok: true, stats });
});

export { router as ragRoutes };
