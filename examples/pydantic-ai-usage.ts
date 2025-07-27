/**
 * Example usage of Pydantic AI Service
 * Demonstrates type-safe AI interactions with structured validation
 */

import { z } from 'zod';
import { pydanticAI } from '../src/services/pydantic-ai-service';

// ============================================
// EXAMPLE 1: Basic AI Request
// ============================================

async function basicAIRequest() {
  console.log('=== Basic AI Request ===');
  
  const response = await pydanticAI.request({
    prompt: 'Explain quantum computing in simple terms',
    context: {
      temperature: 0.7,
      maxTokens: 500
    }
  });

  if (response.success) {
    console.log('Response:', response.content);
    console.log('Confidence:', response.confidence);
    console.log('Agents involved:', response.metadata.agentsInvolved);
  }
}

// ============================================
// EXAMPLE 2: Cognitive Analysis
// ============================================

async function cognitiveAnalysis() {
  console.log('\n=== Cognitive Analysis ===');
  
  const text = `
    The new product launch exceeded expectations with a 150% increase in sales.
    However, customer support tickets have also increased by 40%, mainly about
    setup difficulties. The marketing team suggests creating video tutorials.
  `;

  const analysis = await pydanticAI.analyzeCognitive(text);
  
  console.log('Key Insights:');
  analysis.keyInsights.forEach(insight => console.log(`- ${insight}`));
  
  console.log('\nRecommendations:');
  analysis.recommendations.forEach(rec => {
    console.log(`- ${rec.action} (Priority: ${rec.priority})`);
    console.log(`  Reasoning: ${rec.reasoning}`);
  });
  
  console.log('\nSentiment:', analysis.sentiment);
  console.log('Entities found:', analysis.entities.map(e => e.name));
}

// ============================================
// EXAMPLE 3: Task Planning
// ============================================

async function taskPlanning() {
  console.log('\n=== Task Planning ===');
  
  const plan = await pydanticAI.planTask(
    'Create a REST API for user management with authentication',
    {
      framework: 'Express.js',
      database: 'PostgreSQL',
      timeConstraint: '1 week'
    }
  );

  console.log(`Objective: ${plan.objective}`);
  console.log(`Total estimated time: ${plan.totalEstimatedTime} minutes`);
  console.log(`Required agents: ${plan.requiredAgents.join(', ')}`);
  
  console.log('\nSteps:');
  plan.steps.forEach(step => {
    console.log(`${step.id}. ${step.description}`);
    console.log(`   Agent: ${step.agent}`);
    console.log(`   Duration: ${step.estimatedDuration} min`);
    if (step.dependencies.length > 0) {
      console.log(`   Dependencies: ${step.dependencies.join(', ')}`);
    }
  });
  
  console.log('\nRisks:');
  plan.risks.forEach(risk => {
    console.log(`- ${risk.description} (${risk.likelihood} likelihood)`);
    console.log(`  Mitigation: ${risk.mitigation}`);
  });
}

// ============================================
// EXAMPLE 4: Code Generation
// ============================================

async function codeGeneration() {
  console.log('\n=== Code Generation ===');
  
  const code = await pydanticAI.generateCode(
    'Create a function to validate email addresses with proper error handling',
    'typescript',
    {
      includeTests: true,
      analyzeComplexity: true
    }
  );

  console.log(`Language: ${code.language}`);
  console.log('\nGenerated Code:');
  console.log(code.code);
  console.log('\nExplanation:', code.explanation);
  
  if (code.testCases) {
    console.log('\nTest Cases:');
    code.testCases.forEach(test => {
      console.log(`- ${test.name}`);
      console.log(`  Input: ${JSON.stringify(test.input)}`);
      console.log(`  Expected: ${JSON.stringify(test.expectedOutput)}`);
    });
  }
  
  if (code.complexity) {
    console.log('\nComplexity Analysis:');
    console.log(`- Time: ${code.complexity.timeComplexity}`);
    console.log(`- Space: ${code.complexity.spaceComplexity}`);
  }
}

// ============================================
// EXAMPLE 5: Custom Schema Validation
// ============================================

// Define a custom schema for a product review
const ProductReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().min(1).max(5),
  title: z.string().max(100),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  recommendation: z.enum(['yes', 'no', 'maybe']),
  verified: z.boolean()
});

async function customSchemaValidation() {
  console.log('\n=== Custom Schema Validation ===');
  
  // Register the schema
  pydanticAI.registerSchema('product_review', ProductReviewSchema);
  
  // Request with custom schema
  const response = await pydanticAI.requestWithSchema(
    {
      prompt: 'Generate a product review for a wireless mouse',
      context: {
        systemPrompt: 'You are a tech product reviewer. Generate realistic, balanced reviews.'
      }
    },
    ProductReviewSchema
  );

  if (response.success) {
    const review = response.structuredData;
    console.log('Generated Review:');
    console.log(`Title: ${review.title}`);
    console.log(`Rating: ${'⭐'.repeat(review.rating)}`);
    console.log(`Recommendation: ${review.recommendation}`);
    console.log('\nPros:');
    review.pros.forEach(pro => console.log(`+ ${pro}`));
    console.log('\nCons:');
    review.cons.forEach(con => console.log(`- ${con}`));
  }
}

// ============================================
// EXAMPLE 6: Batch Processing with Validation
// ============================================

const UserProfileSchema = z.object({
  name: z.string(),
  age: z.number().min(0).max(120),
  interests: z.array(z.string()),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string())
  }),
  availability: z.enum(['full-time', 'part-time', 'freelance'])
});

async function batchProcessing() {
  console.log('\n=== Batch Processing ===');
  
  const candidates = [
    'John Doe, 28, software developer interested in AI and blockchain',
    'Jane Smith, 34, project manager with strong leadership skills',
    'Bob Johnson, 45, data scientist specializing in machine learning'
  ];

  const profiles = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        const response = await pydanticAI.requestWithSchema(
          {
            prompt: `Extract user profile information from: ${candidate}`,
            orchestration: {
              mode: 'simple',
              preferredAgents: ['pydantic_ai']
            }
          },
          UserProfileSchema
        );
        
        return response.success ? response.structuredData : null;
      } catch (error) {
        console.error(`Failed to process: ${candidate}`);
        return null;
      }
    })
  );

  console.log('Extracted Profiles:');
  profiles.filter(p => p !== null).forEach((profile, index) => {
    console.log(`\nProfile ${index + 1}:`);
    console.log(`- Name: ${profile.name}`);
    console.log(`- Age: ${profile.age}`);
    console.log(`- Interests: ${profile.interests.join(', ')}`);
    console.log(`- Technical Skills: ${profile.skills.technical.join(', ')}`);
    console.log(`- Availability: ${profile.availability}`);
  });
}

// ============================================
// EXAMPLE 7: Error Handling and Validation
// ============================================

async function errorHandlingExample() {
  console.log('\n=== Error Handling ===');
  
  // Example with invalid schema
  const StrictSchema = z.object({
    id: z.number().positive(),
    email: z.string().email(),
    score: z.number().min(0).max(100)
  });

  try {
    const response = await pydanticAI.requestWithSchema(
      {
        prompt: 'Generate user data',
        validation: {
          strictMode: true,
          retryAttempts: 2
        }
      },
      StrictSchema
    );

    if (!response.success) {
      console.log('Validation failed:');
      response.validation.errors?.forEach(err => console.log(`- ${err}`));
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

// ============================================
// EXAMPLE 8: Caching and Performance
// ============================================

async function cachingExample() {
  console.log('\n=== Caching Example ===');
  
  // Check initial stats
  let stats = pydanticAI.getStats();
  console.log(`Initial cache size: ${stats.cacheSize}`);
  
  // Make the same request multiple times
  const request = {
    prompt: 'What is the capital of France?',
    context: {
      temperature: 0.1 // Low temperature for deterministic responses
    }
  };

  console.time('First request');
  const response1 = await pydanticAI.request(request);
  console.timeEnd('First request');
  console.log(`Cache hit: ${response1.metadata.cacheHit}`);

  console.time('Second request (cached)');
  const response2 = await pydanticAI.request(request);
  console.timeEnd('Second request (cached)');
  console.log(`Cache hit: ${response2.metadata.cacheHit}`);

  stats = pydanticAI.getStats();
  console.log(`Final cache size: ${stats.cacheSize}`);
  
  // Clear cache
  pydanticAI.clearCache();
  console.log('Cache cleared');
}

// ============================================
// MAIN: Run all examples
// ============================================

async function main() {
  console.log('Pydantic AI Service Examples\n');
  
  try {
    await basicAIRequest();
    await cognitiveAnalysis();
    await taskPlanning();
    await codeGeneration();
    await customSchemaValidation();
    await batchProcessing();
    await errorHandlingExample();
    await cachingExample();
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main();
}

export {
  basicAIRequest,
  cognitiveAnalysis,
  taskPlanning,
  codeGeneration,
  customSchemaValidation,
  batchProcessing,
  errorHandlingExample,
  cachingExample
};