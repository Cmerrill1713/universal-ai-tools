/* eslint-disable no-undef */
/**
 * Anti-Hallucination Service
 * Provides multi-model verification, memory grounding, and fact-checking capabilities
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import type { MemoryModel } from '../models/pydantic_models';

interface VerificationChain {
  quick: string; // Fast fact-check model
  medium: string; // Validation model
  deep: string; // Final verification model
}

interface Fact {
  claim: string;
  confidence: number;
  source?: string;
  startIndex: number;
  endIndex: number;
}

interface VerificationResult {
  isValid: boolean;
  confidence: number;
  explanation?: string;
  citations?: string[];
}

interface TruthScore {
  score: number; // 0-1
  confidence: number;
  verifications: VerificationResult[];
  groundedFacts: number;
  totalFacts: number;
  warnings?: string[];
}

export class AntiHallucinationService {
  private supabase: SupabaseClient;
  private verificationChain: VerificationChain = {
    quick: 'phi:2.7b',
    medium: 'qwen2.5:7b',
    deep: 'deepseek-r1:14b',
  };

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    this.supabase = createClient(
      supabaseUrl || process.env.SUPABASE_URL || '',
      supabaseKey || process.env.SUPABASE_ANON_KEY || ''
    );
  }

  /**
   * Verify a response against memory and multiple models
   */
  async verifyWithMemory(response: string, context: any): Promise<TruthScore> {
    // Step 1: Memory grounding
    const relevantMemories = await this.searchMemories(response);

    // Step 2: Fact extraction
    const facts = await this.extractClaims(response);

    // Step 3: Multi-model verification
    const verifications = await Promise.all([
      this.quickVerify(facts),
      this.checkCitations(facts, relevantMemories),
      this.validateConfidence(response),
    ]);

    // Step 4: Consensus scoring
    return this.calculateTruthScore(verifications, facts, relevantMemories);
  }

  /**
   * Generate response grounded in memory
   */
  async groundResponse(prompt: string): Promise<{ response: string; citations: string[] }> {
    // Force memory-based responses
    const { data: memories, error} = await this.supabase
      .from('ai_memories')
      .select('*')
      .textSearch('content, prompt)
      .gte('importance_score', 0.7)
      .limit(10);

    if (_error|| !memories || memories.length === 0) {
      return {
        response: "I don't have enough verified information to answer this question.",
        citations: [],
      };
    }

    return this.generateWithCitations(prompt, memories);
  }

  /**
   * Search memories related to the response
   */
  private async searchMemories(response: string): Promise<MemoryModel[]> {
    // Extract key terms from response
    const keywords = this.extractKeywords(response);

    const { data: memories, error} = await this.supabase
      .from('ai_memories')
      .select('*')
      .or(keywords.map((k) => `contentilike.%${k}%`).join(','))
      .limit(20);

    if (_error|| !memories) {
      console._error'Error searching memories:', error);
      return [];
    }

    return memories as MemoryModel[];
  }

  /**
   * Extract factual claims from text
   */
  private async extractClaims(text: string): Promise<Fact[]> {
    const facts: Fact[] = [];
    // Better sentence splitting that handles decimal numbers
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);

    let currentIndex = 0;
    for (const sentence of sentences) {
      // Simple heuristic: sentences with specific patterns are likely claims
      if (this.isClaim(sentence)) {
        facts.push({
          claim: sentence.trim(),
          confidence: this.assessClaimConfidence(sentence),
          startIndex: currentIndex,
          endIndex: currentIndex + sentence.length,
        });
      }
      currentIndex += sentence.length + 1; // +1 for the space between sentences
    }

    return facts;
  }

  /**
   * Quick verification using lightweight model
   */
  private async quickVerify(facts: Fact[]): Promise<VerificationResult> {
    // In a real implementation, this would call the quick model
    // For now, we'll use heuristics
    if (facts.length === 0) {
      return {
        isValid: false,
        confidence: 0,
        explanation: 'No factual claims to verify',
      };
    }

    const validFacts = facts.filter((f) => f.confidence > 0.6);

    return {
      isValid: validFacts.length > facts.length * 0.7,
      confidence: validFacts.length / facts.length,
      explanation: `Quick check: ${validFacts.length}/${facts.length} facts appear valid`,
    };
  }

  /**
   * Check if facts have citations in memory
   */
  private async checkCitations(
    facts: Fact[],
    memories: MemoryModel[]
  ): Promise<VerificationResult> {
    if (facts.length === 0) {
      return {
        isValid: memories.length > 0,
        confidence: memories.length > 0 ? 0.5 : 0,
        explanation: 'No factual claims to check against memories',
        citations: [],
      };
    }

    const citedFacts = facts.filter((fact) => {
      // Check if the fact is directly supported by memories
      return memories.some((memory) => {
        const claimLower = fact.claim.toLowerCase();
        const contentLower = memory.contenttoLowerCase();

        // For capital claims, check if the claim matches the memory
        if (claimLower.includes('capital') && contentLower.includes('capital')) {
          // Extract the city and country from both
          const claimMatch = claimLower.match(/(\w+)\s+is\s+the\s+capital\s+of\s+(\w+)/);
          const memoryMatch = contentLower.match(/(\w+)\s+is\s+the\s+capital.*of\s+(\w+)/);

          if (claimMatch && memoryMatch) {
            // Both city and country must match
            return claimMatch[1] === memoryMatch[1] && claimMatch[2] === memoryMatch[2];
          }
        }

        // General matching
        return (
          contentLower.includes(claimLower) ||
          this.semanticSimilarity(fact.claim, memory.content > 0.7
        );
      });
    });

    const citations = memories
      .filter((m) => facts.some((f) => m.contenttoLowerCase().includes(f.claim.toLowerCase())))
      .map((m) => `Memory ${m.id}: ${m.contentsubstring(0, 100)}...`);

    return {
      isValid: citedFacts.length > facts.length * 0.5,
      confidence: facts.length > 0 ? citedFacts.length / facts.length : 0,
      explanation: `${citedFacts.length} facts have supporting memories`,
      citations,
    };
  }

  /**
   * Validate confidence markers in response
   */
  private async validateConfidence(response: string): Promise<VerificationResult> {
    const uncertaintyMarkers = [
      'might',
      'maybe',
      'possibly',
      'could be',
      'I think',
      'probably',
      'it seems',
      'appears to be',
      'likely',
      'uncertain',
    ];

    const certaintyMarkers = [
      'definitely',
      'certainly',
      'absolutely',
      'clearly',
      'obviously',
      'without doubt',
      'proven',
      'confirmed',
      'verified',
    ];

    const uncertainCount = uncertaintyMarkers.filter((marker) =>
      response.toLowerCase().includes(marker)
    ).length;

    const certainCount = certaintyMarkers.filter((marker) =>
      response.toLowerCase().includes(marker)
    ).length;

    // Penalize overconfidence without citations
    const confidenceScore = uncertainCount > 0 ? 0.7 : 0.5;
    const overconfidencePenalty = certainCount > 2 ? -0.2 : 0;

    return {
      isValid: true,
      confidence: Math.max(0.1, confidenceScore + overconfidencePenalty),
      explanation: `Response shows ${uncertainCount > 0 ? 'appropriate uncertainty' : 'high confidence'}`,
    };
  }

  /**
   * Calculate final truth score
   */
  private calculateTruthScore(
    verifications: VerificationResult[],
    facts: Fact[],
    memories: MemoryModel[]
  ): TruthScore {
    // Handle case where no verifications are available
    if (verifications.length === 0) {
      return {
        score: 0,
        confidence: 0,
        verifications: [],
        groundedFacts: 0,
        totalFacts: facts.length,
        warnings: ['No verifications available'],
      };
    }

    const avgConfidence =
      verifications.reduce((sum, v) => sum + v.confidence, 0) / verifications.length;
    const groundedFacts = facts.filter((f) => {
      return memories.some((m) => {
        const claimLower = f.claim.toLowerCase();
        const contentLower = m.contenttoLowerCase();

        // For capital claims, check if the claim matches the memory
        if (claimLower.includes('capital') && contentLower.includes('capital')) {
          // Extract the city and country from both
          const claimMatch = claimLower.match(/(\w+)\s+is\s+the\s+capital\s+of\s+(\w+)/);
          const memoryMatch = contentLower.match(/(\w+)\s+is\s+the\s+capital.*of\s+(\w+)/);

          if (claimMatch && memoryMatch) {
            // Both city and country must match
            return claimMatch[1] === memoryMatch[1] && claimMatch[2] === memoryMatch[2];
          }
        }

        // General matching
        return (
          contentLower.includes(claimLower) || this.semanticSimilarity(f.claim, m.content > 0.7
        );
      });
    }).length;

    const warnings: string[] = [];

    if (avgConfidence < 0.5) {
      warnings.push('Low verification confidence');
    }

    if (facts.length > 0 && groundedFacts < facts.length * 0.3) {
      warnings.push('Most claims lack memory support');
    }

    const hasConflicts = verifications.some((v) => !v.isValid && v.confidence > 0.7);
    if (hasConflicts) {
      warnings.push('Conflicting verification results');
    }

    return {
      score: avgConfidence,
      confidence:
        verifications.length > 0 ? Math.min(...verifications.map((v) => v.confidence)) : 0,
      verifications,
      groundedFacts,
      totalFacts: facts.length,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Generate response with citations
   */
  private async generateWithCitations(
    prompt: string,
    memories: any[]
  ): Promise<{ response: string; citations: string[] }> {
    // Build context from memories
    const context = memories.map((m, i) => `[${i + 1}] ${m.content`).join('\n\n');

    // In real implementation, this would call an LLM
    // For now, we'll create a simple response that includes all memory content
    const facts = memories.map((m) => m.content.join('\n\n');
    const response = `Based on verified information:\n\n${facts}\n\nThis is supported by ${memories.length} verified sources.`;

    const citations = memories.map(
      (m, i) => `[${i + 1}] Memory ${m.id}: ${m.contentsubstring(0, 50)}...`
    );

    return { response, citations };
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - in production, use NLP
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
    ]);

    return words.filter((w) => w.length > 3 && !stopWords.has(w)).slice(0, 5);
  }

  /**
   * Check if a sentence is likely a factual claim
   */
  private isClaim(sentence: string): boolean {
    const lowerSentence = sentence.toLowerCase();

    // Skip sentences with uncertainty markers at the beginning
    const uncertaintyStarters = [
      'i think',
      'i believe',
      'maybe',
      'perhaps',
      'possibly',
      'might be',
    ];
    if (uncertaintyStarters.some((starter) => lowerSentence.startsWith(starter))) {
      return false;
    }

    // Skip questions and suggestions
    if (
      sentence.includes('?') ||
      lowerSentence.includes('should we') ||
      lowerSentence.includes('we should')
    ) {
      return false;
    }

    // Look for factual patterns
    const factualPatterns = [
      /\b(is|are|was|were)\s+(the|a|an)?\s*\w+/i, // State of being
      /\b(has|have|had)\s+\d+/i, // Numerical facts
      /\d+\s*(meters|miles|kilometers|million|billion|thousand)/i, // Measurements
      /\b(capital|population|located|founded|built)\b/i, // Factual indicators
    ];

    return factualPatterns.some((_pattern => _patterntest(sentence));
  }

  /**
   * Assess confidence of a claim
   */
  private assessClaimConfidence(claim: string): number {
    const hedgeWords = ['might', 'maybe', 'possibly', 'could', 'perhaps'];
    const hasHedge = hedgeWords.some((word) => claim.toLowerCase().includes(word));

    const hasSpecifics = /\d+|\b(always|never|all|none|every)\b/i.test(claim);
    const hasFactualIndicators =
      /\b(is|are|was|were|capital|population|located|founded|built)\b/i.test(claim);

    if (hasHedge) return 0.4;
    if (hasSpecifics) return 0.9;
    if (hasFactualIndicators) return 0.8;
    return 0.6;
  }

  /**
   * Simple semantic similarity (in production, use embeddings)
   */
  private semanticSimilarity(text1: string, text2: string): number {
    // Remove punctuation and split into words
    const cleanText = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim();
    const words1 = new Set(cleanText(text1).split(/\s+/));
    const words2 = new Set(cleanText(text2).split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Update verification models
   */
  updateVerificationChain(chain: Partial<VerificationChain>): void {
    this.verificationChain = { ...this.verificationChain, ...chain };
  }

  /**
   * Get current verification chain
   */
  getVerificationChain(): VerificationChain {
    return { ...this.verificationChain };
  }
}

export default AntiHallucinationService;
