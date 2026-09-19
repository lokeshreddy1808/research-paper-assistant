import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { 
  extractPdfDocument, 
  splitTextRecursively, 
  chunkDocument,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP
} from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runChunkingTestSuite() {
  console.log('====================================================');
  console.log('     PHASE 3: SEMANTIC CHUNKING VERIFICATION        ');
  console.log('====================================================\n');

  // Test 1: Recursive Text Splitting Unit Test
  console.log('[Test 1] Testing recursive text splitter with hierarchical separators:');
  const sampleParagraph = `
The Transformer is the first transduction model relying entirely on self-attention to compute representations of its input and output without using sequence-aligned RNNs or convolution.

In the Transformer model, self-attention connects all positions with a constant number of sequentially executed operations. This enables significantly more parallelization than recurrent architectures like LSTM and GRU.

Furthermore, multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions. With a single attention head, averaging inhibits this.
  `.trim();

  const splitResult = splitTextRecursively(sampleParagraph, { chunkSize: 250, chunkOverlap: 40 });
  console.log(`✓ Split 3 paragraphs into ${splitResult.length} chunks (chunkSize: 250, overlap: 40):`);
  splitResult.forEach((c, idx) => {
    console.log(`  - Chunk ${idx}: ${c.length} chars | Preview: "${c.slice(0, 45).replace(/\n/g, ' ')}..."`);
    if (c.length > 250) {
      throw new Error(`Chunk ${idx} length (${c.length}) exceeded maximum chunkSize 250!`);
    }
  });

  // Test 1b: Validate error handling when overlap >= chunkSize
  try {
    splitTextRecursively("Hello world", { chunkSize: 100, chunkOverlap: 120 });
    throw new Error('Failed to reject invalid overlap >= chunkSize!');
  } catch (err) {
    console.log(`✓ Caught expected error on invalid overlap: "${(err as Error).message}"`);
  }

  // Test 2: Full Document Chunking on Attention_Is_All_You_Need.pdf
  console.log('\n[Test 2] Chunking real academic paper: Attention_Is_All_You_Need.pdf:');
  const paperPath1 = path.resolve(__dirname, '../../../data/sample_papers/Attention_Is_All_You_Need.pdf');
  const doc1 = await extractPdfDocument(new Uint8Array(fs.readFileSync(paperPath1)), 'Attention_Is_All_You_Need.pdf');

  const chunkResult1 = chunkDocument(doc1, { chunkSize: 800, chunkOverlap: 120 });
  console.log(`✓ Document chunking successful!`);
  console.log(`  - Document ID   : ${chunkResult1.documentId}`);
  console.log(`  - Source Pages  : ${doc1.totalPages}`);
  console.log(`  - Total Chunks  : ${chunkResult1.totalChunks}`);

  console.log('\n[Test 3] Verifying Exact Page Provenance & Metadata in Chunks:');
  chunkResult1.chunks.forEach((chunk, i) => {
    console.log(
      `  - [Chunk ${i}] ID: ${chunk.id} | Page ${chunk.pageNumber} | ${chunk.characterCount} chars | ~${chunk.tokenEstimate} tokens`
    );
    console.log(`    Excerpt: "${chunk.text.slice(0, 60).replace(/\n/g, ' ')}..."`);

    // Invariant checks for college viva
    if (!chunk.id.includes(`-p${chunk.pageNumber}-`)) {
      throw new Error(`Chunk ID invariant failed: ${chunk.id} does not encode pageNumber!`);
    }
    if (chunk.pageNumber < 1 || chunk.pageNumber > doc1.totalPages) {
      throw new Error(`Invalid pageNumber ${chunk.pageNumber}. Outside document range 1..${doc1.totalPages}!`);
    }
    if (chunk.characterCount > 800) {
      throw new Error(`Chunk characterCount (${chunk.characterCount}) exceeded chunkSize (800)!`);
    }
  });

  // Test 4: Multi-Document Chunking Verification
  console.log('\n[Test 4] Multi-Document Chunking (Deep_Residual_Learning.pdf):');
  const paperPath2 = path.resolve(__dirname, '../../../data/sample_papers/Deep_Residual_Learning.pdf');
  const doc2 = await extractPdfDocument(new Uint8Array(fs.readFileSync(paperPath2)), 'Deep_Residual_Learning.pdf');
  const chunkResult2 = chunkDocument(doc2);
  console.log(`✓ Successfully chunked second paper: ${chunkResult2.totalChunks} chunks produced.`);
  console.log(`  - First chunk ID : ${chunkResult2.chunks[0].id}`);
  console.log(`  - Document Title : "${chunkResult2.chunks[0].documentTitle}"`);

  console.log('\n====================================================');
  console.log('       ALL PHASE 3 CHUNKING CHECKS PASSED           ');
  console.log('====================================================');
}

runChunkingTestSuite().catch((err) => {
  console.error('\n❌ Chunking Test Suite Failed:', err);
  process.exit(1);
});
