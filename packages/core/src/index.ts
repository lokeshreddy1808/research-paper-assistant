/**
 * Pure business logic package for RAG pipelines.
 * Architectural invariant: This package must NEVER import Express or React.
 */

export * from './ingestion/index.js';
export * from './chunking/index.js';
export * from './embeddings/index.js';
export * from './vectorstore/index.js';
export * from './llm/index.js';
export * from './rag/index.js';

/**
 * Temporary verification function for core package initialization.
 * @returns {string} Verification greeting
 */
export function hello(): string {
  return "Hello from @research-assistant/core!";
}
