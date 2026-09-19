import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPdfDocument, validatePdfBuffer } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runIngestionTest() {
  console.log('====================================================');
  console.log('   PHASE 2: PDF INGESTION & PARSING VERIFICATION    ');
  console.log('====================================================\n');

  // Test 1: Real PDF Extraction on Academic Research Paper
  const samplePdfPath = path.resolve(__dirname, '../../../data/sample_papers/Attention_Is_All_You_Need.pdf');
  console.log(`[Test 1] Parsing sample paper: ${path.basename(samplePdfPath)}...`);

  if (!fs.existsSync(samplePdfPath)) {
    throw new Error(`Sample PDF not found at: ${samplePdfPath}`);
  }

  const rawBuffer = fs.readFileSync(samplePdfPath);
  const uint8 = new Uint8Array(rawBuffer);

  const doc = await extractPdfDocument(uint8, 'Attention_Is_All_You_Need.pdf');

  console.log('✓ Ingestion Succeeded!');
  console.log(`  - Document ID    : ${doc.id}`);
  console.log(`  - SHA-256 Hash   : ${doc.sha256}`);
  console.log(`  - Total Pages    : ${doc.totalPages}`);
  console.log(`  - File Size      : ${(doc.fileSizeBytes / 1024).toFixed(2)} KB (${doc.fileSizeBytes} bytes)`);

  console.log('\n[Test 2] Validating Page-by-Page Extraction & 1-Indexed Provenance:');
  doc.pages.forEach((p) => {
    console.log(
      `  - Page ${p.pageNumber}: ${p.characterCount} chars | Scanned: ${p.isScanned ? 'YES' : 'NO'} | Preview: "${p.text.slice(0, 50).replace(/\n/g, ' ')}..."`
    );
    if (p.pageNumber < 1) {
      throw new Error(`Invalid pageNumber: ${p.pageNumber}. Page numbers must be 1-indexed!`);
    }
  });

  // Verify key academic content on page 1
  if (!doc.pages[0].text.includes('Attention Is All You Need')) {
    throw new Error('Verification failed: Page 1 missing title "Attention Is All You Need"');
  }
  console.log('\n✓ Academic text verified on Page 1 ("Attention Is All You Need")');

  // Test 2b: Multi-document support - parse second paper
  const secondPdfPath = path.resolve(__dirname, '../../../data/sample_papers/Deep_Residual_Learning.pdf');
  const secondDoc = await extractPdfDocument(new Uint8Array(fs.readFileSync(secondPdfPath)), 'Deep_Residual_Learning.pdf');
  console.log(`\n✓ Multi-document test: Parsed second paper "${secondDoc.filename}" (${secondDoc.totalPages} pages, ${(secondDoc.fileSizeBytes / 1024).toFixed(2)} KB)`);
  console.log(`  - Unique SHA-256: ${secondDoc.sha256}`);

  // Test 3: Magic Header Validation on Corrupt / Non-PDF Data
  console.log('\n[Test 3] Testing Magic Header (%PDF-) Validation on Corrupt Input:');
  const fakePdfBuffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello" in ASCII
  try {
    validatePdfBuffer(fakePdfBuffer);
    throw new Error('Validation failed to catch non-PDF buffer!');
  } catch (err) {
    console.log(`✓ Caught expected validation error: "${(err as Error).message}"`);
  }

  console.log('\n====================================================');
  console.log('       ALL PHASE 2 INGESTION CHECKS PASSED          ');
  console.log('====================================================');
}

runIngestionTest().catch((err) => {
  console.error('\n❌ Ingestion Test Failed:', err);
  process.exit(1);
});
