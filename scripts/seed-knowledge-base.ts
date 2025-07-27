#!/usr/bin/env tsx
/**
 * Seed Knowledge Base with Test Data
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const testKnowledgeEntries = [
  {
    source: 'Stack Overflow',
    category: 'javascript',
    title: 'How to use React hooks useEffect for cleanup',
    content: `React useEffect cleanup is crucial for preventing memory leaks. When you return a function from useEffect, React will run it when the component unmounts or before re-running the effect. Example: useEffect(() => { const timer = setTimeout(() => {}, 1000); return () => clearTimeout(timer); }, []);`,
    metadata: { tags: ['react', 'hooks', 'useEffect', 'cleanup'] },
  },
  {
    source: 'Stack Overflow',
    category: 'javascript',
    title: 'Understanding async/await error handling in JavaScript',
    content: `Async/await error handling is done using try-catch blocks. When using async functions, wrap your await calls in try-catch to handle errors properly. Example: try { const result = await fetchData(); } catch (error) { console.error('Error:', error); }`,
    metadata: { tags: ['javascript', 'async', 'await', 'error-handling'] },
  },
  {
    source: 'MDN Web Docs',
    category: 'web-development',
    title: 'JavaScript Promises - MDN',
    content: `A Promise is an object representing the eventual completion or failure of an asynchronous operation. Promises provide a cleaner alternative to callbacks and enable better error handling with .catch() and async/await patterns.`,
    metadata: { tags: ['javascript', 'promises', 'async'] },
  },
  {
    source: 'Stack Overflow',
    category: 'react',
    title: 'React useState vs useReducer - when to use which?',
    content: `useState is perfect for simple state, while useReducer is better for complex state logic. Use useReducer when you have multiple sub-values, next state depends on previous state, or you need to optimize performance by passing dispatch down instead of callbacks.`,
    metadata: { tags: ['react', 'hooks', 'useState', 'useReducer'] },
  },
  {
    source: 'MDN Web Docs',
    category: 'javascript',
    title: 'Array.prototype.reduce() - JavaScript | MDN',
    content: `The reduce() method executes a reducer function on each element of the array, resulting in a single output value. It's powerful for transforming arrays into other data structures. Example: const sum = array.reduce((acc, val) => acc + val, 0);`,
    metadata: { tags: ['javascript', 'array', 'reduce', 'functional'] },
  },
  {
    source: 'Stack Overflow',
    category: 'nodejs',
    title: 'How to optimize database queries in Node.js',
    content: `Database query optimization in Node.js involves: 1) Using connection pooling, 2) Implementing proper indexing, 3) Batching queries when possible, 4) Using prepared statements, 5) Implementing caching strategies with Redis, 6) Monitoring query performance.`,
    metadata: { tags: ['nodejs', 'database', 'optimization', 'performance'] },
  },
  {
    source: 'Papers with Code',
    category: 'ai-ml',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    content: `BERT (Bidirectional Encoder Representations from Transformers) revolutionized NLP by pre-training deep bidirectional representations. It uses masked language modeling and next sentence prediction for pre-training, achieving state-of-the-art results on many NLP tasks.`,
    metadata: { tags: ['nlp', 'bert', 'transformers', 'deep-learning'] },
  },
  {
    source: 'Hugging Face',
    category: 'ai-models',
    title: 'sentence-transformers/all-MiniLM-L6-v2',
    content: `This is a sentence-transformers model that maps sentences to a 384 dimensional dense vector space. It's suitable for semantic search, clustering, and sentence similarity tasks. The model is efficient and performs well on various benchmarks.`,
    metadata: { tags: ['sentence-transformers', 'embeddings', 'nlp'] },
  },
  {
    source: 'Stack Overflow',
    category: 'react',
    title: 'React useEffect dependencies array explained',
    content: `The dependencies array in useEffect controls when the effect runs. Empty array [] means run once on mount, no array means run on every render, and specific dependencies mean run when those values change. Always include all values from component scope that change over time.`,
    metadata: { tags: ['react', 'useEffect', 'hooks', 'dependencies'] },
  },
  {
    source: 'MDN Web Docs',
    category: 'web-development',
    title: 'Fetch API - Web APIs | MDN',
    content: `The Fetch API provides a JavaScript interface for accessing and manipulating parts of the HTTP pipeline. It provides a more powerful and flexible feature set than XMLHttpRequest. Fetch returns promises and integrates well with async/await.`,
    metadata: { tags: ['javascript', 'fetch', 'api', 'http'] },
  },
];

async function seedKnowledgeBase() {
  console.log('🌱 Seeding knowledge base with test data...\n');

  for (const entry of testKnowledgeEntries) {
    try {
      // Generate a simple embedding (mock)
      const embedding = new Array(1536).fill(0).map(() => Math.random());

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          ...entry,
          embedding,
          timestamp: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ Failed to insert: ${entry.title}`, error);
      } else {
        console.log(`✅ Inserted: ${entry.title}`);
      }
    } catch (error) {
      console.error(`❌ Error inserting entry:`, error);
    }
  }

  // Check total count
  const { count } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true });

  console.log(`\n✅ Knowledge base now contains ${count} entries`);
}

seedKnowledgeBase().catch(console.error);