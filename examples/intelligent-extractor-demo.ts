import { IntelligentExtractor, extractionUtils } from '../src/core/knowledge/intelligent-extractor';
import { OnlineResearchAgent } from '../src/core/knowledge/online-research-agent';
import { SearXNGClient } from '../src/core/knowledge/searxng-client';
import { logger } from '../src/utils/logger';

// Example usage of the IntelligentExtractor
async function demonstrateIntelligentExtraction() {
  logger.info('🚀 Starting Intelligent Extractor Demo');

  // Initialize the extractor with custom configuration
  const extractor = new IntelligentExtractor({
    defaultConfidenceThreshold: 0.8,
    enableLearning: true,
    enableCoordination: true,
    enableSemanticAnalysis: true,
    enablePatternEvolution: true,
    cacheEnabled: true,
    cacheTTL: 300000 // 5 minutes
  });

  // Example 1: Extract solution from Stack Overflow content
  const stackOverflowHTML = `
    <div class="answer">
      <div class="s-prose">
        <p>To fix the TypeScript error "Cannot read property of undefined", you need to add proper null checks:</p>
        <pre><code>
if (user && user.profile) {
  console.log(user.profile.name);
}
        </code></pre>
        <p>This ensures that both user and user.profile exist before accessing properties.</p>
      </div>
      <div class="js-vote-count">42</div>
      <div class="js-accepted-answer-indicator">✓</div>
    </div>
  `;

  const stackOverflowContext = extractionUtils.createContext(
    'demo-session-001',
    'research-agent-001',
    'task-extract-solution',
    'stackoverflow.com',
    'html',
    'extract TypeScript error solution'
  );

  try {
    const result1 = await extractor.extract(stackOverflowHTML, stackOverflowContext);
    
    logger.info('📊 Stack Overflow Extraction Result:');
    logger.info(`  - Success: ${result1.success}`);
    logger.info(`  - Confidence: ${result1.confidence.toFixed(2)}`);
    logger.info(`  - Patterns matched: ${result1.patternMatches.length}`);
    logger.info(`  - Extracted fields: ${Object.keys(result1.extractedData.structured).join(', ')}`);
    
    if (result1.extractedData.structured.answer_text) {
      logger.info(`  - Answer: ${result1.extractedData.structured.answer_text.substring(0, 100)}...`);
    }
    
  } catch (error) {
    logger.error('❌ Stack Overflow extraction failed:', error);
  }

  // Example 2: Extract from GitHub issue content
  const githubIssueHTML = `
    <div class="timeline-comment">
      <h1 class="js-issue-title">TypeScript compilation error with undefined property</h1>
      <div class="comment-body">
        <p>I'm getting a TypeScript error when trying to access nested properties:</p>
        <pre><code>
const result = data.user.profile.name; // Error: Cannot read property 'name' of undefined
        </code></pre>
        <p>How can I safely access nested properties in TypeScript?</p>
      </div>
      <div class="State State--open">Open</div>
      <div class="IssueLabel">typescript</div>
      <div class="IssueLabel">bug</div>
    </div>
  `;

  const githubContext = extractionUtils.createContext(
    'demo-session-002',
    'research-agent-002',
    'task-extract-issue',
    'github.com',
    'html',
    'extract GitHub issue details'
  );

  try {
    const result2 = await extractor.extract(githubIssueHTML, githubContext);
    
    logger.info('🐛 GitHub Issue Extraction Result:');
    logger.info(`  - Success: ${result2.success}`);
    logger.info(`  - Confidence: ${result2.confidence.toFixed(2)}`);
    logger.info(`  - Issue title: ${result2.extractedData.structured.issue_title}`);
    logger.info(`  - Status: ${result2.extractedData.structured.status}`);
    logger.info(`  - Labels: ${result2.extractedData.structured.labels}`);
    
  } catch (error) {
    logger.error('❌ GitHub issue extraction failed:', error);
  }

  // Example 3: Extract from technical documentation
  const documentationHTML = `
    <main class="docs">
      <h1>TypeScript Optional Chaining</h1>
      <div class="content">
        <p>Optional chaining allows you to safely access nested object properties without throwing errors when intermediate properties are null or undefined.</p>
        <h2>Syntax</h2>
        <pre><code>
const name = user?.profile?.name;
        </code></pre>
        <p>This is equivalent to:</p>
        <pre><code>
const name = (user && user.profile) ? user.profile.name : undefined;
        </code></pre>
        <h2>Benefits</h2>
        <ul>
          <li>Prevents runtime errors</li>
          <li>Cleaner code</li>
          <li>Better type safety</li>
        </ul>
      </div>
      <a href="https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#optional-chaining">Learn more</a>
    </main>
  `;

  const docContext = extractionUtils.createContext(
    'demo-session-003',
    'research-agent-003',
    'task-extract-docs',
    'typescriptlang.org',
    'html',
    'extract TypeScript documentation'
  );

  try {
    const result3 = await extractor.extract(documentationHTML, docContext);
    
    logger.info('📚 Documentation Extraction Result:');
    logger.info(`  - Success: ${result3.success}`);
    logger.info(`  - Confidence: ${result3.confidence.toFixed(2)}`);
    logger.info(`  - Title: ${result3.extractedData.structured.title}`);
    logger.info(`  - Code examples found: ${result3.extractedData.structured.code_examples?.length || 0}`);
    logger.info(`  - Semantic analysis - Main topic: ${result3.semanticAnalysis.mainTopic}`);
    logger.info(`  - Semantic analysis - Technical level: ${result3.semanticAnalysis.technicalLevel.toFixed(2)}`);
    
  } catch (error) {
    logger.error('❌ Documentation extraction failed:', error);
  }

  // Example 4: Create and use a custom pattern
  const customPattern = extractionUtils.createPattern(
    'error-solution-pair',
    'Error and Solution Pair',
    'semantic',
    'error.*solution|problem.*fix',
    [
      { name: 'error_description', type: 'text', required: true, selector: '.error, .problem', semanticTags: ['error'] },
      { name: 'solution_description', type: 'text', required: true, selector: '.solution, .fix', semanticTags: ['solution'] },
      { name: 'code_example', type: 'code', required: false, selector: 'pre, code', semanticTags: ['example'] }
    ],
    {
      confidence: 0.85,
      applicableDomains: ['*'],
      applicableContentTypes: ['html', 'text'],
      validationRules: [
        { id: 'error-not-empty', type: 'required', field: 'error_description', condition: 'required', message: 'Error description is required', severity: 'error', adaptable: false },
        { id: 'solution-not-empty', type: 'required', field: 'solution_description', condition: 'required', message: 'Solution description is required', severity: 'error', adaptable: false }
      ]
    }
  );

  await extractor.addPattern(customPattern);
  logger.info('✅ Added custom pattern: Error and Solution Pair');

  // Example 5: Extract with custom pattern
  const errorSolutionContent = `
    <div class="error">
      <h3>TypeError: Cannot read property 'name' of undefined</h3>
      <p>This error occurs when trying to access a property on an undefined or null object.</p>
    </div>
    <div class="solution">
      <h3>Solution: Use Optional Chaining</h3>
      <p>Use the optional chaining operator (?.) to safely access nested properties:</p>
      <pre><code>
const name = user?.profile?.name ?? 'Unknown';
      </code></pre>
    </div>
  `;

  const customContext = extractionUtils.createContext(
    'demo-session-004',
    'research-agent-004',
    'task-extract-error-solution',
    'example.com',
    'html',
    'extract error and solution information'
  );

  try {
    const result4 = await extractor.extract(errorSolutionContent, customContext);
    
    logger.info('🔧 Custom Pattern Extraction Result:');
    logger.info(`  - Success: ${result4.success}`);
    logger.info(`  - Confidence: ${result4.confidence.toFixed(2)}`);
    logger.info(`  - Error: ${result4.extractedData.structured.error_description}`);
    logger.info(`  - Solution: ${result4.extractedData.structured.solution_description}`);
    logger.info(`  - Learning insights: ${result4.learningInsights.patternsLearned.join(', ')}`);
    
  } catch (error) {
    logger.error('❌ Custom pattern extraction failed:', error);
  }

  // Example 6: Get performance metrics
  const performanceMetrics = await extractor.getPerformanceMetrics();
  logger.info('📈 Performance Metrics:');
  logger.info(`  - Total patterns: ${Object.keys(performanceMetrics.patterns).length}`);
  logger.info(`  - Cache size: ${performanceMetrics.cache.size}`);
  logger.info(`  - Cache hit rate: ${performanceMetrics.cache.hitRate.toFixed(2)}`);
  logger.info(`  - Patterns evolved: ${performanceMetrics.learning.patternsEvolved}`);

  // Example 7: Export patterns for backup
  const exportedPatterns = await extractor.exportPatterns();
  logger.info('💾 Exported patterns for backup');

  // Cleanup
  await extractor.shutdown();
  logger.info('🔥 Intelligent Extractor demo completed');
}

// Example of integrating with browser automation
async function demonstrateWithBrowserAutomation() {
  logger.info('🌐 Demonstrating browser automation integration');

  const extractor = new IntelligentExtractor({
    defaultConfidenceThreshold: 0.7,
    enableLearning: true,
    enableCoordination: true
  });

  // Example with Puppeteer (commented out to avoid browser dependencies in demo)
  /*
  const puppeteer = require('puppeteer');
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://stackoverflow.com/questions/tagged/typescript');
  
  // Get page content
  const content = await page.content();
  
  const context = extractionUtils.createContext(
    'browser-session-001',
    'browser-agent-001',
    'task-scrape-stackoverflow',
    'stackoverflow.com',
    'html',
    'extract TypeScript questions and answers'
  );
  
  const result = await extractor.extract(content, context, page);
  
  logger.info('🤖 Browser automation extraction result:');
  logger.info(`  - Success: ${result.success}`);
  logger.info(`  - Confidence: ${result.confidence.toFixed(2)}`);
  logger.info(`  - Questions found: ${result.extractedData.structured.questions?.length || 0}`);
  
  await browser.close();
  */

  await extractor.shutdown();
}

// Example of using with SearXNG and Online Research Agent
async function demonstrateResearchIntegration() {
  logger.info('🔍 Demonstrating research integration');

  const extractor = new IntelligentExtractor();
  const researchAgent = new OnlineResearchAgent({
    searxngUrl: 'http://localhost:8080',
    defaultConfidenceThreshold: 0.8
  });

  // Research a TypeScript error
  const query = {
    error: 'Cannot read property of undefined',
    context: 'TypeScript React component',
    technology: 'TypeScript',
    severity: 'high' as const
  };

  try {
    const researchResult = await researchAgent.researchSolution(query);
    
    if (researchResult) {
      logger.info('🔍 Research completed, now extracting detailed information...');
      
      // Extract detailed information from the research results
      for (const source of researchResult.sources) {
        try {
          // In a real scenario, you would fetch the content from the source
          const mockContent = `
            <div class="solution">
              <h3>Solution for ${query.error}</h3>
              <p>The error occurs when accessing properties on undefined objects.</p>
              <pre><code>
// Instead of this:
const name = user.profile.name;

// Do this:
const name = user?.profile?.name || 'Default';
              </code></pre>
            </div>
          `;
          
          const context = extractionUtils.createContext(
            'research-session-001',
            'research-agent-001',
            'task-extract-research',
            new URL(source).hostname,
            'html',
            'extract detailed solution information'
          );
          
          const extractionResult = await extractor.extract(mockContent, context);
          
          logger.info(`📋 Extracted from ${source}:`);
          logger.info(`  - Confidence: ${extractionResult.confidence.toFixed(2)}`);
          logger.info(`  - Solution quality: ${extractionResult.extractedData.qualityScore.toFixed(2)}`);
          
        } catch (error) {
          logger.warn(`⚠️ Could not extract from ${source}:`, error);
        }
      }
    }
  } catch (error) {
    logger.error('❌ Research integration failed:', error);
  }

  await extractor.shutdown();
}

// Run the demonstrations
async function runAllDemonstrations() {
  try {
    await demonstrateIntelligentExtraction();
    await demonstrateWithBrowserAutomation();
    await demonstrateResearchIntegration();
    
    logger.info('🎉 All demonstrations completed successfully!');
  } catch (error) {
    logger.error('❌ Demonstration failed:', error);
  }
}

// Export for use in other modules
export {
  demonstrateIntelligentExtraction,
  demonstrateWithBrowserAutomation,
  demonstrateResearchIntegration,
  runAllDemonstrations
};

// Run if called directly
if (require.main === module) {
  runAllDemonstrations().catch(console.error);
}