import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { DSPyKnowledgeManager, KnowledgeItem, knowledgeUtils } from './dspy-knowledge-manager';

describe('DSPyKnowledgeManager', () => {
  let km: DSPyKnowledgeManager;

  beforeEach(() => {
    km = new DSPyKnowledgeManager({
      enableDSPyOptimization: true,
    });
  });

  afterEach(async () => {
    await km.shutdown();
  });

  describe('storeKnowledge', () => {
    it('should store knowledge successfully', async () => {
      const knowledge = knowledgeUtils.createKnowledge(
        'solution',
        'Fix TypeScript Import Error',
        {
          problem: 'Cannot find module',
          solution: 'Add proper export statement',
          code: 'export default MyComponent',
        },
        { tags: ['typescript', 'imports'] }
      );

      const id = await km.storeKnowledge(knowledge);
      expect(id).toBeTruthy();
      expect(id).toMatch(/^knowledge-/);
    });

    it('should enrich knowledge with DSPy when enabled', async () => {
      const knowledge = knowledgeUtils.createKnowledge('_pattern, 'React Hook Pattern', {
        _pattern 'Custom Hook',
        usage: 'Share stateful logic between components',
      });

      const id = await km.storeKnowledge(knowledge);
      const stored = await km.getKnowledge(id);

      expect(stored).toBeTruthy();
      expect(stored?.type).toBe('_pattern);
      expect(stored?.content.toBeTruthy();
    });
  });

  describe('searchKnowledge', () => {
    it('should search by type', async () => {
      // Store some test knowledge
      await km.storeKnowledge(
        knowledgeUtils.createKnowledge('solution', 'Test Solution', { solution: 'test' })
      );

      await km.storeKnowledge(
        knowledgeUtils.createKnowledge('_error, 'Test Error', { error: 'test' })
      );

      const results = await km.searchKnowledge({
        type: ['solution'],
      });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].type).toBe('solution');
      }
    });

    it('should search by content, async () => {
      const id = await km.storeKnowledge(
        knowledgeUtils.createKnowledge(
          'solution',
          'TypeScript Configuration',
          { config: 'tsconfig.json setup' },
          { tags: ['typescript', 'config'] }
        )
      );

      const results = await km.searchKnowledge({
        content_search: 'typescript',
      });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0].title.toLowerCase()).toContain('typescript');
      }
    });
  });

  describe('updateKnowledge', () => {
    it('should update existing knowledge', async () => {
      const id = await km.storeKnowledge(
        knowledgeUtils.createKnowledge('solution', 'Original Title', { content 'original' })
      );

      const updated = await km.updateKnowledge(id, {
        title: 'Updated Title',
        content { content 'updated' },
      });

      expect(updated).toBe(true);

      const knowledge = await km.getKnowledge(id);
      expect(knowledge?.title).toBe('Updated Title');
    });

    it('should evolve knowledge contentwith DSPy', async () => {
      const id = await km.storeKnowledge(
        knowledgeUtils.createKnowledge('_pattern, 'Design Pattern', {
          _pattern 'Observer',
          usage: 'Event handling',
        })
      );

      const updated = await km.updateKnowledge(id, {
        content { _pattern 'Observer', usage: 'Event handling', examples: ['DOM events'] },
      });

      expect(updated).toBe(true);
    });
  });

  describe('deleteKnowledge', () => {
    it('should delete knowledge', async () => {
      const id = await km.storeKnowledge(
        knowledgeUtils.createKnowledge('_error, 'Test Error', { error: 'to be deleted' })
      );

      const deleted = await km.deleteKnowledge(id);
      expect(deleted).toBe(true);

      const knowledge = await km.getKnowledge(id);
      expect(knowledge).toBeNull();
    });
  });

  describe('getRecommendations', () => {
    it('should get recommendations based on context', async () => {
      await km.storeKnowledge(
        knowledgeUtils.createKnowledge(
          'solution',
          'React Best Practices',
          { practices: ['hooks', 'components'] },
          { tags: ['react', 'best-practices'] }
        )
      );

      const recommendations = await km.getRecommendations({
        type: 'solution',
        tags: ['react'],
      });

      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('getMetrics', () => {
    it('should return knowledge metrics', async () => {
      await km.storeKnowledge(
        knowledgeUtils.createKnowledge('solution', 'Test Metric', { test: true, })
      );

      const metrics = await km.getMetrics();

      expect(metrics).toHaveProperty('total_items');
      expect(metrics).toHaveProperty('by_type');
      expect(metrics).toHaveProperty('average_confidence');
      expect(metrics.total_items).toBeGreaterThanOrEqual(1);
    });
  });

  describe('event emission', () => {
    it('should emit events on knowledge operations', async () => {
      let storedEvent: any = null;
      let updatedEvent: any = null;
      let deletedEvent: any = null;

      km.on('knowledge_stored', (event) => {
        storedEvent = event;
      });
      km.on('knowledge_updated', (event) => {
        updatedEvent = event;
      });
      km.on('knowledge_deleted', (event) => {
        deletedEvent = event;
      });

      // Store
      const id = await km.storeKnowledge(
        knowledgeUtils.createKnowledge('solution', 'Event Test', { test: true, })
      );
      expect(storedEvent).toBeTruthy();
      expect(storedEvent.id).toBe(id);

      // Update
      await km.updateKnowledge(id, { title: 'Updated Event Test' });
      expect(updatedEvent).toBeTruthy();
      expect(updatedEvent.id).toBe(id);

      // Delete
      await km.deleteKnowledge(id);
      expect(deletedEvent).toBeTruthy();
      expect(deletedEvent.id).toBe(id);
    });
  });
});
