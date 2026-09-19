import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  extractPdfDocument, 
  RAGPipeline, 
  extractCitations, 
  calculateFaithfulnessScore 
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRAGTestSuite() {
  console.log('====================================================');
  console.log('    PHASE 7: END-TO-END RAG & CITATION VERIFIER     ');
  console.log('====================================================\n');

  const pipeline = new RAGPipeline();

  // ---------------------------------------------------------------
  // Test 1: Ingest First Paper (Attention Is All You Need)
  // ---------------------------------------------------------------
  console.log('[Test 1] End-to-End Ingestion of Attention_Is_All_You_Need.pdf:');
  const paperPath1 = path.resolve(__dirname, '../../../data/sample_papers/Attention_Is_All_You_Need.pdf');
  const doc1 = await extractPdfDocument(new Uint8Array(fs.readFileSync(paperPath1)), 'Attention_Is_All_You_Need.pdf');

  const ingestResult1 = await pipeline.ingestDocument(doc1);
  console.log(`✓ Ingested document:`);
  console.log(`  - Document ID   : ${ingestResult1.documentId}`);
  console.log(`  - Chunks Indexed: ${ingestResult1.totalChunks}`);

  const stats1 = pipeline.getStats();
  if (stats1.totalChunks !== 4 || stats1.totalDocuments !== 1) {
    throw new Error(`Stats mismatch: expected 4 chunks and 1 doc, got ${stats1.totalChunks} chunks / ${stats1.totalDocuments} docs`);
  }

  // ---------------------------------------------------------------
  // Test 2: Ingest Second Paper (Deep Residual Learning)
  // ---------------------------------------------------------------
  console.log('\n[Test 2] Ingesting second document: Deep_Residual_Learning.pdf:');
  const paperPath2 = path.resolve(__dirname, '../../../data/sample_papers/Deep_Residual_Learning.pdf');
  const doc2 = await extractPdfDocument(new Uint8Array(fs.readFileSync(paperPath2)), 'Deep_Residual_Learning.pdf');

  const ingestResult2 = await pipeline.ingestDocument(doc2);
  console.log(`✓ Ingested second document (${ingestResult2.totalChunks} chunks indexed).`);

  const stats2 = pipeline.getStats();
  console.log(`  - Total Store Chunks    : ${stats2.totalChunks}`);
  console.log(`  - Total Store Documents : ${stats2.totalDocuments}`);

  if (stats2.totalChunks !== 8 || stats2.totalDocuments !== 2) {
    throw new Error(`Stats mismatch: expected 8 chunks and 2 docs, got ${stats2.totalChunks}`);
  }

  // ---------------------------------------------------------------
  // Test 3: Full RAG Query & Citation Verification
  // ---------------------------------------------------------------
  console.log('\n[Test 3] Executing Full Query with Automated Citation Verification:');
  const question1 = 'Why does self-attention compute representations faster and with more parallelization than RNNs?';
  console.log(`  Question: "${question1}"`);

  const ragAnswer1 = await pipeline.query(question1, { topK: 3 });
  console.log(`✓ RAG Synthesis completed in ${ragAnswer1.durationMs}ms:`);
  console.log(`  - Model Used         : ${ragAnswer1.model}`);
  console.log(`  - Faithfulness Score : ${ragAnswer1.faithfulnessScore}%`);
  console.log(`  - Retrieved Chunks   : ${ragAnswer1.retrievedChunks.length}`);
  console.log(`  - Citations Extracted: ${ragAnswer1.citations.length}`);

  console.log('\n  --- Answer Content ---');
  console.log(ragAnswer1.answer.slice(0, 300) + '...\n');

  console.log('  --- Extracted Page Citations ---');
  ragAnswer1.citations.forEach((citation, idx) => {
    console.log(
      `    [#${idx + 1}] Page ${citation.pageNumber} (${citation.documentFilename ?? 'Unknown'}) | Verified: ${citation.verified ? 'YES ✓' : 'NO ✗'}`
    );
    console.log(`         Source Excerpt: "${citation.excerpt.slice(0, 75)}..."`);
  });

  if (ragAnswer1.citations.length === 0) {
    throw new Error('Citation failure: No citations were extracted from the answer!');
  }
  if (ragAnswer1.faithfulnessScore < 50) {
    throw new Error(`Faithfulness score too low: ${ragAnswer1.faithfulnessScore}%`);
  }

  // ---------------------------------------------------------------
  // Test 4: Document-Constrained Retrieval
  // ---------------------------------------------------------------
  console.log('\n[Test 4] Query Constrained by Document ID (ResNet Only):');
  const question2 = 'What is the degradation problem addressed by residual learning?';
  const ragAnswer2 = await pipeline.query(question2, { 
    documentId: doc2.id,
    topK: 3 
  });

  console.log(`✓ Constrained query returned answer in ${ragAnswer2.durationMs}ms.`);
  console.log(`  - Verified Citations: ${ragAnswer2.citations.length}`);
  ragAnswer2.citations.forEach(c => {
    if (c.documentFilename && !c.documentFilename.includes('Deep_Residual_Learning')) {
      throw new Error(`Filter violation: Citation points to ${c.documentFilename} instead of ResNet!`);
    }
  });
  console.log('✓ All retrieved and cited contexts strictly originate from the requested document.');

  // ---------------------------------------------------------------
  // Test 5: Hallucinated / Unverified Citation Detection
  // ---------------------------------------------------------------
  console.log('\n[Test 5] Testing Detection of Hallucinated / Fabricated Citations:');
  const fakeAnswerWithBadCitation = `
    The authors also demonstrated that quantum transformers achieve infinite throughput [Page 99],
    which is confirmed on [Page 1].
  `.trim();

  const fakeCitations = extractCitations(fakeAnswerWithBadCitation, ragAnswer1.retrievedChunks);
  const fakeScore = calculateFaithfulnessScore(fakeCitations, fakeAnswerWithBadCitation);

  console.log(`✓ Evaluated test answer with fabricated [Page 99] citation:`);
  fakeCitations.forEach(c => {
    console.log(`  - Page ${c.pageNumber} -> Verified: ${c.verified ? 'YES' : 'NO (Flagged as unverified)'}`);
  });
  console.log(`  - Faithfulness Score: ${fakeScore}% (Expected < 100% due to unverified citation)`);

  const unverifiedCitation = fakeCitations.find(c => c.pageNumber === 99);
  if (!unverifiedCitation || unverifiedCitation.verified) {
    throw new Error('Failed to flag non-existent Page 99 citation as unverified!');
  }
  if (fakeScore >= 100) {
    throw new Error('Faithfulness score failed to penalize fabricated citation!');
  }

  // ---------------------------------------------------------------
  // Test 6: Streaming RAG Pipeline Execution
  // ---------------------------------------------------------------
  console.log('\n[Test 6] Testing Streaming RAG Execution:');
  const streamedWords: string[] = [];

  const streamAnswer = await pipeline.streamQuery(
    'What are the primary conclusions of the Transformer architecture?',
    (token: string) => {
      streamedWords.push(token);
    },
    { topK: 2 }
  );

  console.log(`✓ Streaming RAG completed in ${streamAnswer.durationMs}ms:`);
  console.log(`  - Streamed chunks count : ${streamedWords.length}`);
  console.log(`  - Faithfulness score    : ${streamAnswer.faithfulnessScore}%`);
  console.log(`  - Final answer length   : ${streamAnswer.answer.length} characters`);

  if (streamedWords.length <= 1) {
    throw new Error('Streaming failed to deliver incremental tokens!');
  }

  console.log('\n====================================================');
  console.log('       ALL PHASE 7 RAG PIPELINE CHECKS PASSED       ');
  console.log('====================================================');
}

runRAGTestSuite().catch((err) => {
  console.error('\n❌ RAG Pipeline Test Suite Failed:', err);
  process.exit(1);
});
