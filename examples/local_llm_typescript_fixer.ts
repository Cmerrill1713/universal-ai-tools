import { localLLMManager } from '../src/services/local_llm_manager';
import { SupabaseService } from '../src/services/supabase_service';
import { logger } from '../src/utils/logger';
import * as fs from 'fs/promises';

/**
 * Demonstrates using Ollama and LM Studio for TypeScript error fixing
 * Shows automatic fallback between services
 */

async function demonstrateLocalLLMTypeScriptFixer() {
  console.log('🤖 Local LLM TypeScript Fixer Demo\n');
  console.log('Using Ollama + LM Studio for maximum reliability\n');

  const supabase = SupabaseService.getInstance();

  // Check local LLM health
  console.log('🏥 Checking Local LLM Services...');
  const health = await localLLMManager.checkHealth();
  
  console.log('\nOllama Status:', health.ollama.status);
  if (health.ollama.models) {
    console.log('  Models:', health.ollama.models.join(', '));
  }
  
  console.log('\nLM Studio Status:', health.lmStudio.status);
  if (health.lmStudio.models) {
    console.log('  Models:', health.lmStudio.models.join(', '));
  }
  
  console.log('\nPreferred Service:', health.preferred || 'None available');
  
  if (health.recommendations.length > 0) {
    console.log('\n⚠️ Recommendations:');
    health.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
  
  console.log('\n---\n');

  // Example TypeScript errors to fix
  const typeScriptErrors = [
    {
      code: "TS2339",
      message: "Property 'name' does not exist on type 'User'",
      snippet: "const userName = user.name;",
      context: "interface User { id: string; email: string; }"
    },
    {
      code: "TS2345",
      message: "Argument of type 'string[]' is not assignable to parameter of type 'string'",
      snippet: "function greet(name: string) { console.log(name); }\ngreet(['John', 'Jane']);",
      context: ""
    },
    {
      code: "TS7053",
      message: "Element implicitly has an 'any' type",
      snippet: "const config = { api: 'url', timeout: 5000 };\nconst value = config[userInput];",
      context: "const userInput: string = getUserInput();"
    }
  ];

  // Fix each error using local LLMs
  for (const error of typeScriptErrors) {
    console.log(`🔧 Fixing ${error.code}: ${error.message}`);
    console.log(`   Code: ${error.snippet}`);
    
    try {
      // Generate fix with automatic service selection
      const fix = await generateTypeScriptFix(error);
      
      console.log(`\n✅ Fix generated using ${fix.service}:`);
      console.log(`   ${fix.content}`);
      console.log(`   Model: ${fix.model}`);
      
      // Store successful fix in Supabase
      await storeFix(error, fix);
      
    } catch (error) {
      console.error(`❌ Failed to fix: ${error.message}`);
    }
    
    console.log('\n---\n');
  }

  // Demonstrate streaming for interactive fixing
  console.log('💬 Interactive Fix Mode (Streaming)\n');
  await demonstrateStreaming();

  // Show available models
  console.log('\n📚 Available Local Models:');
  const models = await localLLMManager.getAvailableModels();
  console.table(models);

  // Demonstrate embeddings for semantic search
  console.log('\n🔍 Semantic Search for Similar Errors:');
  await demonstrateSemanticSearch();
}

/**
 * Generate TypeScript fix using local LLMs
 */
async function generateTypeScriptFix(error: any) {
  const prompt = `Fix this TypeScript error:

Error: ${error.code} - ${error.message}
Code: ${error.snippet}
${error.context ? `Context: ${error.context}` : ''}

Provide only the corrected code without explanation.`;

  // Try with preferred service first, fallback if needed
  const result = await localLLMManager.generate({
    prompt,
    temperature: 0.3,
    max_tokens: 500,
    model: 'codellama', // Will use codellama from either service
    fallback: true // Enable automatic fallback
  });

  return result;
}

/**
 * Store successful fix in Supabase
 */
async function storeFix(error: any, fix: any) {
  const supabase = SupabaseService.getInstance();
  
  try {
    await supabase.client.from('code_fixes').insert({
      error_code: error.code,
      error_message: error.message,
      original_code: error.snippet,
      fixed_code: fix.content,
      model_used: `${fix.service}:${fix.model}`,
      confidence: 0.85,
      metadata: {
        context: error.context,
        service: fix.service,
        usage: fix.usage
      }
    });
    console.log('   💾 Fix stored in Supabase');
  } catch (err) {
    console.error('   Failed to store fix:', err.message);
  }
}

/**
 * Demonstrate streaming responses
 */
async function demonstrateStreaming() {
  const messages = [
    {
      role: 'system',
      content: 'You are a TypeScript expert. Provide concise fixes for TypeScript errors.'
    },
    {
      role: 'user',
      content: 'How do I fix "Object is possibly undefined" errors in TypeScript?'
    }
  ];

  console.log('Assistant: ', { end: '' });
  
  await localLLMManager.stream({
    messages,
    temperature: 0.7,
    max_tokens: 200,
    onToken: (token) => {
      process.stdout.write(token);
    },
    onComplete: (full) => {
      console.log('\n\n(Response complete)');
    }
  });
}

/**
 * Demonstrate semantic search using embeddings
 */
async function demonstrateSemanticSearch() {
  // Generate embeddings for error descriptions
  const errorDescriptions = [
    "Property does not exist on type",
    "Type is not assignable to parameter",
    "Object is possibly undefined",
    "Cannot find name"
  ];

  console.log('Generating embeddings for error patterns...');
  
  try {
    const embeddings = await localLLMManager.generateEmbedding(errorDescriptions);
    console.log(`Generated ${embeddings.length} embeddings`);
    console.log(`Embedding dimensions: ${embeddings[0]?.length || 0}`);
    
    // Compare similarity
    const queryEmbedding = await localLLMManager.generateEmbedding(
      "Property 'foo' does not exist"
    );
    
    // Calculate cosine similarity
    const similarities = embeddings.map((emb, idx) => ({
      text: errorDescriptions[idx],
      similarity: cosineSimilarity(queryEmbedding[0], emb)
    }));
    
    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log('\nMost similar error patterns:');
    similarities.forEach((s, idx) => {
      console.log(`${idx + 1}. "${s.text}" (similarity: ${s.similarity.toFixed(3)})`);
    });
    
  } catch (error) {
    console.error('Embedding generation failed:', error.message);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Batch process TypeScript errors from a file
 */
async function batchProcessErrors(errorLogPath: string) {
  console.log('\n📦 Batch Processing TypeScript Errors\n');
  
  try {
    const errorLog = await fs.readFile(errorLogPath, 'utf-8');
    const errors = parseTypeScriptErrors(errorLog);
    
    console.log(`Found ${errors.length} errors to process`);
    
    const fixes = await Promise.all(
      errors.map(async (error) => {
        try {
          const fix = await localLLMManager.generate({
            prompt: formatErrorPrompt(error),
            temperature: 0.3,
            max_tokens: 500,
            fallback: true
          });
          
          return {
            error,
            fix: fix.content,
            service: fix.service,
            success: true
          };
        } catch (err) {
          return {
            error,
            fix: null,
            service: null,
            success: false,
            errorMessage: err.message
          };
        }
      })
    );
    
    // Summary
    const successful = fixes.filter(f => f.success).length;
    console.log(`\n✅ Successfully fixed: ${successful}/${fixes.length}`);
    
    // Save report
    const report = {
      timestamp: new Date().toISOString(),
      total: fixes.length,
      successful,
      fixes: fixes.filter(f => f.success),
      failures: fixes.filter(f => !f.success)
    };
    
    await fs.writeFile(
      'typescript_fixes_local_llm.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('📄 Report saved to typescript_fixes_local_llm.json');
    
  } catch (error) {
    console.error('Batch processing failed:', error);
  }
}

/**
 * Parse TypeScript errors from compiler output
 */
function parseTypeScriptErrors(output: string): any[] {
  // Simple parser - improve based on actual error format
  const lines = output.split('\n');
  const errors: any[] = [];
  
  for (const line of lines) {
    const match = line.match(/(.+)\((\d+),(\d+)\): error (TS\d+): (.+)/);
    if (match) {
      errors.push({
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        code: match[4],
        message: match[5]
      });
    }
  }
  
  return errors;
}

/**
 * Format error for LLM prompt
 */
function formatErrorPrompt(error: any): string {
  return `Fix TypeScript ${error.code}: ${error.message}
File: ${error.file}
Line: ${error.line}

Provide only the corrected code.`;
}

// Service comparison demo
async function compareServices() {
  console.log('\n🔄 Comparing Ollama vs LM Studio\n');
  
  const testPrompt = "Write a TypeScript function to safely access nested object properties";
  
  console.log('Test prompt:', testPrompt);
  console.log('\nGenerating with both services...\n');
  
  // Generate with Ollama
  console.time('Ollama');
  let ollamaResult;
  try {
    ollamaResult = await localLLMManager.generate({
      prompt: testPrompt,
      service: 'ollama',
      temperature: 0.7,
      max_tokens: 200
    });
    console.timeEnd('Ollama');
    console.log('\nOllama result:');
    console.log(ollamaResult.content);
  } catch (err) {
    console.timeEnd('Ollama');
    console.log('Ollama failed:', err.message);
  }
  
  console.log('\n---\n');
  
  // Generate with LM Studio
  console.time('LM Studio');
  let lmStudioResult;
  try {
    lmStudioResult = await localLLMManager.generate({
      prompt: testPrompt,
      service: 'lm-studio',
      temperature: 0.7,
      max_tokens: 200
    });
    console.timeEnd('LM Studio');
    console.log('\nLM Studio result:');
    console.log(lmStudioResult.content);
  } catch (err) {
    console.timeEnd('LM Studio');
    console.log('LM Studio failed:', err.message);
  }
}

// Main execution
async function main() {
  try {
    await demonstrateLocalLLMTypeScriptFixer();
    await compareServices();
    
    // If you have a build error log, process it
    if (process.argv[2]) {
      await batchProcessErrors(process.argv[2]);
    }
    
    console.log('\n✅ Demo completed!');
  } catch (error) {
    console.error('❌ Demo error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export {
  demonstrateLocalLLMTypeScriptFixer,
  generateTypeScriptFix,
  batchProcessErrors,
  compareServices
};