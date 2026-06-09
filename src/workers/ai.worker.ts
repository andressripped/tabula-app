import { pipeline, env } from '@huggingface/transformers';

// Disable local model checks — download from HF Hub on demand
env.allowLocalModels = false;

// Single-threaded WASM to avoid Worker context issues
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

// ─── Model identifiers ────────────────────────────────────────
// NOTE: Transformers.js caches downloaded models in the browser's Cache API.
// In Electron this maps to the app's userData directory (e.g. %APPDATA%\Tabula\Cache).
// electron-updater ONLY replaces the app binary — it never touches userData.
// Therefore downloaded models PERSIST ACROSS APP UPDATES automatically.
// ──────────────────────────────────────────────────────────────
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';
const LLM_MODEL       = 'Xenova/LaMini-Flan-T5-248M';

let embeddingPipeline: any = null;
let llmPipeline: any = null;

// Cancellation flag
let llmCancelled = false;

// Per-model throttle timestamps
const lastProgressTime: Record<string, number> = { embedding: 0, llm: 0 };

function makeProgressCallback(modelName: 'embedding' | 'llm') {
  return (data: any) => {
    if (modelName === 'llm' && llmCancelled) return;

    if (data.status === 'initiate') {
      self.postMessage({
        type: 'progress',
        model: modelName,
        file: data.file,
        progress: 0,
        loaded: 0,
        total: 0
      });
    } else if (data.status === 'progress') {
      const now = Date.now();
      if (now - lastProgressTime[modelName] > 120) {
        self.postMessage({
          type: 'progress',
          model: modelName,
          file: data.file,
          progress: data.progress ?? 0,
          loaded: data.loaded ?? 0,
          total: data.total ?? 0
        });
        lastProgressTime[modelName] = now;
      }
    } else if (data.status === 'done') {
      self.postMessage({
        type: 'progress',
        model: modelName,
        file: data.file,
        progress: 100,
        loaded: data.loaded ?? 0,
        total: data.total ?? 0
      });
    } else if (data.status === 'ready') {
      self.postMessage({ type: 'ready', model: modelName });
    }
  };
}

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    self.postMessage({ type: 'status', model: 'embedding', status: 'loading' });
    embeddingPipeline = await pipeline(
      'feature-extraction',
      EMBEDDING_MODEL,
      { progress_callback: makeProgressCallback('embedding') }
    );
    self.postMessage({ type: 'status', model: 'embedding', status: 'ready' });
  }
  return embeddingPipeline;
}

async function getLLMPipeline() {
  if (!llmPipeline) {
    llmCancelled = false;
    self.postMessage({ type: 'status', model: 'llm', status: 'loading' });

    // LaMini-Flan-T5-248M: seq2seq instruction-following model
    // ~248 MB — fast inference, great for tables and structured text
    llmPipeline = await pipeline(
      'text2text-generation',
      LLM_MODEL,
      { progress_callback: makeProgressCallback('llm') }
    );

    if (llmCancelled) {
      llmPipeline = null;
      throw new Error('CANCELLED');
    }

    self.postMessage({ type: 'status', model: 'llm', status: 'ready' });
  }
  return llmPipeline;
}

// Delete all LLM model cache entries from the browser Cache API
async function deleteModelFromCache(modelId: string): Promise<number> {
  let deleted = 0;
  try {
    const cacheNames: string[] = await (self as any).caches.keys();
    for (const name of cacheNames) {
      const cache = await (self as any).caches.open(name);
      const keys = await cache.keys();
      for (const req of keys) {
        if ((req as Request).url.includes(modelId.replace('/', '%2F')) ||
            (req as Request).url.includes(modelId)) {
          await cache.delete(req);
          deleted++;
        }
      }
      // If cache is now empty, delete the cache itself
      const remaining = await cache.keys();
      if (remaining.length === 0) {
        await (self as any).caches.delete(name);
      }
    }
  } catch (e) {
    console.warn('Cache API not available, trying alternate delete:', e);
  }
  return deleted;
}

// Helper: wrap a promise with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT: ${label} exceeded ${ms}ms`)), ms)
    )
  ]);
}

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  try {
    if (type === 'init-embedding') {
      await getEmbeddingPipeline();
      self.postMessage({ type: 'init-embedding-success' });
    }

    else if (type === 'init-llm') {
      llmCancelled = false;
      await getLLMPipeline();
      self.postMessage({ type: 'init-llm-success' });
    }

    else if (type === 'cancel-llm') {
      llmCancelled = true;
      llmPipeline = null;
      self.postMessage({ type: 'status', model: 'llm', status: 'idle' });
      self.postMessage({ type: 'cancel-llm-success' });
    }

    else if (type === 'delete-llm') {
      // Reset in-memory pipeline
      llmPipeline = null;
      llmCancelled = false;
      // Remove cached files from Cache API
      const deletedCount = await deleteModelFromCache(LLM_MODEL);
      console.log(`Deleted ${deletedCount} model cache entries for ${LLM_MODEL}`);
      self.postMessage({ type: 'status', model: 'llm', status: 'idle' });
      self.postMessage({ type: 'delete-llm-success' });
    }

    else if (type === 'embed') {
      const { text, pageId, blockId } = payload;
      const extractor = await getEmbeddingPipeline();
      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data) as number[];
      self.postMessage({
        type: 'embed-success',
        payload: { embedding, pageId, blockId }
      });
    }

    else if (type === 'generate') {
      const { prompt } = payload;
      const generator = await getLLMPipeline();

      self.postMessage({ type: 'status', model: 'llm', status: 'generating' });

      // LaMini-Flan-T5 is instruction-following — pass the task directly
      const instruction = `You are a helpful writing assistant inside a note-taking app called Tabula.
Respond ONLY with the requested content in clean Markdown format (no preamble, no explanation).
If asked for a table, use proper Markdown table syntax with | separators and a header row.
If asked in Spanish, respond in Spanish.

User request: ${prompt}`;

      // 90-second timeout — Flan-T5 is fast and should finish well within this
      const output = await withTimeout(
        generator(instruction, {
          max_new_tokens: 400,
          temperature: 0.3,
          repetition_penalty: 1.3,
          no_repeat_ngram_size: 3,
        }),
        90_000,
        'text generation'
      );

      const rawText = Array.isArray(output)
        ? (output[0] as any)?.generated_text
        : (output as any)?.generated_text;
      const text = (rawText ?? '').trim();

      self.postMessage({
        type: 'generate-success',
        payload: { text }
      });
    }

  } catch (error: any) {
    if (error.message === 'CANCELLED') return;

    const isTimeout = error.message?.startsWith('TIMEOUT');
    console.error('Worker error:', error.message);

    // Reset LLM state so user can try again
    if (type === 'generate' || isTimeout) {
      self.postMessage({ type: 'status', model: 'llm', status: 'ready' });
    }

    self.postMessage({
      type: 'error',
      payload: {
        message: isTimeout
          ? 'La generación tardó demasiado. Intenta con un texto más corto.'
          : (error.message || String(error))
      }
    });
  }
};
