import Logger from '../renderer/utils/logger';
/**
 * ArXiv Research Tool for Universal AI Tools
 * Intelligent paper discovery and analysis system
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as xml2js from 'xml2js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Advanced ArXiv Research Tool
 */
export class ArXivResearchTool {
  private apiBase = 'http://export.arxiv.org/api/query';
  private lastRequest = 0;
  private rateLimit = 3000; // 3 seconds between requests

  /**
   * Research trending topics in AI/ML
   */
  async researchTrendingTopics(): Promise<TrendingResearch> {
    const categories = ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV', 'cs.NE'];
    const trends: TrendingResearch = {
      timestamp: new Date().toISOString(),
      categories: {},
      topPapers: [],
      emergingTopics: [],
    };

    for (const category of categories) {
      await this.enforceRateLimit();

      const papers = await this.searchCategory(category, 10);
      trends.categories[category] = {
        name: this.getCategoryName(category),
        paperCount: papers.length,
        topPapers: papers.slice(0, 3).map(p => ({
          title: p.title,
          authors: p.authors,
          abstract: p.summary?.substring(0, 200) + '...',
          link: p.link,
        })),
      };

      trends.topPapers.push(...papers.slice(0, 2));
    }

    // Identify emerging topics from abstracts
    trends.emergingTopics = this.extractEmergingTopics(trends.topPapers);

    // Store research in Supabase
    await this.storeResearch(trends);

    return trends;
  }

  /**
   * Research papers related to Universal AI Tools concepts
   */
  async researchUniversalAITopics(): Promise<any[]> {
    const queries = [
      'all:"local first" AND (AI OR "machine learning")',
      'all:"multi agent" AND "orchestration"',
      'all:"knowledge graph" AND "retrieval augmented generation"',
      'all:"memory optimization" AND "machine learning"',
      'all:"hybrid architecture" AND (AI OR LLM)',
    ];

    const relevantPapers: any[] = [];

    for (const query of queries) {
      await this.enforceRateLimit();
      const papers = await this.search(query, 5);
      relevantPapers.push(...papers);
    }

    return relevantPapers;
  }

  /**
   * Get latest papers on specific programming languages
   */
  async researchProgrammingLanguages(languages: string[]): Promise<LanguageResearch> {
    const research: LanguageResearch = {
      timestamp: new Date().toISOString(),
      languages: {},
    };

    for (const language of languages) {
      await this.enforceRateLimit();

      const query = `all:"${language}" AND (programming OR development OR compiler)`;
      const papers = await this.search(query, 5);

      research.languages[language] = {
        paperCount: papers.length,
        topics: this.extractTopics(papers),
        recentPapers: papers.map(p => ({
          title: p.title,
          date: p.published,
          category: p.category,
          link: p.link,
        })),
      };
    }

    return research;
  }

  /**
   * Build knowledge graph from papers
   */
  async buildKnowledgeGraph(topic: string, _depth: number = 2): Promise<KnowledgeGraph> {
    const graph: KnowledgeGraph = {
      nodes: [],
      edges: [],
      topic,
      timestamp: new Date().toISOString(),
    };

    // Get initial papers
    const papers = await this.search(`all:"${topic}"`, 10);

    // Add paper nodes
    for (const paper of papers) {
      graph.nodes.push({
        id: paper.id,
        type: 'paper',
        title: paper.title,
        authors: paper.authors,
        category: paper.category,
        year: new Date(paper.published).getFullYear(),
      });

      // Add author nodes
      for (const author of paper.authors) {
        const authorId = `author_${author.replace(/\s/g, '_')}`;
        if (!graph.nodes.find(n => n.id === authorId)) {
          graph.nodes.push({
            id: authorId,
            type: 'author',
            name: author,
          });
        }

        // Add authorship edges
        graph.edges.push({
          source: authorId,
          target: paper.id,
          type: 'authored',
          weight: 1,
        });
      }

      // Extract and add concept nodes
      const concepts = this.extractConcepts(paper.summary);
      for (const concept of concepts) {
        const conceptId = `concept_${concept.replace(/\s/g, '_')}`;
        if (!graph.nodes.find(n => n.id === conceptId)) {
          graph.nodes.push({
            id: conceptId,
            type: 'concept',
            name: concept,
          });
        }

        // Add concept edges
        graph.edges.push({
          source: paper.id,
          target: conceptId,
          type: 'discusses',
          weight: 1,
        });
      }
    }

    return graph;
  }

  /**
   * Search ArXiv with rate limiting
   */
  private async search(query: string, maxResults: number = 10): Promise<any[]> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      search_query: query,
      start: '0',
      max_results: maxResults.toString(),
      sortBy: 'submittedDate',
      sortOrder: 'descending',
    });

    const response = await fetch(`${this.apiBase}?${params}`, {
      headers: {
        'User-Agent': 'UniversalAITools/1.0 Research Bot',
      },
    });

    if (!response.ok) {
      throw new Error(`ArXiv API _error: ${response.status}`);
    }

    const xml = await response.text();
    return this.parseXML(xml);
  }

  /**
   * Search by category
   */
  private async searchCategory(category: string, maxResults: number): Promise<any[]> {
    return this.search(`cat:${category}`, maxResults);
  }

  /**
   * Parse ArXiv XML response
   */
  private async parseXML(xml: string): Promise<any[]> {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xml);

    if (!result.feed?.entry) return [];

    const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];

    return entries.map(entry => ({
      id: entry.id,
      title: entry.title?.replace(/\s+/g, ' ').trim(),
      summary: entry.summary?.replace(/\s+/g, ' ').trim(),
      authors: this.extractAuthors(entry.author),
      published: entry.published,
      updated: entry.updated,
      category: entry['arxiv:primary_category']?.$.term,
      link: entry.link?.find((l: unknown) => l.$.type === 'text/html')?.$.href || entry.id,
      pdfLink: entry.link?.find((l: unknown) => l.$.title === 'pdf')?.$.href,
    }));
  }

  /**
   * Extract author names
   */
  private extractAuthors(author: unknown): string[] {
    if (!author) return [];
    const authors = Array.isArray(author) ? author : [author];
    return authors.map(a => a.name || '').filter(Boolean);
  }

  /**
   * Extract concepts from abstract
   */
  private extractConcepts(abstract: string): string[] {
    if (!abstract) return [];

    // Simple concept extraction - in production, use NLP
    const concepts = [];
    const keywords = [
      'neural network',
      'transformer',
      'attention',
      'embedding',
      'optimization',
      'gradient',
      'loss function',
      'training',
      'inference',
      'dataset',
      'benchmark',
      'evaluation',
      'architecture',
      'model',
      'algorithm',
      'framework',
    ];

    const lowerAbstract = abstract.toLowerCase();
    for (const keyword of keywords) {
      if (lowerAbstract.includes(keyword)) {
        concepts.push(keyword);
      }
    }

    return concepts.slice(0, 5);
  }

  /**
   * Extract topics from papers
   */
  private extractTopics(papers: any[]): string[] {
    const topics = new Set<string>();

    for (const paper of papers) {
      const concepts = this.extractConcepts(paper.summary);
      concepts.forEach(c => topics.add(c));
    }

    return Array.from(topics).slice(0, 10);
  }

  /**
   * Extract emerging topics
   */
  private extractEmergingTopics(papers: any[]): string[] {
    // Simplified emerging topic detection
    const recentKeywords = [
      'multimodal',
      'vision language',
      'diffusion',
      'mamba',
      'mixture of experts',
      'chain of thought',
      'constitutional ai',
      'retrieval augmented',
      'tool use',
      'agent',
      'reasoning',
    ];

    const found = new Set<string>();

    for (const paper of papers) {
      const text = (paper.title + ' ' + paper.summary).toLowerCase();
      for (const keyword of recentKeywords) {
        if (text.includes(keyword)) {
          found.add(keyword);
        }
      }
    }

    return Array.from(found);
  }

  /**
   * Get category full name
   */
  private getCategoryName(category: string): string {
    const names: Record<string, string> = {
      'cs.AI': 'Artificial Intelligence',
      'cs.LG': 'Machine Learning',
      'cs.CL': 'Computation and Language',
      'cs.CV': 'Computer Vision',
      'cs.NE': 'Neural and Evolutionary Computing',
    };
    return names[category] || category;
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.rateLimit) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimit - elapsed));
    }

    this.lastRequest = Date.now();
  }

  /**
   * Store research in Supabase
   */
  private async storeResearch(research: unknown): Promise<void> {
    try {
      const { _error } = await supabase.from('context_storage').insert({
        category: 'code_patterns',
        source: 'arxiv-research-tool',
        content: JSON.stringify(research),
        metadata: {
          type: 'arxiv_research',
          timestamp: new Date().toISOString(),
          papers_analyzed: research.topPapers?.length || 0,
        },
        user_id: 'system',
      });

      if (_error) {
        if (process.env.NODE_ENV === 'development') {
          Logger.error('Error storing research:', _error);
        }
      }
    } catch (err) {
      Logger.error('Failed to store research:', err);
    }
  }
}

// Type definitions
interface TrendingResearch {
  timestamp: string;
  categories: Record<
    string,
    {
      name: string;
      paperCount: number;
      topPapers: any[];
    }
  >;
  topPapers: any[];
  emergingTopics: string[];
}

interface LanguageResearch {
  timestamp: string;
  languages: Record<
    string,
    {
      paperCount: number;
      topics: string[];
      recentPapers: any[];
    }
  >;
}

interface KnowledgeGraph {
  nodes: Array<{
    id: string;
    type: 'paper' | 'author' | 'concept';
    [key: string]: unknown;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    weight: number;
  }>;
  topic: string;
  timestamp: string;
}

// Demonstration function
async function demonstrateResearchTool() {
  const tool = new ArXivResearchTool();

  if (process.env.NODE_ENV === 'development') {
    Logger.debug('🔬 ArXiv Research Tool Demonstration');
  }
  Logger.debug('=====================================\n');

  try {
    // 1. Research trending AI topics
    Logger.debug('1. Researching trending AI/ML topics...');
    const trends = await tool.researchTrendingTopics();
    Logger.debug(`Found ${trends.emergingTopics.length} emerging topics:`);
    trends.emergingTopics.forEach(topic => {
      Logger.debug(`  - ${topic}`);
    });
    Logger.debug();

    // 2. Research Universal AI Tools related papers
    Logger.debug('2. Finding papers related to Universal AI Tools concepts...');
    const uatPapers = await tool.researchUniversalAITopics();
    Logger.debug(`Found ${uatPapers.length} relevant papers`);
    if (uatPapers.length > 0) {
      Logger.debug('Sample relevant papers:');
      uatPapers.slice(0, 3).forEach(paper => {
        Logger.debug(`  - ${paper.title}`);
      });
    }
    Logger.debug();

    // 3. Research programming language papers
    Logger.debug('3. Researching top programming languages in academia...');
    const languages = ['Python', 'Rust', 'TypeScript'];
    const langResearch = await tool.researchProgrammingLanguages(languages);
    for (const lang of languages) {
      const data = langResearch.languages[lang];
      Logger.debug(
        `  ${lang}: ${data.paperCount} papers, topics: ${data.topics.slice(0, 3).join(', ')}`
      );
    }
    Logger.debug();

    // 4. Build knowledge graph
    Logger.debug('4. Building knowledge graph for "transformer architecture"...');
    const graph = await tool.buildKnowledgeGraph('transformer architecture', 1);
    Logger.debug(`Knowledge graph created:`);
    Logger.debug(`  - Nodes: ${graph.nodes.length} (papers, authors, concepts)`);
    Logger.debug(`  - Edges: ${graph.edges.length} (relationships)`);
    Logger.debug(
      `  - Concepts found: ${graph.nodes
        .filter(n => n.type === 'concept')
        .map(n => n.name)
        .join(', ')}`
    );
  } catch (_error) {
    Logger.error('Research tool _error:', _error);
  }
}

// Export for use
export { demonstrateResearchTool };

// Run if called directly
if (require.main === module) {
  demonstrateResearchTool();
}
