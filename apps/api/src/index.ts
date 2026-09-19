import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { logger } from './lib/logger.js';
import { hello } from '@research-assistant/core';
import type { HealthResponse } from '@research-assistant/shared';

const app = express();

app.use(cors());
app.use(express.json());

// Log incoming requests
app.use((req, res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Incoming request');
  next();
});

/**
 * Health check endpoint.
 * Returns server operational status, release version, and process uptime.
 */
app.get('/api/health', (req, res) => {
  const healthData: HealthResponse = {
    ok: true,
    version: '1.0.0',
    uptime: Math.round(process.uptime())
  };
  res.status(200).json(healthData);
});

import { documentRoutes } from './routes/documentRoutes.js';
import { ragRoutes } from './routes/ragRoutes.js';

// Mount route controllers
app.use('/api/documents', documentRoutes);
app.use('/api/rag', ragRoutes);

// Global 404 Handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err, 'Unhandled Express Error');
  res.status(500).json({ ok: false, error: err.message || 'Internal Server Error' });
});

// Start Express server
const server = app.listen(env.PORT, () => {
  logger.info(`🚀 API server active on http://localhost:${env.PORT}`);
  logger.info(`Package core status: ${hello()}`);
});

// Export server
export { app, server };

