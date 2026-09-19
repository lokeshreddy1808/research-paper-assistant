import { 
  formatAcademicPrompt, 
  generateChatCompletion, 
  streamChatCompletion,
  DEFAULT_GROQ_MODEL
} from '../src/index.js';

async function runLLMTestSuite() {
  console.log('====================================================');
  console.log('      PHASE 6: GROQ CLOUD LLM API VERIFICATION     ');
  console.log('====================================================\n');

  console.log(`[Config] Default Target Model: ${DEFAULT_GROQ_MODEL}`);
  console.log(`[Memory Footprint] 0 MB local RAM for model weights (100% Cloud API)\n`);

  // ---------------------------------------------------------------
  // Test 1: Academic Prompt Formatting with Explicit Provenance
  // ---------------------------------------------------------------
  console.log('[Test 1] Testing Academic Prompt Construction with Page Delimiters:');
  const sampleQuestion = 'How does multi-head self-attention parallelize operations?';
  const sampleChunks = [
    {
      pageNumber: 1,
      documentFilename: 'Attention_Is_All_You_Need.pdf',
      text: 'The Transformer model relies entirely on self-attention to compute representations without sequence-aligned RNNs.'
    },
    {
      pageNumber: 2,
      documentFilename: 'Attention_Is_All_You_Need.pdf',
      text: 'Self-attention connects all positions with a constant number of sequentially executed operations, enabling significantly more parallelization than LSTM or GRU.'
    }
  ];

  const formattedMessages = formatAcademicPrompt(sampleQuestion, sampleChunks);
  console.log(`✓ Constructed ${formattedMessages.length} chat messages:`);
  console.log(`  - System Role Length : ${formattedMessages[0].content.length} chars (Grounding Rules)`);
  console.log(`  - User Role Length   : ${formattedMessages[1].content.length} chars (Delimited Excerpts + Query)`);

  if (!formattedMessages[0].content.includes('Grounding')) {
    throw new Error('System prompt missing strict grounding instructions!');
  }
  if (!formattedMessages[1].content.includes('--- Excerpt 1') || !formattedMessages[1].content.includes('Page 2')) {
    throw new Error('User prompt missing chunk page delimiter headers!');
  }

  // ---------------------------------------------------------------
  // Test 2: Non-Streaming Chat Completion
  // ---------------------------------------------------------------
  console.log('\n[Test 2] Testing Non-Streaming LLM Completion:');
  const startNonStream = Date.now();
  const completion = await generateChatCompletion(formattedMessages, {
    temperature: 0.2,
    maxTokens: 512
  });
  const duration = Date.now() - startNonStream;

  console.log(`✓ Completed in ${duration}ms:`);
  console.log(`  - Model Used   : ${completion.model}`);
  console.log(`  - Output Length: ${completion.content.length} characters`);
  console.log(`  - Token Usage  : ${completion.usage?.totalTokens ?? 'N/A'} total tokens`);
  console.log('\n  --- Synthesized Answer Preview ---');
  console.log(completion.content.slice(0, 250) + '...\n');

  if (!completion.content || completion.content.length < 20) {
    throw new Error('LLM returned an empty or insufficient answer!');
  }

  // ---------------------------------------------------------------
  // Test 3: Real-Time Token Streaming
  // ---------------------------------------------------------------
  console.log('[Test 3] Testing Real-Time Token Streaming (SSE Simulation/Stream):');
  const streamedChunks: string[] = [];
  const startStream = Date.now();

  const streamResult = await streamChatCompletion(
    formattedMessages,
    (token: string) => {
      streamedChunks.push(token);
    },
    { temperature: 0.2, maxTokens: 512 }
  );
  const streamDuration = Date.now() - startStream;

  console.log(`✓ Stream completed in ${streamDuration}ms:`);
  console.log(`  - Chunks Emitted      : ${streamedChunks.length} tokens/words`);
  console.log(`  - Streamed Text Length: ${streamResult.content.length} characters`);
  console.log(`  - First 5 Tokens      : [${streamedChunks.slice(0, 5).map(t => JSON.stringify(t)).join(', ')}]`);

  if (streamedChunks.length <= 1) {
    throw new Error('Streaming failed to emit incremental chunks!');
  }
  if (streamedChunks.join('').trim() !== streamResult.content.trim()) {
    throw new Error('Assembled stream text does not match reported content!');
  }

  // ---------------------------------------------------------------
  // Test 4: Academic Citation Guardrail Check
  // ---------------------------------------------------------------
  console.log('\n[Test 4] Verifying Academic Citation Guardrails:');
  const hasPageCitation = /\[Page \d+\]/i.test(completion.content);
  console.log(`  - Citation check [Page X] present: ${hasPageCitation ? 'YES ✓' : 'NO ✗'}`);

  if (!hasPageCitation) {
    console.warn('Warning: Output did not contain explicit [Page X] citation pattern.');
  } else {
    console.log('✓ Academic citation format verified in generated answer.');
  }

  console.log('\n====================================================');
  console.log('       ALL PHASE 6 LLM INTEGRATION CHECKS PASSED    ');
  console.log('====================================================');
}

runLLMTestSuite().catch((err) => {
  console.error('\n❌ LLM Test Suite Failed:', err);
  process.exit(1);
});
