import fs from 'node:fs';

async function uploadAndStream() {
  const filePath = './data/sample_papers/Attention_Is_All_You_Need.pdf';
  const fileData = fs.readFileSync(filePath);
  const blob = new Blob([fileData], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', blob, 'Attention_Is_All_You_Need.pdf');

  console.log('[1/2] Ingesting Attention_Is_All_You_Need.pdf via Vite proxy (http://localhost:5173/api/documents/upload)...');
  const uploadRes = await fetch('http://localhost:5173/api/documents/upload', {
    method: 'POST',
    body: formData
  });
  const uploadData = await uploadRes.json();
  console.log('Ingest Result:', uploadData.message);

  console.log('\n[2/2] Sending streaming query: "What is the primary architecture proposed in the Attention paper and how does self-attention work?"');
  console.log('Stream URL: http://localhost:5173/api/rag/stream\n');

  const res = await fetch('http://localhost:5173/api/rag/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What is the primary architecture proposed in the Attention paper and how does self-attention work?',
      topK: 4,
      temperature: 0.2
    })
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let tokenCount = 0;
  let finalResult = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.type === 'token') {
          tokenCount++;
          process.stdout.write(parsed.token);
        } else if (parsed.type === 'done') {
          finalResult = parsed.result;
        }
      } catch (e) {}
    }
  }

  console.log('\n\n====================================================');
  console.log('       PHASE 10: STREAMING RAG VERIFICATION         ');
  console.log('====================================================');
  console.log('Total Tokens Streamed :', tokenCount);
  console.log('Faithfulness Score    :', finalResult?.faithfulnessScore, '%');
  console.log('Verified Citations    :', finalResult?.citations?.length);
  if (finalResult?.citations?.length > 0) {
    finalResult.citations.forEach((c, idx) => {
      console.log(`  Citation #${idx + 1}: Page ${c.pageNumber} | Verified: ${c.verified} | Excerpt: "${c.excerpt.substring(0, 60)}..."`);
    });
  }
  console.log('Retrieved Chunks Count:', finalResult?.retrievedChunks?.length);
  if (finalResult?.retrievedChunks?.length > 0) {
    console.log('First Chunk Score     :', (finalResult.retrievedChunks[0].similarityScore * 100).toFixed(1) + '%');
  }
  console.log('Inference Duration    :', finalResult?.durationMs, 'ms');
  console.log('====================================================');
}

uploadAndStream().catch(console.error);
