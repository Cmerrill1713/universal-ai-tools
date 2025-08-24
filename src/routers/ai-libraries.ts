import { Router } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { EXPANDED_LIBRARIES } from '../data/expanded-libraries';
import { ADDITIONAL_LIBRARIES } from '../data/additional-reference-libraries';
import { BEAUTIFUL_FRONTEND_LIBRARIES } from '../data/beautiful-frontend-libraries';

const router = Router();

// Library data types
interface AILibrary {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
  stars: number;
  language: string;
  lastUpdated: string;
  homepage?: string;
  repository?: string;
  documentation?: string;
  installation: {
    spm?: string;
    cocoapods?: string;
    carthage?: string;
    npm?: string;
    pip?: string;
    cargo?: string;
  };
  features: string[];
  tags: string[];
  rating: number;
  downloads?: number;
  license?: string;
  maintainers?: string[];
  examples?: string[];
}

interface AIFramework {
  id: string;
  name: string;
  category: 'llm' | 'cv' | 'nlp' | 'ml' | 'dev-tools' | 'data' | 'deployment';
  description: string;
  stars: number;
  language: string[];
  platforms: string[];
  features: string[];
  setupInstructions: string[];
  documentation: string;
  repository: string;
  pricing: 'free' | 'freemium' | 'paid' | 'enterprise';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  rating: number;
  lastUpdated: string;
}

// Comprehensive AI Tools Database
const AI_LIBRARIES: AILibrary[] = [
  // Swift AI Libraries
  {
    id: 'swift-anthropic',
    name: 'SwiftAnthropic',
    display_name: 'SwiftAnthropic',
    description: 'Official Swift SDK for Anthropic Claude AI with async/await support and streaming',
    category: 'llm',
    stars: 234,
    language: 'Swift',
    lastUpdated: '2024-08-20',
    homepage: 'https://github.com/anthropics/anthropic-swift',
    repository: 'https://github.com/anthropics/anthropic-swift',
    documentation: 'https://docs.anthropic.com/claude/docs/swift-sdk',
    installation: {
      spm: '.package(url: "https://github.com/anthropics/anthropic-swift", from: "0.1.0")'
    },
    features: [
      'Async/await API',
      'Streaming responses',
      'Message history management',
      'Token counting',
      'Error handling',
      'Rate limiting support'
    ],
    tags: ['claude', 'anthropic', 'llm', 'ai', 'swift6', 'async'],
    rating: 4.8,
    downloads: 12000,
    license: 'MIT',
    maintainers: ['Anthropic'],
    examples: [
      'Basic chat completion',
      'Streaming conversations',
      'Function calling',
      'Image analysis'
    ]
  },
  {
    id: 'swift-openai',
    name: 'SwiftOpenAI',
    display_name: 'SwiftOpenAI',
    description: 'Community Swift package for OpenAI API with comprehensive feature support',
    category: 'llm',
    stars: 1200,
    language: 'Swift',
    lastUpdated: '2024-08-15',
    homepage: 'https://github.com/MacPaw/OpenAI',
    repository: 'https://github.com/MacPaw/OpenAI',
    documentation: 'https://github.com/MacPaw/OpenAI/blob/main/README.md',
    installation: {
      spm: '.package(url: "https://github.com/MacPaw/OpenAI", from: "0.2.9")'
    },
    features: [
      'GPT-4 and GPT-3.5 support',
      'DALL-E image generation',
      'Whisper transcription',
      'Embeddings',
      'Fine-tuning',
      'Function calling'
    ],
    tags: ['openai', 'gpt', 'dalle', 'whisper', 'swift', 'ai'],
    rating: 4.6,
    downloads: 25000,
    license: 'MIT'
  },
  {
    id: 'swift-nlp',
    name: 'NaturalLanguage',
    display_name: 'NaturalLanguage',
    description: 'Apple\'s built-in framework for natural language processing on iOS and macOS',
    category: 'nlp',
    stars: 0,
    language: 'Swift',
    lastUpdated: '2024-08-01',
    homepage: 'https://developer.apple.com/documentation/naturallanguage',
    documentation: 'https://developer.apple.com/documentation/naturallanguage',
    installation: {
      spm: 'import NaturalLanguage // Built-in Apple framework'
    },
    features: [
      'Language identification',
      'Tokenization',
      'Named entity recognition',
      'Sentiment analysis',
      'Part-of-speech tagging',
      'Custom model integration'
    ],
    tags: ['apple', 'nlp', 'native', 'coreml', 'builtin'],
    rating: 4.5,
    license: 'Apple'
  },
  {
    id: 'createml',
    name: 'CreateML',
    display_name: 'CreateML',
    description: 'Apple\'s machine learning framework for training custom models on macOS',
    category: 'ml_framework',
    stars: 0,
    language: 'Swift',
    lastUpdated: '2024-08-01',
    homepage: 'https://developer.apple.com/documentation/createml',
    documentation: 'https://developer.apple.com/documentation/createml',
    installation: {
      spm: 'import CreateML // Built-in Apple framework'
    },
    features: [
      'Image classification',
      'Text classification',
      'Tabular regression',
      'Sound classification',
      'Activity classification',
      'Transfer learning'
    ],
    tags: ['apple', 'ml', 'training', 'native', 'macos'],
    rating: 4.4,
    license: 'Apple'
  },
  {
    id: 'coreml',
    name: 'CoreML',
    display_name: 'CoreML',
    description: 'Apple\'s framework for integrating machine learning models into iOS and macOS apps',
    category: 'ml_framework',
    stars: 0,
    language: 'Swift',
    lastUpdated: '2024-08-01',
    homepage: 'https://developer.apple.com/documentation/coreml',
    documentation: 'https://developer.apple.com/documentation/coreml',
    installation: {
      spm: 'import CoreML // Built-in Apple framework'
    },
    features: [
      'On-device inference',
      'Hardware acceleration',
      'Model compression',
      'Batch predictions',
      'Custom layers',
      'Model encryption'
    ],
    tags: ['apple', 'ml', 'inference', 'native', 'performance'],
    rating: 4.7,
    license: 'Apple'
  },

  // Python AI Libraries
  {
    id: 'transformers',
    name: 'Transformers',
    display_name: 'Transformers',
    description: 'State-of-the-art machine learning library for PyTorch, TensorFlow, and JAX',
    category: 'ml_framework',
    stars: 125000,
    language: 'Python',
    lastUpdated: '2024-08-22',
    homepage: 'https://huggingface.co/transformers/',
    repository: 'https://github.com/huggingface/transformers',
    documentation: 'https://huggingface.co/docs/transformers',
    installation: {
      pip: 'pip install transformers[torch]'
    },
    features: [
      '100,000+ pre-trained models',
      'Multi-modal support',
      'Easy fine-tuning',
      'Production-ready',
      'Multi-framework support',
      'Distributed training'
    ],
    tags: ['huggingface', 'transformers', 'bert', 'gpt', 'llm', 'nlp'],
    rating: 4.9,
    downloads: 5000000,
    license: 'Apache-2.0'
  },
  {
    id: 'langchain',
    name: 'LangChain',
    display_name: 'LangChain',
    description: 'Framework for developing applications powered by language models',
    category: 'llm',
    stars: 87000,
    language: 'Python',
    lastUpdated: '2024-08-23',
    homepage: 'https://langchain.com/',
    repository: 'https://github.com/langchain-ai/langchain',
    documentation: 'https://docs.langchain.com/',
    installation: {
      pip: 'pip install langchain langchain-openai'
    },
    features: [
      'Chain composition',
      'Agent frameworks',
      'Memory management',
      'Document loading',
      'Vector databases',
      'Tool integration'
    ],
    tags: ['llm', 'chains', 'agents', 'rag', 'tools', 'memory'],
    rating: 4.7,
    downloads: 2000000,
    license: 'MIT'
  },

  // JavaScript/Node.js AI Libraries
  {
    id: 'tensorflow-js',
    name: 'TensorFlow.js',
    display_name: 'TensorFlow.js',
    description: 'Machine learning library for JavaScript and TypeScript in browsers and Node.js',
    category: 'ml_framework',
    stars: 18000,
    language: 'JavaScript',
    lastUpdated: '2024-08-20',
    homepage: 'https://www.tensorflow.org/js',
    repository: 'https://github.com/tensorflow/tfjs',
    documentation: 'https://www.tensorflow.org/js/guide',
    installation: {
      npm: 'npm install @tensorflow/tfjs'
    },
    features: [
      'Browser and Node.js support',
      'GPU acceleration',
      'Pre-trained models',
      'Transfer learning',
      'Custom training',
      'Model conversion'
    ],
    tags: ['tensorflow', 'ml', 'browser', 'nodejs', 'gpu'],
    rating: 4.5,
    downloads: 500000,
    license: 'Apache-2.0'
  },

  // Rust AI Libraries
  {
    id: 'candle',
    name: 'Candle',
    display_name: 'Candle',
    description: 'Minimalist ML framework for Rust with CUDA and Metal support',
    category: 'ml_framework',
    stars: 14000,
    language: 'Rust',
    lastUpdated: '2024-08-21',
    homepage: 'https://github.com/huggingface/candle',
    repository: 'https://github.com/huggingface/candle',
    documentation: 'https://huggingface.github.io/candle/',
    installation: {
      cargo: 'candle-core = "0.4.1"'
    },
    features: [
      'CUDA and Metal acceleration',
      'Transformer models',
      'ONNX support',
      'Quantization',
      'Server deployment',
      'Python bindings'
    ],
    tags: ['rust', 'ml', 'cuda', 'metal', 'performance', 'llm'],
    rating: 4.6,
    downloads: 15000,
    license: 'Apache-2.0'
  },
  
  // Merged expanded libraries from expanded-libraries.ts
  ...EXPANDED_LIBRARIES,
  
  // Additional reference libraries (Rust, Go, Local AI/ML, Apple platforms)
  ...ADDITIONAL_LIBRARIES,
  
  // Beautiful frontend libraries (React, Electron, TypeScript)
  ...BEAUTIFUL_FRONTEND_LIBRARIES
];

const AI_FRAMEWORKS: AIFramework[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    display_name: 'Ollama',
    category: 'llm',
    description: 'Get up and running with large language models locally',
    stars: 78000,
    language: ['Go'],
    platforms: ['macOS', 'Linux', 'Windows'],
    features: [
      'Local LLM hosting',
      'Model library',
      'API endpoints',
      'GPU acceleration',
      'Model management',
      'Custom models'
    ],
    setupInstructions: [
      'Download Ollama from ollama.ai',
      'Install the application',
      'Run "ollama serve" to start server',
      'Pull models with "ollama pull llama3.2"'
    ],
    documentation: 'https://ollama.ai/docs',
    repository: 'https://github.com/ollama/ollama',
    pricing: 'free',
    difficulty: 'beginner',
    rating: 4.8,
    lastUpdated: '2024-08-23'
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    display_name: 'LM Studio',
    category: 'llm',
    description: 'Discover, download, and run local LLMs with a user-friendly interface',
    stars: 0,
    language: ['Electron', 'C++'],
    platforms: ['macOS', 'Windows', 'Linux'],
    features: [
      'GUI interface',
      'Model browser',
      'Chat interface',
      'API server',
      'Hardware optimization',
      'Model quantization'
    ],
    setupInstructions: [
      'Download LM Studio from lmstudio.ai',
      'Install the application',
      'Browse and download models',
      'Start local server from settings'
    ],
    documentation: 'https://lmstudio.ai/docs',
    repository: 'https://lmstudio.ai',
    pricing: 'free',
    difficulty: 'beginner',
    rating: 4.7,
    lastUpdated: '2024-08-20'
  },
  {
    id: 'openai-api',
    name: 'OpenAI API',
    display_name: 'OpenAI API',
    category: 'llm',
    description: 'Access GPT-4, DALL-E, and Whisper through OpenAI\'s cloud API',
    stars: 0,
    language: ['REST API'],
    platforms: ['Cloud'],
    features: [
      'GPT-4 and GPT-3.5',
      'DALL-E image generation',
      'Whisper speech-to-text',
      'Function calling',
      'Fine-tuning',
      'Embeddings'
    ],
    setupInstructions: [
      'Sign up at platform.openai.com',
      'Generate API key',
      'Install SDK: pip install openai',
      'Set OPENAI_API_KEY environment variable'
    ],
    documentation: 'https://platform.openai.com/docs',
    repository: 'https://github.com/openai/openai-python',
    pricing: 'paid',
    difficulty: 'intermediate',
    rating: 4.6,
    lastUpdated: '2024-08-23'
  },
  {
    id: 'anthropic-claude',
    name: 'Anthropic Claude',
    display_name: 'Anthropic Claude',
    category: 'llm',
    description: 'Constitutional AI assistant with advanced reasoning capabilities',
    stars: 0,
    language: ['REST API'],
    platforms: ['Cloud'],
    features: [
      'Claude 3.5 Sonnet',
      'Large context windows',
      'Code generation',
      'Analysis and reasoning',
      'Safe and helpful responses',
      'Multiple languages'
    ],
    setupInstructions: [
      'Sign up at console.anthropic.com',
      'Generate API key',
      'Install SDK: pip install anthropic',
      'Set ANTHROPIC_API_KEY environment variable'
    ],
    documentation: 'https://docs.anthropic.com/',
    repository: 'https://github.com/anthropics/anthropic-sdk-python',
    pricing: 'paid',
    difficulty: 'intermediate',
    rating: 4.8,
    lastUpdated: '2024-08-23'
  }
];

// Validation schemas
const SearchQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20)
});

/**
 * GET /api/libraries/swift - Get Swift-specific AI libraries
 */
router.get('/swift', (req, res) => {
  try {
    const swiftLibraries = AI_LIBRARIES.filter(lib => lib.language === 'Swift');
    
    res.json({
      success: true,
      data: swiftLibraries,
      metadata: {
        total: swiftLibraries.length,
        categories: [...new Set(swiftLibraries.map(lib => lib.category))],
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching Swift libraries:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch Swift libraries',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/libraries/all - Get all AI libraries
 */
router.get('/all', (req, res) => {
  try {
    const { q, category, language, limit } = SearchQuerySchema.parse(req.query);
    
    let filtered = AI_LIBRARIES;
    
    // Apply filters
    if (category) {
      filtered = filtered.filter(lib => lib.category === category);
    }
    
    if (language) {
      filtered = filtered.filter(lib => lib.language.toLowerCase() === language.toLowerCase());
    }
    
    if (q) {
      const query = q.toLowerCase();
      filtered = filtered.filter(lib => 
        lib.name.toLowerCase().includes(query) ||
        lib.description.toLowerCase().includes(query) ||
        lib.tags.some(tag => tag.toLowerCase().includes(query)) ||
        lib.features.some(feature => feature.toLowerCase().includes(query))
      );
    }
    
    // Sort by rating and stars
    filtered = filtered
      .sort((a, b) => (b.rating * Math.log(b.stars + 1)) - (a.rating * Math.log(a.stars + 1)))
      .slice(0, limit);
    
    res.json({
      success: true,
      data: filtered,
      metadata: {
        total: filtered.length,
        query: { q, category, language, limit },
        categories: [...new Set(AI_LIBRARIES.map(lib => lib.category))],
        languages: [...new Set(AI_LIBRARIES.map(lib => lib.language))]
      }
    });
  } catch (error) {
    console.error('Error fetching libraries:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch libraries',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/libraries/frameworks - Get AI frameworks and platforms
 */
router.get('/frameworks', (req, res) => {
  try {
    const { category, difficulty } = req.query;
    
    let filtered = AI_FRAMEWORKS;
    
    if (category) {
      filtered = filtered.filter(fw => fw.category === category);
    }
    
    if (difficulty) {
      filtered = filtered.filter(fw => fw.difficulty === difficulty);
    }
    
    // Sort by rating and stars
    filtered = filtered.sort((a, b) => (b.rating * Math.log(b.stars + 1)) - (a.rating * Math.log(a.stars + 1)));
    
    res.json({
      success: true,
      data: filtered,
      metadata: {
        total: filtered.length,
        categories: [...new Set(AI_FRAMEWORKS.map(fw => fw.category))],
        difficulties: [...new Set(AI_FRAMEWORKS.map(fw => fw.difficulty))],
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching frameworks:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch frameworks',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/libraries/categories - Get library categories with counts
 */
router.get('/categories', (req, res) => {
  try {
    const categoryCounts = AI_LIBRARIES.reduce((acc, lib) => {
      acc[lib.category] = (acc[lib.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const categories = Object.entries(categoryCounts).map(([name, count]) => ({
      id: name,
      name,
      displayName: name.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' & '),
      count,
      description: getCategoryDescription(name)
    }));
    
    res.json({
      success: true,
      data: categories,
      metadata: {
        totalCategories: categories.length,
        totalLibraries: AI_LIBRARIES.length
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to fetch categories',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/libraries/discover - Intelligent library discovery
 */
router.get('/discover', async (req, res) => {
  try {
    const { intent, platform, difficulty = 'beginner' } = req.query as {
      intent?: string;
      platform?: string;
      difficulty?: string;
    };
    
    let recommendations: (AILibrary | AIFramework)[] = [];
    
    if (intent) {
      // AI-powered recommendations based on intent
      recommendations = await getIntelligentRecommendations(intent, platform, difficulty);
    } else {
      // Default curated recommendations
      recommendations = getCuratedRecommendations(platform, difficulty);
    }
    
    res.json({
      success: true,
      data: recommendations,
      metadata: {
        recommendationType: intent ? 'ai-powered' : 'curated',
        intent,
        platform,
        difficulty,
        count: recommendations.length
      }
    });
  } catch (error) {
    console.error('Error in library discovery:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to discover libraries',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/libraries/analyze - Analyze project for library recommendations
 */
router.post('/analyze', async (req, res) => {
  try {
    const { projectType, requirements, currentStack } = req.body;
    
    if (!projectType || !requirements) {
      return res.status(400).json({
        success: false,
        error: { message: 'projectType and requirements are required' }
      });
    }
    
    const analysis = await analyzeProjectRequirements(projectType, requirements, currentStack);
    
    res.json({
      success: true,
      data: analysis,
      metadata: {
        analysisType: 'project-requirements',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error analyzing project:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to analyze project requirements',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Helper functions

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    'ai-sdk': 'Software development kits for AI services and APIs',
    'ml-framework': 'Machine learning frameworks and libraries',
    'llm-framework': 'Large language model integration frameworks',
    'nlp': 'Natural language processing libraries',
    'ml-training': 'Machine learning model training frameworks',
    'ml-inference': 'Machine learning model inference engines',
    'cv': 'Computer vision and image processing libraries',
    'data': 'Data processing and manipulation tools',
    'deployment': 'Model deployment and serving platforms'
  };
  
  return descriptions[category] || 'AI/ML library category';
}

async function getIntelligentRecommendations(
  intent: string, 
  platform?: string, 
  difficulty?: string
): Promise<(AILibrary | AIFramework)[]> {
  // Simulate AI-powered recommendations
  // In a real implementation, this would use an LLM to analyze the intent
  
  const keywords = intent.toLowerCase();
  const recommendations: (AILibrary | AIFramework)[] = [];
  
  // Add relevant libraries based on keywords
  if (keywords.includes('swift') || keywords.includes('ios') || keywords.includes('macos')) {
    recommendations.push(...AI_LIBRARIES.filter(lib => lib.language === 'Swift'));
  }
  
  if (keywords.includes('local') || keywords.includes('offline') || keywords.includes('privacy')) {
    recommendations.push(...AI_FRAMEWORKS.filter(fw => fw.pricing === 'free' && fw.id === 'ollama'));
  }
  
  if (keywords.includes('image') || keywords.includes('vision')) {
    recommendations.push(...AI_LIBRARIES.filter(lib => lib.tags.includes('cv') || lib.category === 'cv'));
  }
  
  if (keywords.includes('chat') || keywords.includes('conversation')) {
    recommendations.push(...AI_FRAMEWORKS.filter(fw => fw.category === 'llm'));
  }
  
  return recommendations.slice(0, 10);
}

function getCuratedRecommendations(platform?: string, difficulty?: string): (AILibrary | AIFramework)[] {
  let recommendations: (AILibrary | AIFramework)[] = [];
  
  if (platform === 'swift' || platform === 'ios' || platform === 'macos') {
    recommendations = [
      ...AI_LIBRARIES.filter(lib => lib.language === 'Swift'),
      AI_FRAMEWORKS.find(fw => fw.id === 'ollama')!
    ];
  } else {
    // General recommendations
    recommendations = [
      AI_FRAMEWORKS.find(fw => fw.id === 'ollama')!,
      AI_FRAMEWORKS.find(fw => fw.id === 'openai-api')!,
      AI_LIBRARIES.find(lib => lib.id === 'langchain')!,
      AI_LIBRARIES.find(lib => lib.id === 'transformers')!
    ].filter(Boolean);
  }
  
  if (difficulty === 'beginner') {
    recommendations = recommendations.filter(item => 
      'difficulty' in item ? item.difficulty === 'beginner' : item.rating >= 4.5
    );
  }
  
  return recommendations;
}

async function analyzeProjectRequirements(
  projectType: string, 
  requirements: string[], 
  currentStack?: string[]
): Promise<{
  recommendations: (AILibrary | AIFramework)[];
  reasoning: string[];
  integrationComplexity: 'low' | 'medium' | 'high';
  estimatedCost: string;
}> {
  const recommendations: (AILibrary | AIFramework)[] = [];
  const reasoning: string[] = [];
  let integrationComplexity: 'low' | 'medium' | 'high' = 'medium';
  
  // Analyze requirements
  if (requirements.includes('chat') || requirements.includes('conversation')) {
    recommendations.push(AI_FRAMEWORKS.find(fw => fw.id === 'ollama')!);
    reasoning.push('Added local LLM solution for chat functionality');
  }
  
  if (requirements.includes('image-generation') || requirements.includes('visual-content')) {
    recommendations.push(AI_FRAMEWORKS.find(fw => fw.id === 'openai-api')!);
    reasoning.push('OpenAI API recommended for DALL-E image generation');
  }
  
  if (currentStack?.includes('swift') || projectType === 'ios' || projectType === 'macos') {
    recommendations.push(...AI_LIBRARIES.filter(lib => lib.language === 'Swift').slice(0, 3));
    reasoning.push('Added Swift-native AI libraries for seamless integration');
  }
  
  // Determine complexity
  if (recommendations.length <= 2) {
    integrationComplexity = 'low';
  } else if (recommendations.length > 4) {
    integrationComplexity = 'high';
  }
  
  // Estimate cost
  const hasPaidServices = recommendations.some(item => 
    'pricing' in item && item.pricing === 'paid'
  );
  const estimatedCost = hasPaidServices ? '$20-100/month' : 'Free tier available';
  
  return {
    recommendations: recommendations.filter(Boolean),
    reasoning,
    integrationComplexity,
    estimatedCost
  };
}

// Export libraries for scraping script
export const AI_LIBRARIES_EXPORT = AI_LIBRARIES;
export const swiftLibraries = AI_LIBRARIES.filter(lib => lib.language === 'Swift');
export const aiFrameworks = AI_LIBRARIES.filter(lib => lib.language !== 'Swift');

export default router;