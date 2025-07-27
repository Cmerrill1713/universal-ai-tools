/* eslint-disable no-undef */
/**
 * Examples of using the DSPy-based Knowledge Manager
 */

import { DSPyKnowledgeManager, knowledgeUtils } from './dspy-knowledge-manager';

async function exampleUsage() {
  // Initialize the knowledge manager
  const km = new DSPyKnowledgeManager({
    enableDSPyOptimization: true,
  });

  // Example 1: Store a solution
  console.log('=== Example 1: Storing a Solution ===');
  const solutionId = await km.storeKnowledge(
    knowledgeUtils.createKnowledge(
      'solution',
      'Fix TypeScript Import Error',
      {
        problem: 'Cannot find module or its corresponding type declarations',
        solution: 'Ensure proper export/import statements and type definitions',
        steps: [
          'Check if the module is properly exported',
          'Verify the import path is correct',
          'Install @types package if needed',
          'Update tsconfig.json moduleResolution if necessary',
        ],
        code: {
          incorrect: "import Component from './component'",
          correct: "import { Component } from './component'",
        },
      },
      {
        tags: ['typescript', 'imports', 'modules'],
        confidence: 0.9,
      }
    )
  );
  console.log(`Stored solution with ID: ${solutionId}`);

  // Example 2: Store a pattern
  console.log('\n=== Example 2: Storing a Pattern ===');
  const patternId = await km.storeKnowledge(
    knowledgeUtils.createKnowledge(
      '_pattern,
      'React Custom Hook Pattern',
      {
        _pattern 'Custom Hook for Shared Logic',
        description: 'Extract component logic into reusable functions',
        benefits: [
          'Reuse stateful logic between components',
          'Keep components clean and focused',
          'Test logic independently',
        ],
        example: ``
          function useCounter(initialValue = 0) {
            const [count, setCount] = useState(initialValue);
            const increment = () => setCount(c => c + 1);
            const decrement = () => setCount(c => c - 1);
            return { count, increment, decrement };
          }
        `,
      },
      {
        tags: ['react', 'hooks', 'patterns', 'best-practices'],
      }
    )
  );
  console.log(`Stored_patternwith ID: ${patternId}`);

  // Example 3: Search knowledge
  console.log('\n=== Example 3: Searching Knowledge ===');
  const searchResults = await km.searchKnowledge({
    content_search: 'typescript',
    type: ['solution'],
    min_confidence: 0.8,
  });
  console.log(`Found ${searchResults.length} results for TypeScript solutions`);
  searchResults.forEach((item) => {
    console.log(`- ${item.title} (confidence: ${item.confidence})`);
  });

  // Example 4: Update knowledge with evolution
  console.log('\n=== Example 4: Evolving Knowledge ===');
  const updated = await km.updateKnowledge(solutionId, {
    content {
      problem: 'Cannot find module or its corresponding type declarations',
      solution: 'Ensure proper export/import statements and type definitions',
      steps: [
        'Check if the module is properly exported',
        'Verify the import path is correct',
        'Install @types package if needed',
        'Update tsconfig.json moduleResolution if necessary',
        'Consider using path aliases in tsconfig.json for cleaner imports',
      ],
      code: {
        incorrect: "import Component from './component'",
        correct: "import { Component } from './component'",
        withAlias "import { Component } from '@components/component'",
      },
      additionalNotes: 'Path aliases can significantly improve import readability',
    },
  });
  console.log(`Knowledge evolution successful: ${updated}`);

  // Example 5: Get recommendations
  console.log('\n=== Example 5: Getting Recommendations ===');
  const recommendations = await km.getRecommendations({
    type: '_pattern,
    tags: ['react'],
    search: 'performance',
  });
  console.log(`Found ${recommendations.length} recommended patterns`);

  // Example 6: Store_errorknowledge
  console.log('\n=== Example 6: Storing Error Knowledge ===');
  const errorId = await km.storeKnowledge(
    knowledgeUtils.createKnowledge(
      '_error,
      'React Hook Rules Violation',
      {
        error: 'React Hook "useState" is called conditionally',
        cause: 'Hooks must be called in the exact same order in every component render',
        solution: 'Move the hook call outside of conditional blocks',
        example: {
          wrong: ``
            if (condition) {
              const [state, setState] = useState(0);
            }
          `,
          correct: ``
            const [state, setState] = useState(0);
            if (condition) {
              // Use state here
            }
          `,
        },
      },
      {
        tags: ['react', 'hooks', 'errors', 'rules-of-hooks'],
        confidence: 0.95,
      }
    )
  );
  console.log(`Stored_errorknowledge with ID: ${errorId}`);

  // Example 7: Get metrics
  console.log('\n=== Example 7: Knowledge Metrics ===');
  const metrics = await km.getMetrics();
  console.log('Knowledge base metrics:');
  console.log(`- Total items: ${metrics.total_items}`);
  console.log(`- By type:`, metrics.by_type);`
  console.log(`- Average confidence: ${metrics.average_confidence.toFixed(2)}`);
  console.log(`- Total usage: ${metrics.total_usage}`);

  // Example 8: Event handling
  console.log('\n=== Example 8: Event Handling ===');
  km.on('knowledge_stored', (event) => {
    console.log(`📚 New knowledge stored: ${event.id} (${event.type})`);
  });

  km.on('knowledge_updated', (event) => {
    console.log(`📝 Knowledge updated: ${event.id}`);
  });

  km.on('knowledge_deleted', (event) => {
    console.log(`🗑️ Knowledge deleted: ${event.id}`);
  });

  // Clean up
  await km.shutdown();
  console.log('\n✅ Examples completed');
}

// Run examples if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console._error);
}

export { exampleUsage };
