import { config } from 'dotenv';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve directory to support root .env or local .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

config({ path: path.resolve(__dirname, '../.env') });
config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Optional for future phases, but schema validates shape if provided
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  VECTOR_DB_PATH: z.string().default('./data/vectors'),
  UPLOAD_DIR: z.string().default('./data/uploads')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingFields = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
  );
  const errorMessage = [
    '❌ Environment configuration validation failed!',
    'Missing or invalid environment variables:',
    ...missingFields,
    '',
    'Please inspect your .env file or copy from .env.example.'
  ].join('\n');

  console.error(errorMessage);
  throw new Error(errorMessage);
}

/**
 * Validated, strictly-typed runtime environment configuration.
 */
export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
