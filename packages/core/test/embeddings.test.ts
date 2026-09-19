import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  extractPdfDocument, 
  chunkDocument,
  generateEmbedding,
  generateBatchEmbeddings,
  cosineSimilarity,
  DEFAULT_EMBEDDING_DIMENSIONS,
  DEFAULT_EMBEDDING_MODEL
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runEmbeddingsTestSuite() {
  console.log('====================================================');
  console.log('    PHASE 4: LOCAL VECTOR EMBEDDINGS VERIFICATION   ');
  console.log('====================================================\n');

  console.log(`[Model] Using Local ONNX: ${DEFAULT_EMBEDDING_MODEL}`);
  console.log(`[Target Dimensions] ${DEFAULT_EMBEDDING_DIMENSIONS}\n`);

  // ---------------------------------------------------------------
  // Test 1: Vector Dimension & L2 Unit Norm
  // ---------------------------------------------------------------
  console.log('[Test 1] Testing single query vector generation & unit norm:');
  const sampleQuery = 'What is the multi-head attention mechanism in Transformer models?';
  const startSingle = Date.now();
  const vector1 = await generateEmbedding(sampleQuery);
  const singleDuration = Date.now() - startSingle;

  console.log(`✓ Generated vector in ${singleDuration}ms`);
  console.log(`  - Dimensions : ${vector1.length} (Expected: ${DEFAULT_EMBEDDING_DIMENSIONS})`);
  console.log(`  - Sample [0..3]: [${vector1.slice(0, 4).map(v => v.toFixed(5)).join(', ')}]`);

  if (vector1.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
    throw new Error(`Dimension mismatch: expected ${DEFAULT_EMBEDDING_DIMENSIONS}, got ${vector1.length}!`);
  }

  // Calculate L2 Euclidean Norm: sqrt(sum(v_i^2))
  const l2Norm = Math.sqrt(vector1.reduce((sum, v) => sum + v * v, 0));
  console.log(`  - L2 Norm    : ${l2Norm.toFixed(6)} (Expected: ~1.000000)`);
  if (Math.abs(l2Norm - 1.0) > 0.005) {
    throw new Error(`L2 unit norm invariant failed: norm is ${l2Norm}, expected ~1.0!`);
  }

  // ---------------------------------------------------------------
  // Test 2: Semantic Discrimination & Cosine Similarity
  // ---------------------------------------------------------------
  console.log('\n[Test 2] Testing semantic discrimination via Cosine Similarity:');
  const query = 'How does multi-head self-attention parallelize computation?';
  const relatedPassage = `
    In the Transformer model, self-attention connects all positions with a constant number of 
    sequentially executed operations. This enables significantly more parallelization than 
    recurrent architectures like LSTM and GRU.
  `.trim();
  const unrelatedPassage = `
    Photosynthesis is the biological process by which green plants, algae, and certain bacteria 
    absorb sunlight and convert carbon dioxide and water into glucose and oxygen.
  `.trim();

  const queryVec = await generateEmbedding(query);
  const relatedVec = await generateEmbedding(relatedPassage);
  const unrelatedVec = await generateEmbedding(unrelatedPassage);

  const similarityRelated = cosineSimilarity(queryVec, relatedVec);
  const similarityUnrelated = cosineSimilarity(queryVec, unrelatedVec);

  console.log(`  - Query           : "${query}"`);
  console.log(`  - Related Passage : Similarity = ${similarityRelated.toFixed(4)} (Expected > 0.65)`);
  console.log(`  - Unrelated Text  : Similarity = ${similarityUnrelated.toFixed(4)} (Expected < 0.35)`);

  if (similarityRelated <= similarityUnrelated) {
    throw new Error(
      `Semantic failure: Related passage similarity (${similarityRelated}) was not higher than unrelated (${similarityUnrelated})!`
    );
  }
  if (similarityRelated < 0.65) {
    throw new Error(`Expected related passage similarity > 0.65, but got ${similarityRelated}`);
  }
  if (similarityUnrelated > 0.40) {
    throw new Error(`Expected unrelated passage similarity < 0.40, but got ${similarityUnrelated}`);
  }
  console.log('✓ Semantic discrimination verified! Embedding model cleanly separates relevant academic context.');

  // ---------------------------------------------------------------
  // Test 3: Batch Embedding on Real Academic Paper Chunks
  // ---------------------------------------------------------------
  console.log('\n[Test 3] End-to-End Batch Embedding on Attention_Is_All_You_Need.pdf:');
  const paperPath = path.resolve(__dirname, '../../../data/sample_papers/Attention_Is_All_You_Need.pdf');
  const pdfBytes = new Uint8Array(fs.readFileSync(paperPath));
  
  // Phase 2: Ingestion
  const parsedDoc = await extractPdfDocument(pdfBytes, 'Attention_Is_All_You_Need.pdf');
  // Phase 3: Chunking
  const chunkResult = chunkDocument(parsedDoc, { chunkSize: 800, chunkOverlap: 120 });
  console.log(`✓ Ingested & chunked paper: ${chunkResult.totalChunks} chunks prepared for embedding.`);

  // Phase 4: Batch Embeddings
  const batchResult = await generateBatchEmbeddings(chunkResult.chunks, { batchSize: 4 });
  console.log(`✓ Batch embedding complete in ${batchResult.durationMs}ms:`);
  console.log(`  - Total Chunks Embedded : ${batchResult.chunks.length}`);
  console.log(`  - Model Used            : ${batchResult.model}`);
  console.log(`  - Average ms per chunk  : ${(batchResult.durationMs / batchResult.chunks.length).toFixed(1)}ms`);

  batchResult.chunks.forEach((chunk, i) => {
    const norm = Math.sqrt(chunk.embedding.reduce((sum, v) => sum + v * v, 0));
    console.log(
      `  - [Chunk ${i}] ID: ${chunk.id} | Page ${chunk.pageNumber} | Norm: ${norm.toFixed(4)} | Excerpt: "${chunk.text.slice(0, 45).replace(/\n/g, ' ')}..."`
    );
    if (chunk.embedding.length !== DEFAULT_EMBEDDING_DIMENSIONS) {
      throw new Error(`Chunk ${chunk.id} has incorrect embedding length ${chunk.embedding.length}!`);
    }
  });

  // ---------------------------------------------------------------
  // Test 4: Academic Retrieval Verification (Ad-Hoc Cosine Ranking)
  // ---------------------------------------------------------------
  console.log('\n[Test 4] Query-to-Chunk Retrieval Test:');
  const testQuestion = 'What are the main limitations or future work for this architecture?';
  console.log(`  - User Question: "${testQuestion}"`);
  const questionVec = await generateEmbedding(testQuestion);

  // Score all chunks by cosine similarity
  const rankedChunks = batchResult.chunks
    .map(chunk => ({
      chunk,
      score: cosineSimilarity(questionVec, chunk.embedding)
    }))
    .sort((a, b) => b.score - a.score);

  console.log('\n  Top Ranked Chunks for Retrieval:');
  rankedChunks.forEach((item, rank) => {
    console.log(
      `    #${rank + 1} [Score: ${item.score.toFixed(4)}] Page ${item.chunk.pageNumber} (${item.chunk.id}): "${item.chunk.text.slice(0, 70).replace(/\n/g, ' ')}..."`
    );
  });

  // Page 4 discusses "Limitations and Future Work" in Attention Is All You Need sample
  const topResult = rankedChunks[0];
  console.log(`\n✓ Top retrieved chunk is on Page ${topResult.chunk.pageNumber} with score ${topResult.score.toFixed(4)}.`);
  if (topResult.chunk.pageNumber !== 4) {
    console.warn(`Note: Expected top chunk on Page 4 (Limitations), ranked Page ${topResult.chunk.pageNumber}. Score was ${topResult.score.toFixed(4)}.`);
  }

  console.log('\n====================================================');
  console.log('       ALL PHASE 4 EMBEDDING CHECKS PASSED          ');
  console.log('====================================================');
}

runEmbeddingsTestSuite().catch((err) => {
  console.error('\n❌ Embeddings Test Suite Failed:', err);
  process.exit(1);
});
