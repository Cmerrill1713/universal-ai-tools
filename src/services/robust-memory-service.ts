import client from 'prom-client';

import { config } from '@/config/environment';
import { metricsRegistry } from '@/middleware/metrics';
import { CircuitBreakerRegistry, createCircuitBreaker } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';

import { generateEmbedding, generateFallbackEmbedding } from './embeddings';
import type { MemoryRecord } from './memory-service';
import { memoryService } from './memory-service';

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Prometheus metrics
const memWrites = new client.Counter({
  name: 'memory_writes_total',
  help: 'Total memory write attempts',
  registers: [metricsRegistry],
});

const memWritesFailed = new client.Counter({
  name: 'memory_writes_failed_total',
  help: 'Total memory write failures',
  registers: [metricsRegistry],
});

const memDeduped = new client.Counter({
  name: 'memory_deduplicated_total',
  help: 'Total deduplicated memory writes',
  registers: [metricsRegistry],
});

const memBuffered = new client.Gauge({
  name: 'memory_buffered_items',
  help: 'Buffered memory items awaiting flush',
  registers: [metricsRegistry],
});

type LruEntry = { embedding: number[]; id?: string; importance: number };

export class RobustMemoryService {
  private breaker = createCircuitBreaker('memory-db', {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
    volumeThreshold: 5,
    errorThresholdPercentage: 50,
    rollingWindow: 30000,
  });
  private buffer: MemoryRecord[] = [];
  private lru: Map<string, LruEntry[]> = new Map(); // key by userId::type
  private flushTimer: NodeJS.Timer | null = null;
  private dedupeThreshold = 0.92;

  constructor() {
    CircuitBreakerRegistry.register('memory-db', this.breaker);
    this.startAutoFlush();
  }

  private startAutoFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flushBuffer();
    }, 10000);
  }

  private stopAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer as NodeJS.Timeout);
      this.flushTimer = null;
    }
  }

  private getLruKey(userId: string, type: string): string {
    return `${userId}::${type}`;
  }

  private updateLru(
    userId: string,
    type: string,
    embedding: number[],
    id?: string,
    importance = 0.5
  ): void {
    const key = this.getLruKey(userId, type);
    const arr = this.lru.get(key) || [];
    arr.unshift({ embedding, id, importance });
    if (arr.length > 200) arr.pop();
    this.lru.set(key, arr);
  }

  private isDuplicate(userId: string, type: string, emb: number[]): boolean {
    const key = this.getLruKey(userId, type);
    const arr = this.lru.get(key) || [];
    for (const e of arr.slice(0, 50)) {
      if (cosineSimilarity(e.embedding, emb) >= this.dedupeThreshold) return true;
    }
    return false;
  }

  async save(memory: MemoryRecord): Promise<string | null> {
    memWrites.inc();
    try {
      // Compute embedding (offline-friendly)
      const embedding =
        (await generateEmbedding(memory.content)) || generateFallbackEmbedding(memory.content);

      // Local dedupe using recent embeddings
      if (this.isDuplicate(memory.userId, memory.type, embedding)) {
        memDeduped.inc();
        return null;
      }

      const op = async () => memoryService.save(memory);
      const id = await this.breaker.execute(op);

      if (id) {
        this.updateLru(memory.userId, memory.type, embedding, id, memory.importance ?? 0.5);
      }
      return id;
    } catch (error) {
      memWritesFailed.inc();
      // Buffer for later flush (only if not prohibited)
      if (!config.offlineMode) {
        this.buffer.push(memory);
        memBuffered.set(this.buffer.length);
        log.warn('Buffered memory due to save failure', LogContext.DATABASE, {
          size: this.buffer.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return null;
    }
  }

  async flushBuffer(): Promise<number> {
    if (this.buffer.length === 0) return 0;
    const toFlush = [...this.buffer];
    this.buffer = [];
    memBuffered.set(0);
    let flushed = 0;
    for (const item of toFlush) {
      try {
        const id = await memoryService.save(item);
        if (id) flushed++;
      } catch {
        // Re-buffer on failure
        this.buffer.push(item);
      }
    }
    memBuffered.set(this.buffer.length);
    return flushed;
  }

  async list(userId: string, type?: MemoryRecord['type'], limit = 50, offset = 0) {
    return memoryService.list(userId, type, limit, offset);
  }

  async get(userId: string, id: string) {
    return memoryService.get(userId, id);
  }

  async update(userId: string, id: string, updates: Partial<MemoryRecord>) {
    return memoryService.update(userId, id, updates);
  }

  async remove(userId: string, id: string) {
    return memoryService.remove(userId, id);
  }

  async search(userId: string, queryText: string, type?: MemoryRecord['type'], limit = 10) {
    // Delegate to underlying service (text search + fallback)
    return memoryService.search(userId, queryText, type, limit);
  }

  getBufferedCount(): number {
    return this.buffer.length;
  }

  setDedupeThreshold(threshold: number): void {
    this.dedupeThreshold = Math.max(0.5, Math.min(0.99, threshold));
  }
}

export const robustMemoryService = new RobustMemoryService();
export default robustMemoryService;
