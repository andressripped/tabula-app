import { pipeline, env } from '@huggingface/transformers';

// Disable checking for local model files since we will cache them on demand from HF Hub
env.allowLocalModels = false;

// Custom path for ONNX runtime assets if needed, otherwise it defaults to unpkg or similar CDN
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

let embeddingPipeline: any = null;
let llmPipeline: any = null;

// Throttled progress callback
let lastProgressTime = 0;
function makeProgressCallback(modelName: 'embedding' | 'llm') {
  return (data: any) => {
    if (data.status === 'progress') {
      const now = Date.now();
      if (now - lastProgressTime > 150) {
        self.postMessage({
          type: 'progress',
          model: modelName,
          file: data.file,
          progress: data.progress,
          loaded: data.loaded,
          total: data.total
        });
        lastProgressTime = now;
      }
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
    self.postMessage({ type: 'status', model: 'llm', status: 'loading' });
    // Using Xenova/Qwen1.5-0.5B-Chat because it has ONNX weights and fits in ~950MB
    llmPipeline = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat', {
      progress_callback: makeProgressCallback('llm')
    });
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
      await getLLMPipeline();
      self.postMessage({ type: 'init-llm-success' });
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
      
      // Formatting context for Qwen Chat model
      const messages = [
        { role: 'system', content: 'Eres un asistente útil dentro de la aplicación de notas Tabula. El usuario te pedirá ayuda para escribir o estructurar información. Si te pide una tabla, genera una tabla limpia en formato Markdown. Tu respuesta debe consistir ÚNICAMENTE en el contenido Markdown que solicitó el usuario, sin introducciones ni explicaciones adicionales.' },
        { role: 'user', content: prompt }
      ];

      // Convert messages to text prompt format
      let formattedPrompt = `<|im_start|>system\n${messages[0].content}<|im_end|>\n<|im_start|>user\n${messages[1].content}<|im_end|>\n<|im_start|>assistant\n`;
      
      const output = await generator(formattedPrompt, {
        max_new_tokens: 512,
        temperature: 0.2,
        do_sample: false,
        return_full_text: false
      });
      
      let text = output[0].generated_text;
      
      // Clean up assistant delimiters if any
      text = text.replace(/<\|im_end\|>$/, '');
      
      self.postMessage({
        type: 'generate-success',
        payload: {
          text
        }
      });
    }
  } catch (error: any) {
    console.error('Worker error:', error);
    self.postMessage({
      type: 'error',
      payload: {
        message: error.message || String(error)
      }
    });
  }
};
