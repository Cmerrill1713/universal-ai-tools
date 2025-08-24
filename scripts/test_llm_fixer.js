const { LLMCodeFixer } = require('../dist/services/llm_code_fixer');
const fs = require('fs').promises;

/**
 * Test the LLM Code Fixer with actual TypeScript errors
 */
async function testLLMFixer() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🤖 Testing LLM Code Fixer...\n');

  // Initialize the fixer
  const fixer = new LLMCodeFixer();

  // Test with a specific error
  const testError = `
src/agents/cognitive/ethics_agent.ts(45,20): error TS2339: Property 'metadata' does not exist on type 'AgentContext'.
src/agents/cognitive/ethics_agent.ts(46,20): error TS2339: Property 'userId' does not exist on type 'AgentContext'.
src/agents/cognitive/resource_manager_agent.ts(123,15): error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
`;

  console.log('Testing with sample errors:');
  console.log(testError);
  console.log('\n---\n');

  try {
    // Generate fixes without applying them
    const result = await fixer.fixTypeScriptErrors(testError, {
      autoApply: false,
      minConfidence: 0.7
    });

    console.log('📊 Results:');
    console.log(`- Total errors found: ${result.totalErrors}`);
    console.log(`- Fixes generated: ${result.fixesGenerated}`);
    console.log(`- Fixes applied: ${result.fixesApplied}`);
    console.log('\n📋 Fix Report:');
    
    if (result.report.fixes) {
      result.report.fixes.forEach((fix, index) => {
        console.log(`\n${index + 1}. ${fix.errorCode} in ${fix.file}:${fix.line}`);
        console.log(`   Error: ${fix.errorMessage}`);
        console.log(`   Fix: ${fix.explanation}`);
        console.log(`   Confidence: ${(fix.confidence * 100).toFixed(0)}%`);
        console.log(`   Code: ${fix.fix}`);
      });
    }

    console.log('\n💡 Recommendations:');
    result.report.recommendations.forEach(rec => {
      console.log(`   - ${rec}`);
    });

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Error:', error);
  }
}

// Test with actual build errors if available
async function testWithBuildErrors() {
  try {
    const buildErrors = await fs.readFile('build_errors.log', 'utf-8');
    console.log('\n\n🔧 Testing with actual build errors...\n');
    
    const fixer = new LLMCodeFixer();
    const result = await fixer.fixTypeScriptErrors(buildErrors, {
      autoApply: false,
      minConfidence: 0.8
    });

    console.log(`\n✅ Generated fixes for ${result.fixesGenerated} out of ${result.totalErrors} errors`);
    console.log(`📄 Full report saved to: LLM_FIX_REPORT.json`);

  } catch (error) {
    console.log('ℹ️  No build_errors.log found, skipping real error test');
  }
}

// Main execution
async function main() {
  console.log('Universal AI Tools - LLM Code Fixer Test\n');
  
  // Check environment
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('❌ Missing Supabase credentials');
    console.log('\nPlease set:');
    console.log('export SUPABASE_URL=http://localhost:54321');
    console.log('export SUPABASE_ANON_KEY=your-anon-key');
    return;
  }

  // Run tests
  await testLLMFixer();
  await testWithBuildErrors();

  console.log('\n✨ Test complete!');
}

main().catch(console.error);