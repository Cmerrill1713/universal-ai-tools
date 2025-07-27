import { AntiHallucinationService } from '../../../services/anti_hallucination_service';
import { createMockMemory } from '../../setup';

// Mock Supabase
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockOr = jest.fn();
const mockTextSearch = jest.fn();
const mockGte = jest.fn();
const mockLimit = jest.fn();

// Set up the chain
mockFrom.mockReturnValue({ select: mockSelect });
mockSelect.mockReturnValue({
  or: mockOr,
  textSearch: mockTextSearch,
});
mockOr.mockReturnValue({ limit: mockLimit });
mockTextSearch.mockReturnValue({ gte: mockGte });
mockGte.mockReturnValue({ limit: mockLimit });

const mockSupabaseClient = {
  from: mockFrom,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}));

describe('AntiHallucinationService', () => {
  let service: AntiHallucinationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AntiHallucinationService();
  });

  describe('extractClaims', () => {
    it('should extract factual claims from text', async () => {
      const text = 'Paris is the capital of France. The Eiffel Tower is 330 meters tall.';
      const claims = await service['extractClaims'](text);

      expect(claims).toHaveLength(2);
      expect(claims[0].claim).toContain('capital');
      expect(claims[1].claim).toContain('330 meters');
    });

    it('should handle empty text', async () => {
      const claims = await service['extractClaims']('');
      expect(claims).toHaveLength(0);
    });

    it('should filter out non-factual statements', async () => {
      const text =
        'I think Paris is nice. Maybe we should visit. The city has 2.1 million residents.';
      const claims = await service['extractClaims'](text);

      expect(claims).toHaveLength(1);
      expect(claims[0].claim).toContain('2.1 million residents');
    });
  });

  describe('searchMemories', () => {
    it('should search memories for relevant facts', async () => {
      const mockMemories = [
        createMockMemory({ content 'Paris is the capital of France' }),
        createMockMemory({ content 'London is the capital of UK' }),
      ];

      mockLimit.mockResolvedValueOnce({ data: mockMemories, error null });

      const results = await service['searchMemories']('capital of France');

      expect(results).toHaveLength(2);
      expect(results[0].content.toContain('Paris');
    });

    it('should handle search errors gracefully', async () => {
      mockLimit.mockResolvedValueOnce({ data: null, error new Error('Search failed') });

      const results = await service['searchMemories']('test query');
      expect(results).toHaveLength(0);
    });
  });

  describe('verifyWithMemory', () => {
    it('should verify truthful statements with high confidence', async () => {
      const truthfulText = 'Paris is the capital of France.';

      mockLimit.mockResolvedValue({
        data: [createMockMemory({ content 'Paris is the capital city of France' })],
        _error null,
      });

      const result = await service.verifyWithMemory(truthfulText, {
        userRequest: 'What is the capital of France?',
      });

      expect(result.score).toBeGreaterThan(0.6);
      expect(result.verifications).toBeDefined();
      expect(result.groundedFacts).toBeGreaterThan(0);
    });

    it('should flag false statements with low confidence', async () => {
      const falseText = 'London is the capital of France.';

      mockLimit.mockResolvedValue({
        data: [createMockMemory({ content 'Paris is the capital city of France' })],
        _error null,
      });

      const result = await service.verifyWithMemory(falseText, {
        userRequest: 'What is the capital of France?',
      });

      expect(result.score).toBeLessThanOrEqual(0.5);
      expect(result.verifications).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    it('should handle statements with no memory support', async () => {
      const unknownText = 'The quantum flux capacitor operates at 1.21 gigawatts.';

      mockLimit.mockResolvedValue({ data: [], error null });

      const result = await service.verifyWithMemory(unknownText, {
        userRequest: 'How does the quantum flux capacitor work?',
      });

      expect(result.score).toBeLessThan(0.5);
      expect(result.verifications).toBeDefined();
      expect(result.warnings).toBeDefined();
    });
  });

  describe('groundResponse', () => {
    it('should generate grounded response with citations', async () => {
      const mockMemories = [
        createMockMemory({
          content 'The Eiffel Tower is 330 meters tall',
          metadata: { source: 'Wikipedia' },
        }),
        createMockMemory({
          content 'The Eiffel Tower was built in 1889',
          metadata: { source: 'History Book' },
        }),
      ];

      mockLimit.mockResolvedValueOnce({ data: mockMemories, error null });

      const result = await service.groundResponse('Tell me about the Eiffel Tower');

      expect(result.response).toContain('330 meters');
      expect(result.response).toContain('1889');
      expect(result.citations).toHaveLength(2);
    });

    it('should indicate low confidence when no memories found', async () => {
      mockLimit.mockResolvedValueOnce({ data: [], error null });

      const result = await service.groundResponse('Tell me about quantum computing');

      expect(result.response).toContain("don't have");
      expect(result.citations).toHaveLength(0);
    });
  });

  describe('multiModelVerification', () => {
    it('should handle verification chain', () => {
      const chain = service.getVerificationChain();

      expect(chain.quick).toBeDefined();
      expect(chain.medium).toBeDefined();
      expect(chain.deep).toBeDefined();
    });

    it('should update verification chain', () => {
      const newChain = {
        quick: 'new-quick-model',
        medium: 'new-medium-model',
      };

      service.updateVerificationChain(newChain);
      const updated = service.getVerificationChain();

      expect(updated.quick).toBe('new-quick-model');
      expect(updated.medium).toBe('new-medium-model');
    });
  });

  describe('validateConfidence', () => {
    it('should detect uncertainty markers in text', async () => {
      const uncertainText = 'I think this might be correct, but maybe not.';
      const result = await service['validateConfidence'](uncertainText);

      expect(result.confidence).toBeLessThan(0.8);
      expect(result.explanation).toContain('uncertainty');
    });

    it('should not flag confident statements', async () => {
      const confidentText = 'The Earth orbits around the Sun.';
      const result = await service['validateConfidence'](confidentText);

      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('performance', () => {
    it('should complete verification within reasonable time', async () => {
      const startTime = Date.now();

      mockLimit.mockResolvedValue({ data: [], error null });

      await service.verifyWithMemory('Test statement', {});

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});
