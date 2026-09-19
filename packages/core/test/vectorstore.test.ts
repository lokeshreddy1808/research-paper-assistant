import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  extractPdfDocument, 
  chunkDocument,
  generateBatchEmbeddings,
  InMemoryVectorStore,
  DEFAULT_EMBEDDING_DIMENSIONS
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVectorStoreTestSuite() {
  console.log('====================================================');
  console.log('     PHASE 5: IN-MEMORY VECTOR STORE VERIFICATION   ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // Test 1: Store Initialization & Dimension Guardrails
  // ---------------------------------------------------------------
  console.log('[Test 1] Testing vector store initialization & dimensionality guardrails:');
  const store = new InMemoryVectorStore(DEFAULT_EMBEDDING_DIMENSIONS);
  const initialStats = store.getStats();
  console.log(`✓ Initialized store (Dimensions: ${initialStats.dimensions}, Chunks: ${initialStats.totalChunks})`);

  try {
    store.addChunks([{
      id: 'bad-chunk',
      documentId: 'doc-1',
      documentFilename: 'test.pdf',
      pageNumber: 1,
      chunkIndex: 0,
      text: 'Malformed chunk with wrong dimensions',
      characterCount: 38,
      tokenEstimate: 10,
      embedding: [0.1, 0.2, 0.3] // Invalid 3-dim vector
    }]);
    throw new Error('Failed to reject vector with mismatched dimensions!');
  } catch (err) {
    console.log(`✓ Caught expected dimension mismatch error: "${(err as Error).message}"`);
  }

  // ---------------------------------------------------------------
  // Test 2: Ingest, Chunk, Embed & Store First Paper (Attention)
  // ---------------------------------------------------------------
  console.log('\n[Test 2] Ingesting, chunking & embedding Attention_Is_All_You_Need.pdf:');
  const paperPath1 = path.resolve(__dirname, '../../../data/sample_papers/Attention_Is_All_You_Need.pdf');
  const doc1 = await extractPdfDocument(new Uint8Array(fs.readFileSync(paperPath1)), 'Attention_Is_All_You_Need.pdf');
  const chunks1 = chunkDocument(doc1);
  const embedded1 = await generateBatchEmbeddings(chunks1.chunks);

  store.addChunks(embedded1.chunks);
  const statsAfterDoc1 = store.getStats();
  console.log(`✓ Stored Attention paper:`);
  console.log(`  - Total Chunks    : ${statsAfterDoc1.totalChunks}`);
  console.log(`  - Total Documents : ${statsAfterDoc1.totalDocuments}`);
  console.log(`  - Document ID     : ${doc1.id}`);

  if (statsAfterDoc1.totalChunks !== chunks1.totalChunks) {
    throw new Error(`Chunk count mismatch: expected ${chunks1.totalChunks}, got ${statsAfterDoc1.totalChunks}`);
  }

  // ---------------------------------------------------------------
  // Test 3: Multi-Document Indexing (Deep Residual Learning)
  // ---------------------------------------------------------------
  console.log('\n[Test 3] Ingesting second paper: Deep_Residual_Learning.pdf:');
  const paperPath2 = path.resolve(__dirname, '../../../data/sample_papers/Deep_Residual_Learning.pdf');
  const doc2 = await extractPdfDocument(new Uint8Array(fs.readFileSync(paperPath2)), 'Deep_Residual_Learning.pdf');
  const chunks2 = chunkDocument(doc2);
  const embedded2 = await generateBatchEmbeddings(chunks2.chunks);

  store.addChunks(embedded2.chunks);
  const statsAfterDoc2 = store.getStats();
  console.log(`✓ Stored ResNet paper:`);
  console.log(`  - Total Chunks in Store : ${statsAfterDoc2.totalChunks}`);
  console.log(`  - Total Documents       : ${statsAfterDoc2.totalDocuments}`);

  // ---------------------------------------------------------------
  // Test 4: Nearest-Neighbor Search Discrimination Across Papers
  // ---------------------------------------------------------------
  console.log('\n[Test 4] Query Retrieval Discrimination Across Multiple Papers:');

  // Query A (ResNet-specific topic)
  const queryResNet = 'What is the degradation problem when training deeper neural networks?';
  console.log(`\n  Query A (ResNet query): "${queryResNet}"`);
  const startSearchA = Date.now();
  const resultsA = await store.searchByText(queryResNet, 3);
  const durationA = Date.now() - startSearchA;
  console.log(`  ✓ Search executed in ${durationA}ms (Top ${resultsA.length} hits):`);
  resultsA.forEach((hit, idx) => {
    console.log(
      `    #${idx + 1} [Score: ${hit.score.toFixed(4)}] Document: "${hit.chunk.documentFilename}" (Page ${hit.chunk.pageNumber})`
    );
    console.log(`       Excerpt: "${hit.chunk.text.slice(0, 65).replace(/\n/g, ' ')}..."`);
  });

  if (resultsA[0].chunk.documentFilename !== 'Deep_Residual_Learning.pdf') {
    throw new Error(`Search discrimination failed: expected ResNet paper at Rank #1!`);
  }

  // Query B (Transformer-specific topic)
  const queryAttention = 'Why does self-attention compute representations without sequence-aligned RNNs?';
  console.log(`\n  Query B (Transformer query): "${queryAttention}"`);
  const resultsB = await store.searchByText(queryAttention, 3);
  resultsB.forEach((hit, idx) => {
    console.log(
      `    #${idx + 1} [Score: ${hit.score.toFixed(4)}] Document: "${hit.chunk.documentFilename}" (Page ${hit.chunk.pageNumber})`
    );
    console.log(`       Excerpt: "${hit.chunk.text.slice(0, 65).replace(/\n/g, ' ')}..."`);
  });

  if (resultsB[0].chunk.documentFilename !== 'Attention_Is_All_You_Need.pdf') {
    throw new Error(`Search discrimination failed: expected Attention paper at Rank #1!`);
  }

  // ---------------------------------------------------------------
  // Test 5: Metadata Filtering (documentId, pageNumber, minScore)
  // ---------------------------------------------------------------
  console.log('\n[Test 5] Testing Metadata Filters:');

  // Filter 5a: Restrict query to Attention document only
  const filteredDocResults = await store.searchByText(queryResNet, 3, { documentId: doc1.id });
  console.log(`✓ Filter by documentId (${doc1.id}) returned ${filteredDocResults.length} chunks:`);
  filteredDocResults.forEach(hit => {
    if (hit.chunk.documentId !== doc1.id) {
      throw new Error(`Filter violation: chunk documentId ${hit.chunk.documentId} !== ${doc1.id}!`);
    }
  });

  // Filter 5b: Restrict to exact Page 4
  const filteredPageResults = await store.searchByText(
    'What limitations or future work are mentioned?', 
    3, 
    { documentId: doc1.id, pageNumber: 4 }
  );
  console.log(`✓ Filter by exact page (Page 4) returned ${filteredPageResults.length} chunks:`);
  filteredPageResults.forEach(hit => {
    if (hit.chunk.pageNumber !== 4) {
      throw new Error(`Page filter violation: chunk page ${hit.chunk.pageNumber} !== 4!`);
    }
    console.log(`  - Page ${hit.chunk.pageNumber} chunk [Score: ${hit.score.toFixed(4)}]: "${hit.chunk.text.slice(0, 50)}..."`);
  });

  // Filter 5c: Minimum score cutoff
  const highThresholdResults = await store.searchByText(queryAttention, 5, { minScore: 0.60 });
  console.log(`✓ Filter by minScore (>= 0.60) returned ${highThresholdResults.length} chunks (all >= 0.60):`);
  highThresholdResults.forEach(hit => {
    if (hit.score < 0.60) {
      throw new Error(`minScore violation: score ${hit.score} < 0.60!`);
    }
  });

  // ---------------------------------------------------------------
  // Test 6: Document Deletion
  // ---------------------------------------------------------------
  console.log('\n[Test 6] Testing Document Deletion:');
  const deletedCount = store.deleteDocument(doc1.id);
  console.log(`✓ Deleted ${deletedCount} chunks belonging to document ID ${doc1.id}`);
  const statsAfterDelete = store.getStats();
  console.log(`  - Remaining Chunks    : ${statsAfterDelete.totalChunks}`);
  console.log(`  - Remaining Documents : ${statsAfterDelete.totalDocuments}`);

  if (statsAfterDelete.totalDocuments !== 1 || statsAfterDelete.totalChunks !== chunks2.totalChunks) {
    throw new Error(`Deletion verification failed! Store stats unexpected.`);
  }

  // ---------------------------------------------------------------
  // Test 7: Serialization & File Persistence
  // ---------------------------------------------------------------
  console.log('\n[Test 7] Testing JSON Serialization & File Persistence:');
  const tempFilePath = path.resolve(__dirname, 'temp_vector_store.json');
  
  await store.saveToFile(tempFilePath);
  console.log(`✓ Saved vector store to disk (${tempFilePath})`);

  const restoredStore = await InMemoryVectorStore.loadFromFile(tempFilePath);
  const restoredStats = restoredStore.getStats();
  console.log(`✓ Restored vector store from disk:`);
  console.log(`  - Restored Chunks     : ${restoredStats.totalChunks}`);
  console.log(`  - Restored Dimensions : ${restoredStats.dimensions}`);

  if (restoredStats.totalChunks !== store.getStats().totalChunks) {
    throw new Error(`Restored chunk count mismatch!`);
  }

  // Clean up temporary file
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
    console.log(`✓ Cleaned up temporary test file.`);
  }

  console.log('\n====================================================');
  console.log('      ALL PHASE 5 VECTOR STORE CHECKS PASSED        ');
  console.log('====================================================');
}

runVectorStoreTestSuite().catch((err) => {
  console.error('\n❌ Vector Store Test Suite Failed:', err);
  process.exit(1);
});
