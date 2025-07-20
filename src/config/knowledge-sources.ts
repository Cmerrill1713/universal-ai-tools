/**
 * Knowledge Source Configuration
 * Defines external sources for continuous learning and knowledge updates
 */

export interface KnowledgeSource {
  id: string;
  name: string;
  type: 'rss' | 'api' | 'scraper' | 'github' | 'forum';
  url: string;
  updateFrequency: string; // cron expression
  categories: string[];
  priority: 'high' | 'medium' | 'low';
  credibilityScore: number; // 0-1
  enabled: boolean;
  authentication?: {
    type: 'api_key' | 'oauth' | 'basic';
    credentials: Record<string, string>;
  };
  scrapeConfig?: {
    selectors: Record<string, string>;
    paginate?: boolean;
    rateLimit?: number; // requests per minute
  };
}

export const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
  // Supabase Documentation
  {
    id: 'supabase-docs',
    name: 'Supabase Official Documentation',
    type: 'scraper',
    url: 'https://supabase.com/docs',
    updateFrequency: '0 2 * * *', // Daily at 2 AM
    categories: ['database', 'authentication', 'realtime', 'storage'],
    priority: 'high',
    credibilityScore: 1.0,
    enabled: true,
    scrapeConfig: {
      selectors: {
        content: '.docs-content',
        title: 'h1',
        lastUpdated: '.last-updated',
        codeBlocks: 'pre code'
      },
      paginate: true,
      rateLimit: 30
    }
  },

  // Apollo GraphQL Documentation
  {
    id: 'apollo-docs',
    name: 'Apollo GraphQL Documentation',
    type: 'scraper',
    url: 'https://www.apollographql.com/docs',
    updateFrequency: '0 3 * * *', // Daily at 3 AM
    categories: ['graphql', 'api', 'federation', 'caching'],
    priority: 'high',
    credibilityScore: 1.0,
    enabled: true,
    scrapeConfig: {
      selectors: {
        content: '.content-wrapper',
        title: 'h1',
        codeBlocks: 'pre code'
      },
      paginate: true,
      rateLimit: 30
    }
  },

  // AI Research Papers (ArXiv)
  {
    id: 'arxiv-ai',
    name: 'ArXiv AI Research Papers',
    type: 'api',
    url: 'http://export.arxiv.org/api/query',
    updateFrequency: '0 */6 * * *', // Every 6 hours
    categories: ['ai', 'machine-learning', 'nlp', 'computer-vision'],
    priority: 'medium',
    credibilityScore: 0.9,
    enabled: true,
    authentication: {
      type: 'api_key',
      credentials: {
        query: 'cat:cs.AI OR cat:cs.LG OR cat:cs.CL'
      }
    }
  },

  // GitHub Trending Repositories
  {
    id: 'github-trending',
    name: 'GitHub Trending AI/ML Repositories',
    type: 'github',
    url: 'https://api.github.com/search/repositories',
    updateFrequency: '0 */12 * * *', // Every 12 hours
    categories: ['frameworks', 'tools', 'libraries', 'examples'],
    priority: 'medium',
    credibilityScore: 0.8,
    enabled: true,
    authentication: {
      type: 'api_key',
      credentials: {
        token: process.env.GITHUB_TOKEN || ''
      }
    }
  },

  // Stack Overflow AI Tags
  {
    id: 'stackoverflow-ai',
    name: 'Stack Overflow AI Questions',
    type: 'api',
    url: 'https://api.stackexchange.com/2.3/questions',
    updateFrequency: '0 */4 * * *', // Every 4 hours
    categories: ['troubleshooting', 'best-practices', 'community'],
    priority: 'low',
    credibilityScore: 0.7,
    enabled: true,
    authentication: {
      type: 'api_key',
      credentials: {
        key: process.env.STACKOVERFLOW_API_KEY || ''
      }
    }
  },

  // Reddit AI Communities
  {
    id: 'reddit-ai',
    name: 'Reddit AI Communities',
    type: 'api',
    url: 'https://www.reddit.com/r/MachineLearning+LocalLLaMA+artificial.json',
    updateFrequency: '0 */8 * * *', // Every 8 hours
    categories: ['community', 'discussions', 'trends'],
    priority: 'low',
    credibilityScore: 0.6,
    enabled: true
  },

  // Hugging Face Model Updates
  {
    id: 'huggingface-models',
    name: 'Hugging Face Model Hub',
    type: 'api',
    url: 'https://huggingface.co/api/models',
    updateFrequency: '0 0 * * 0', // Weekly on Sunday
    categories: ['models', 'transformers', 'datasets'],
    priority: 'medium',
    credibilityScore: 0.9,
    enabled: true
  },

  // OpenAI Blog
  {
    id: 'openai-blog',
    name: 'OpenAI Blog and Research',
    type: 'rss',
    url: 'https://openai.com/blog/rss.xml',
    updateFrequency: '0 */12 * * *', // Every 12 hours
    categories: ['research', 'announcements', 'best-practices'],
    priority: 'high',
    credibilityScore: 1.0,
    enabled: true
  },

  // Google AI Blog
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    type: 'rss',
    url: 'https://ai.googleblog.com/feeds/posts/default',
    updateFrequency: '0 */12 * * *', // Every 12 hours
    categories: ['research', 'tools', 'announcements'],
    priority: 'high',
    credibilityScore: 1.0,
    enabled: true
  },

  // LangChain Documentation
  {
    id: 'langchain-docs',
    name: 'LangChain Documentation',
    type: 'scraper',
    url: 'https://python.langchain.com/docs/get_started/introduction',
    updateFrequency: '0 4 * * *', // Daily at 4 AM
    categories: ['agents', 'chains', 'tools', 'memory'],
    priority: 'high',
    credibilityScore: 0.9,
    enabled: true,
    scrapeConfig: {
      selectors: {
        content: '.markdown',
        title: 'h1',
        codeBlocks: 'pre code'
      },
      paginate: true,
      rateLimit: 20
    }
  }
];

// Validation rules for different content types
export const CONTENT_VALIDATION_RULES = {
  codeSnippet: {
    minLength: 10,
    maxLength: 10000,
    requiredPatterns: [/\w+/],
    forbiddenPatterns: [/eval\(/, /exec\(/]
  },
  documentation: {
    minLength: 50,
    maxLength: 50000,
    requiredSections: ['description', 'usage'],
    qualityChecks: ['grammar', 'clarity', 'completeness']
  },
  research: {
    minLength: 100,
    requiredMetadata: ['authors', 'date', 'abstract'],
    citationThreshold: 5 // minimum citations for inclusion
  }
};

// Knowledge categories and their relationships
export const KNOWLEDGE_TAXONOMY = {
  categories: {
    'database': ['supabase', 'postgresql', 'vector-db', 'migrations'],
    'ai': ['llm', 'embeddings', 'agents', 'prompts'],
    'api': ['rest', 'graphql', 'websocket', 'grpc'],
    'frontend': ['react', 'vue', 'state-management', 'ui-components'],
    'backend': ['nodejs', 'python', 'microservices', 'serverless'],
    'devops': ['docker', 'kubernetes', 'ci-cd', 'monitoring'],
    'security': ['authentication', 'authorization', 'encryption', 'compliance']
  },
  relationships: {
    'database': ['api', 'backend', 'security'],
    'ai': ['api', 'backend', 'frontend'],
    'frontend': ['api', 'security'],
    'backend': ['database', 'api', 'security', 'devops']
  }
};