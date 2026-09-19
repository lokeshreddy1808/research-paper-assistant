import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_URL = 'http://localhost:3001';

async function runApiTestSuite() {
  console.log('====================================================');
  console.log('       PHASE 8: EXPRESS 5 REST API VERIFICATION     ');
  console.log('====================================================\n');

  // ---------------------------------------------------------------
  // Test 1: Health Check
  // ---------------------------------------------------------------
  console.log('[Test 1] Testing GET /api/health:');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const healthData = await healthRes.json() as { ok: boolean; version: string };
  console.log(`✓ Health status: ${healthRes.status} | Payload:`, healthData);
  if (!healthData.ok) {
    throw new Error('Health check returned non-ok status!');
  }

  // ---------------------------------------------------------------
  // Test 2: Multipart PDF Upload (Attention Is All You Need)
  // ---------------------------------------------------------------
  console.log('\n[Test 2] Testing POST /api/documents/upload:');
  const paperPath = path.resolve(__dirname, '../../../data/sample_papers/Attention_Is_All_You_Need.pdf');
  const pdfBytes = fs.readFileSync(paperPath);

  const formData = new FormData();
  formData.append(
    'file',
    new Blob([pdfBytes], { type: 'application/pdf' }),
    'Attention_Is_All_You_Need.pdf'
  );

  const uploadStart = Date.now();
  const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
    method: 'POST',
    body: formData
  });
  const uploadDuration = Date.now() - uploadStart;

  const uploadData = await uploadRes.json() as {
    ok: boolean;
    document?: { id: string; filename: string; totalPages: number; totalChunks: number };
    error?: string;
  };

  console.log(`✓ Upload completed with HTTP ${uploadRes.status} in ${uploadDuration}ms:`);
  console.log(`  - Document ID   : ${uploadData.document?.id}`);
  console.log(`  - Total Pages   : ${uploadData.document?.totalPages}`);
  console.log(`  - Chunks Created: ${uploadData.document?.totalChunks}`);

  if (uploadRes.status !== 201 || !uploadData.ok || !uploadData.document) {
    throw new Error(`Upload failed: ${uploadData.error || 'Unknown error'}`);
  }

  const uploadedDocId = uploadData.document.id;

  // ---------------------------------------------------------------
  // Test 3: List Documents
  // ---------------------------------------------------------------
  console.log('\n[Test 3] Testing GET /api/documents:');
  const listRes = await fetch(`${BASE_URL}/api/documents`);
  const listData = await listRes.json() as { ok: boolean; documents: Array<{ id: string; filename: string }> };

  console.log(`✓ Retrieved ${listData.documents.length} document(s):`);
  listData.documents.forEach(doc => {
    console.log(`  - [${doc.id}] ${doc.filename}`);
  });

  if (!listData.documents.some(d => d.id === uploadedDocId)) {
    throw new Error('Uploaded document missing from document list!');
  }

  // ---------------------------------------------------------------
  // Test 4: RAG Query Endpoint
  // ---------------------------------------------------------------
  console.log('\n[Test 4] Testing POST /api/rag/query:');
  const queryStart = Date.now();
  const queryRes = await fetch(`${BASE_URL}/api/rag/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'How does self-attention enable significantly more parallelization than RNNs?',
      documentId: uploadedDocId,
      topK: 3
    })
  });
  const queryDuration = Date.now() - queryStart;

  const queryData = await queryRes.json() as {
    ok: boolean;
    result?: {
      answer: string;
      citations: Array<{ pageNumber: number; verified: boolean }>;
      faithfulnessScore: number;
    };
    error?: string;
  };

  console.log(`✓ Query executed with HTTP ${queryRes.status} in ${queryDuration}ms:`);
  console.log(`  - Faithfulness Score : ${queryData.result?.faithfulnessScore}%`);
  console.log(`  - Citations Verified : ${queryData.result?.citations.length}`);
  console.log(`  - Answer Preview     : "${queryData.result?.answer.slice(0, 150).replace(/\n/g, ' ')}..."`);

  if (!queryData.ok || !queryData.result) {
    throw new Error(`Query failed: ${queryData.error || 'Unknown error'}`);
  }

  // ---------------------------------------------------------------
  // Test 5: Server-Sent Events (SSE) Streaming Endpoint
  // ---------------------------------------------------------------
  console.log('\n[Test 5] Testing POST /api/rag/stream (Server-Sent Events):');
  const streamStart = Date.now();
  const streamRes = await fetch(`${BASE_URL}/api/rag/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What are the main conclusions regarding training efficiency?',
      documentId: uploadedDocId
    })
  });

  console.log(`✓ Stream handshake HTTP status: ${streamRes.status}`);
  console.log(`  - Content-Type: ${streamRes.headers.get('content-type')}`);

  if (streamRes.status !== 200 || !streamRes.body) {
    throw new Error('Streaming connection failed to establish!');
  }

  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let tokenCount = 0;
  let finalDoneResult: any = null;
  let streamBuffer = '';

  let isDone = false;
  while (!isDone) {
    const { done, value } = await reader.read();
    if (done) break;

    streamBuffer += decoder.decode(value, { stream: true });
    const lines = streamBuffer.split('\n');
    streamBuffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') {
        isDone = true;
        break;
      }

      try {
        const event = JSON.parse(jsonStr);
        if (event.type === 'token') {
          tokenCount++;
        } else if (event.type === 'done') {
          finalDoneResult = event.result;
        }
      } catch {
        // Skip partial JSON chunks
      }
    }
  }

  const streamDuration = Date.now() - streamStart;
  console.log(`✓ Streaming finished in ${streamDuration}ms:`);
  console.log(`  - Tokens Streamed   : ${tokenCount}`);
  console.log(`  - Final Done Event  : ${finalDoneResult ? 'RECEIVED ✓' : 'MISSING ✗'}`);
  console.log(`  - Faithfulness Score: ${finalDoneResult?.faithfulnessScore}%`);

  if (tokenCount === 0 || !finalDoneResult) {
    throw new Error('SSE stream did not deliver tokens or completion event!');
  }

  // ---------------------------------------------------------------
  // Test 6: Document Deletion
  // ---------------------------------------------------------------
  console.log('\n[Test 6] Testing DELETE /api/documents/:id:');
  const deleteRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}`, {
    method: 'DELETE'
  });
  const deleteData = await deleteRes.json() as { ok: boolean; deletedChunks: number };

  console.log(`✓ Deleted document HTTP ${deleteRes.status}: ${deleteData.deletedChunks} chunks purged.`);
  if (deleteRes.status !== 200 || !deleteData.ok) {
    throw new Error('Delete document endpoint failed!');
  }

  // Verify list is now empty
  const finalListRes = await fetch(`${BASE_URL}/api/documents`);
  const finalListData = await finalListRes.json() as { documents: any[] };
  if (finalListData.documents.length !== 0) {
    throw new Error('Document still present in list after deletion!');
  }
  console.log('✓ Document list verified empty after deletion.');

  console.log('\n====================================================');
  console.log('     ALL PHASE 8 REST API ROUTE CHECKS PASSED       ');
  console.log('====================================================');
}

runApiTestSuite().catch(err => {
  console.error('\n❌ API Test Suite Failed:', err);
  process.exit(1);
});
