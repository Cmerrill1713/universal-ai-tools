import { log,LogContext } from '@/utils/logger';

const DEFAULT_MODEL = 'nomic-embed-text';

const fetchApi: typeof fetch | undefined = (globalThis as any).fetch?.bind(globalThis);

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const truncated = text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
    if (!fetchApi) {
      throw new Error('fetch not available');
    }
    const res = await fetchApi('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: DEFAULT_MODEL, prompt: truncated }),
    });
    if (!res.ok) {
      throw new Error(`Embedding API ${res.status}`);
    }
    const data = await res.json();
    return data.embedding || null;
  } catch (error) {
    log.warn('⚠️ Embedding generation failed, using fallback', LogContext.AI, {
      error: error instanceof Error ? error.message : String(error),
    });
    return generateFallbackEmbedding(text);
  }
}

export function generateFallbackEmbedding(text: string): number[] {
  // Match the configured vector size for Qdrant (768 for nomic-embed-text)
  const size = 768;
  const emb = new Array(size).fill(0);
  const words = text.toLowerCase().split(/\s+/);
  for (let i = 0; i < Math.min(words.length, 200); i++) {
    const w = words[i] ?? '';
    let h = 0;
    for (let j = 0; j < w.length; j++) {
      h = (h << 5) - h + w.charCodeAt(j);
    }
    const idx = Math.abs(h) % size;
    emb[idx] += 1 / (i + 1);
  }
  const norm = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? emb.map((v) => v / norm) : emb;
}
