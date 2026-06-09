import { pipeline, env } from '@huggingface/transformers';

// Disable checking for local model files since we will cache them on demand from HF Hub
env.allowLocalModels = false;

// Single-threaded WASM to avoid issues in Worker context
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let embeddingPipeline: any = null;
let llmPipeline: any = null;

// Cancellation flag for LLM download
let llmCancelled = false;

// Per-model throttle timestamps
const lastProgressTime: Record<string, number> = { embedding: 0, llm: 0 };

function makeProgressCallback(modelName: 'embedding' | 'llm') {
  return (data: any) => {
    // If user cancelled LLM, stop reporting progress
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
          progress: data.progress,
          loaded: data.loaded,
          total: data.total
        });
        lastProgressTime[modelName] = now;
      }
    } else if (data.status === 'done') {
      self.postMessage({
        type: 'progress',
        model: modelName,
        file: data.file,
        progress: 100,
        loaded: data.loaded || 0,
        total: data.total || 0
      });
    } else if (data.status === 'ready') {
      self.postMessage({
        type: 'ready',
        model: modelName
      });
    }
  };
}

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    self.postMessage({ type: 'status', model: 'embedding', status: 'loading' });
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: makeProgressCallback('embedding')
    });
    self.postMessage({ type: 'status', model: 'embedding', status: 'ready' });
  }
  return embeddingPipeline;
}

async function getLLMPipeline() {
  if (!llmPipeline) {
    llmCancelled = false;
    self.postMessage({ type: 'status', model: 'llm', status: 'loading' });

    // TinyLlama-1.1B-Chat is ~600 MB with int8 quantization — more stable than Qwen 950 MB
    llmPipeline = await pipeline(
      'text-generation',
      'Xenova/TinyLlama-1.1B-Chat-v1.0',
      {
        progress_callback: makeProgressCallback('llm'),
        dtype: 'q4' // Use 4-bit quantization for faster download and lower memory (~350 MB)
      }
    );

    if (llmCancelled) {
      llmPipeline = null;
      throw new Error('CANCELLED');
    }

    self.postMessage({ type: 'status', model: 'llm', status: 'ready' });
  }
  return llmPipeline;
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
      // Mark as cancelled — the progress callback and getLLMPipeline will honour this
      llmCancelled = true;
      llmPipeline = null;
      self.postMessage({ type: 'status', model: 'llm', status: 'idle' });
      self.postMessage({ type: 'cancel-llm-success' });
    }

    else if (type === 'embed') {
      const { text, pageId, blockId } = payload;
      const extractor = await getEmbeddingPipeline();

      const output = await extractor(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data);

      self.postMessage({
        type: 'embed-success',
        payload: {
          embedding,
          pageId,
          blockId
        }
      });
    }

    else if (type === 'generate') {
      const { prompt } = payload;
      const generator = await getLLMPipeline();

      self.postMessage({ type: 'status', model: 'llm', status: 'generating' });

      // TinyLlama uses Llama chat format
      const systemMsg = 'Eres un asistente útil dentro de la aplicación de notas Tabula. El usuario te pedirá ayuda para escribir o estructurar información. Si te pide una tabla, genera una tabla limpia en formato Markdown. Tu respuesta debe consistir ÚNICAMENTE en el contenido Markdown que solicitó el usuario, sin introducciones ni explicaciones adicionales.';
      const formattedPrompt = `<|system|>\n${systemMsg}</s>\n<|user|>\n${prompt}</s>\n<|assistant|>\n`;

      const output = await generator(formattedPrompt, {
        max_new_tokens: 512,
        temperature: 0.3,
        do_sample: true,
        repetition_penalty: 1.1,
        return_full_text: false
      });

      let text = output[0].generated_text;

      // Clean up any trailing special tokens
      text = text.replace(/<\/s>$/, '').replace(/<\|assistant\|>$/, '').trim();

      self.postMessage({
        type: 'generate-success',
        payload: { text }
      });
    }

  } catch (error: any) {
    if (error.message === 'CANCELLED') {
      // User cancelled — already handled above
      return;
    }
    console.error('Worker error:', error);
    self.postMessage({
      type: 'error',
      payload: {
        message: error.message || String(error)
      }
    });
  }
};
