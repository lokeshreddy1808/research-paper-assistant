import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'http://localhost:5173/api';

/**
 * Helper to upload a PDF file to the API.
 */
async function uploadPaper(filename) {
  const filePath = path.join('./data/sample_papers', filename);
  const fileData = fs.readFileSync(filePath);
  const blob = new Blob([fileData], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, filename);

  const start = performance.now();
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData
  });

  const durationMs = Math.round(performance.now() - start);
  if (!res.ok) {
    throw new Error(`Failed to upload ${filename}: HTTP ${res.status}`);
  }
  const json = await res.json();
  return { ...json, durationMs };
}

/**
 * Helper to query the RAG pipeline.
 */
async function executeRAGQuery(question, options = {}) {
  const start = performance.now();
  const res = await fetch(`${API_BASE}/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question,
      ...options
    })
  });

  const durationMs = Math.round(performance.now() - start);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`RAG Query failed HTTP ${res.status}: ${errText}`);
  }
  const json = await res.json();
  return { ...json.result, clientDurationMs: durationMs };
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('  PHASE 11: MULTI-PAPER BENCHMARK & ZERO-HALLUCINATION STRESS   ');
  console.log('================================================================\n');

  const scorecard = [];

  // ===========================================================================
  // STAGE 1: Dual Document Ingestion & Catalog Health
  // ===========================================================================
  console.log('--- [STAGE 1] Multi-Document Ingestion & Indexing ---');

  // Purge any stale papers from previous runs for clean isolated evaluation
  const initialDocsRes = await fetch(`${API_BASE}/documents`);
  const initialDocs = await initialDocsRes.json();
  if (initialDocs.documents && initialDocs.documents.length > 0) {
    for (const doc of initialDocs.documents) {
      await fetch(`${API_BASE}/documents/${doc.id}`, { method: 'DELETE' });
    }
  }

  // Ingest Attention Is All You Need
  const paper1 = await uploadPaper('Attention_Is_All_You_Need.pdf');
  console.log(`✓ Ingested Paper 1: Attention_Is_All_You_Need.pdf`);
  console.log(`  - Pages: ${paper1.document.totalPages} | Chunks: ${paper1.document.totalChunks} | Latency: ${paper1.durationMs}ms`);

  // Ingest Deep Residual Learning
  const paper2 = await uploadPaper('Deep_Residual_Learning.pdf');
  console.log(`✓ Ingested Paper 2: Deep_Residual_Learning.pdf`);
  console.log(`  - Pages: ${paper2.document.totalPages} | Chunks: ${paper2.document.totalChunks} | Latency: ${paper2.durationMs}ms`);

  // Verify Library State
  const docsRes = await fetch(`${API_BASE}/documents`);
  const docsJson = await docsRes.json();
  const totalIndexed = docsJson.documents.length;
  console.log(`✓ Total Indexed Library Papers: ${totalIndexed}`);

  scorecard.push({
    test: 'Dual Document Ingestion',
    metric: 'Indexed Papers Count',
    target: '>= 2',
    actual: `${totalIndexed} papers`,
    passed: totalIndexed >= 2
  });

  // ===========================================================================
  // STAGE 2: Single-Paper Grounded Retrieval & Precision
  // ===========================================================================
  console.log('\n--- [STAGE 2] Single-Paper Grounded Retrieval ---');

  // Query A: Attention Mechanism
  const queryA = 'What are the dimensions and key operations in Multi-Head Attention?';
  console.log(`[Query 2A]: "${queryA}"`);
  const ansA = await executeRAGQuery(queryA, { topK: 4 });
  console.log(`  - Faithfulness Score: ${ansA.faithfulnessScore}%`);
  console.log(`  - Verified Citations: ${ansA.citations.filter(c => c.verified).length}`);
  console.log(`  - Latency: ${ansA.clientDurationMs}ms`);
  console.log(`  - Excerpt Preview: "${ansA.answer.substring(0, 100)}..."`);

  scorecard.push({
    test: 'Single-Paper (Transformers)',
    metric: 'Faithfulness & Grounding',
    target: '100%',
    actual: `${ansA.faithfulnessScore}%`,
    passed: ansA.faithfulnessScore === 100
  });

  // Query B: ResNet Degradation Problem
  const queryB = 'How do deep residual networks resolve the degradation problem with identity shortcut connections?';
  console.log(`\n[Query 2B]: "${queryB}"`);
  const ansB = await executeRAGQuery(queryB, { topK: 4 });
  console.log(`  - Faithfulness Score: ${ansB.faithfulnessScore}%`);
  console.log(`  - Verified Citations: ${ansB.citations.filter(c => c.verified).length}`);
  console.log(`  - Latency: ${ansB.clientDurationMs}ms`);
  console.log(`  - Excerpt Preview: "${ansB.answer.substring(0, 100)}..."`);

  scorecard.push({
    test: 'Single-Paper (ResNets)',
    metric: 'Faithfulness & Grounding',
    target: '100%',
    actual: `${ansB.faithfulnessScore}%`,
    passed: ansB.faithfulnessScore === 100
  });

  // ===========================================================================
  // STAGE 3: Cross-Document Comparative Reasoning
  // ===========================================================================
  console.log('\n--- [STAGE 3] Cross-Document Comparative Reasoning ---');

  const queryCross = 'Compare self-attention in Attention Is All You Need with residual skip connections in Deep Residual Learning for training deep networks.';
  console.log(`[Query 3]: "${queryCross}"`);
  const ansCross = await executeRAGQuery(queryCross, { topK: 6 });

  const paperNamesInChunks = new Set(ansCross.retrievedChunks.map(c => c.documentFilename));
  console.log(`  - Retrieved Documents: ${Array.from(paperNamesInChunks).join(', ')}`);
  console.log(`  - Faithfulness Score: ${ansCross.faithfulnessScore}%`);
  console.log(`  - Total Chunks Retrieved: ${ansCross.retrievedChunks.length}`);
  console.log(`  - Total Citations: ${ansCross.citations.length}`);
  console.log(`  - Excerpt Preview: "${ansCross.answer.substring(0, 120)}..."`);

  const hasBothPapers = paperNamesInChunks.size >= 2;
  scorecard.push({
    test: 'Cross-Document Synthesis',
    metric: 'Multi-Paper Context Retrieval',
    target: '>= 2 source papers',
    actual: `${paperNamesInChunks.size} papers retrieved`,
    passed: hasBothPapers
  });

  scorecard.push({
    test: 'Cross-Document Faithfulness',
    metric: 'Comparative Grounding Score',
    target: '100%',
    actual: `${ansCross.faithfulnessScore}%`,
    passed: ansCross.faithfulnessScore === 100
  });

  // ===========================================================================
  // STAGE 4: Adversarial Hallucination Stress Testing
  // ===========================================================================
  console.log('\n--- [STAGE 4] Adversarial Hallucination Stress Testing ---');

  // Stress 1: Out-of-domain historical question
  const queryOOD = 'What were the primary economic and diplomatic causes of the French Revolution in 1789?';
  console.log(`[Stress 4A - Out of Domain]: "${queryOOD}"`);
  const ansOOD = await executeRAGQuery(queryOOD, { minScore: 0.50 });
  
  const declaredAbstain = 
    ansOOD.answer.toLowerCase().includes('not contain sufficient') || 
    ansOOD.answer.toLowerCase().includes('insufficient evidence') ||
    ansOOD.citations.length === 0;

  console.log(`  - System Declared Abstention: ${declaredAbstain ? 'YES (Grounded Refusal)' : 'NO (Hallucination Detected)'}`);
  console.log(`  - Fabricated Citations: ${ansOOD.citations.length}`);
  console.log(`  - Faithfulness Score: ${ansOOD.faithfulnessScore}%`);
  console.log(`  - Response: "${ansOOD.answer.trim()}"`);

  scorecard.push({
    test: 'Stress: Out-of-Domain Refusal',
    metric: 'Hallucination Prevention',
    target: 'Zero False Claims (100%)',
    actual: `${ansOOD.faithfulnessScore}% (Refusal Confirmed)`,
    passed: declaredAbstain && ansOOD.faithfulnessScore === 100
  });

  // Stress 2: Adversarial false premise (trying to force ResNet into citing audio attention)
  const queryAdversarial = 'On which page do the authors of ResNet discuss their use of self-attention mechanisms for audio synthesis?';
  console.log(`\n[Stress 4B - False Premise]: "${queryAdversarial}"`);
  const ansAdversarial = await executeRAGQuery(queryAdversarial, { 
    documentId: paper2.document.id, // Target ResNet specifically
    minScore: 0.65 
  });

  const falsePremiseRefusal = 
    ansAdversarial.answer.toLowerCase().includes('not contain sufficient') ||
    ansAdversarial.citations.length === 0;

  console.log(`  - False Premise Refusal: ${falsePremiseRefusal ? 'YES (Refused False Claim)' : 'NO'}`);
  console.log(`  - Fabricated Citations: ${ansAdversarial.citations.length}`);
  console.log(`  - Faithfulness Score: ${ansAdversarial.faithfulnessScore}%`);

  scorecard.push({
    test: 'Stress: False Premise Trap',
    metric: 'Zero Hallucinated Citations',
    target: '0 Fabrications',
    actual: `${ansAdversarial.citations.length} Fabrications`,
    passed: falsePremiseRefusal && ansAdversarial.citations.length === 0
  });

  // ===========================================================================
  // SUMMARY BENCHMARK SCORECARD
  // ===========================================================================
  console.log('\n================================================================');
  console.log('             FINAL SYSTEM BENCHMARK SCORECARD                   ');
  console.log('================================================================');
  console.log('| Test Scenario              | Metric               | Target      | Actual          | Status |');
  console.log('|----------------------------|----------------------|-------------|-----------------|--------|');
  
  let allPassed = true;
  for (const row of scorecard) {
    const status = row.passed ? '✓ PASS' : '✗ FAIL';
    if (!row.passed) allPassed = false;
    const testPad = row.test.padEnd(26);
    const metricPad = row.metric.padEnd(20);
    const targetPad = row.target.padEnd(11);
    const actualPad = row.actual.padEnd(15);
    console.log(`| ${testPad} | ${metricPad} | ${targetPad} | ${actualPad} | ${status} |`);
  }
  console.log('================================================================');
  console.log(`Overall Benchmark Result: ${allPassed ? 'ALL TESTS PASSED (100% GROUNDED)' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
