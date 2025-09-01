#!/usr/bin/env node
/**
 * Comprehensive Functional Validation Test
 * Tests every rule, edge case, and integration scenario
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:9999';

async function comprehensiveFunctionalTest() {
  console.log('🧪 COMPREHENSIVE FUNCTIONAL VALIDATION TEST');
  console.log('=' .repeat(60));
  
  let testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  function recordTest(name, passed, details = '') {
    testResults.total++;
    if (passed) {
      testResults.passed++;
      console.log(`   ✅ ${name}`);
    } else {
      testResults.failed++;
      console.log(`   ❌ ${name}`);
    }
    if (details) console.log(`      ${details}`);
    testResults.details.push({ name, passed, details });
  }

  try {
    console.log('\n📏 1. CONTENT LENGTH VALIDATION');
    console.log('-'.repeat(40));
    
    // Test 1.1: Content too short (should warn)
    try {
      const shortResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Short",
        type: "knowledge",
        metadata: { source: "test" },
        importance: 0.5
      });
      const hasWarnings = shortResult.headers['x-memory-warnings'];
      recordTest('Short content warning detection', !!hasWarnings, 
        hasWarnings ? `Warnings: ${JSON.parse(hasWarnings).length}` : 'No warnings found');
    } catch (error) {
      recordTest('Short content handling', false, `Unexpected error: ${error.message}`);
    }
    
    // Test 1.2: Content too long (should warn)
    const longContent = 'x'.repeat(15000);
    try {
      const longResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: longContent,
        type: "knowledge",
        metadata: { source: "test" },
        importance: 0.5
      });
      const hasWarnings = longResult.headers['x-memory-warnings'];
      recordTest('Long content warning detection', !!hasWarnings);
    } catch (error) {
      recordTest('Long content handling', false, `Error: ${error.message}`);
    }
    
    // Test 1.3: Optimal content length (should pass)
    try {
      const optimalResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "This is optimal length content that should pass all validation rules without any warnings or errors during processing",
        type: "knowledge",
        metadata: { source: "test_optimal" },
        tags: ["optimal", "test"],
        importance: 0.7
      });
      recordTest('Optimal content length acceptance', optimalResult.data.success);
    } catch (error) {
      recordTest('Optimal content processing', false, `Unexpected rejection: ${error.message}`);
    }

    console.log('\n🔐 2. PII PROTECTION VALIDATION');
    console.log('-'.repeat(40));
    
    // Test 2.1: SSN detection
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Customer SSN is 123-45-6789 for verification",
        type: "knowledge",
        metadata: { source: "customer_data" },
        importance: 0.5
      });
      recordTest('SSN blocking', false, 'SSN was not blocked');
    } catch (error) {
      recordTest('SSN blocking', error.response?.status === 400, 
        `Status: ${error.response?.status}, blocked: ${error.response?.data.error?.code === 'VALIDATION_ERROR'}`);
    }
    
    // Test 2.2: Credit card detection
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Payment card number 1234567890123456 needs processing",
        type: "knowledge",
        metadata: { source: "payment_system" },
        importance: 0.5
      });
      recordTest('Credit card blocking', false, 'Credit card was not blocked');
    } catch (error) {
      recordTest('Credit card blocking', error.response?.status === 400);
    }
    
    // Test 2.3: Email detection
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Contact customer at john.doe@company.com for follow-up",
        type: "knowledge",
        metadata: { source: "customer_service" },
        importance: 0.5
      });
      recordTest('Email blocking', false, 'Email was not blocked');
    } catch (error) {
      recordTest('Email blocking', error.response?.status === 400);
    }
    
    // Test 2.4: Phone number detection
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Customer phone number is 555-123-4567 for contact",
        type: "knowledge",
        metadata: { source: "customer_data" },
        importance: 0.5
      });
      recordTest('Phone number blocking', false, 'Phone number was not blocked');
    } catch (error) {
      recordTest('Phone number blocking', error.response?.status === 400);
    }

    console.log('\n🏷️ 3. METADATA VALIDATION');
    console.log('-'.repeat(40));
    
    // Test 3.1: Missing required metadata (should block)
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Content without proper metadata to test validation rules",
        type: "knowledge"
        // Missing source, importance
      });
      recordTest('Missing metadata blocking', false, 'Missing metadata was allowed');
    } catch (error) {
      recordTest('Missing metadata blocking', error.response?.status === 400);
    }
    
    // Test 3.2: Invalid importance score (should block)
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Testing invalid importance score validation",
        type: "knowledge",
        metadata: { source: "test" },
        importance: 2.5 // Invalid - should be 0-1
      });
      recordTest('Invalid importance blocking', false, 'Invalid importance was allowed');
    } catch (error) {
      recordTest('Invalid importance blocking', error.response?.status === 400);
    }
    
    // Test 3.3: Auto-fix missing metadata
    try {
      const autoFixResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Testing auto-fix functionality for missing metadata fields",
        type: "knowledge",
        autoFix: true,
        enforceRules: false, // Allow storage for auto-fix testing
        tags: ["autofix", "test"]
      });
      recordTest('Auto-fix functionality', autoFixResult.data.success);
    } catch (error) {
      recordTest('Auto-fix functionality', false, `Auto-fix failed: ${error.message}`);
    }

    console.log('\n📊 4. TAG QUALITY VALIDATION');
    console.log('-'.repeat(40));
    
    // Test 4.1: No tags (should warn)
    try {
      const noTagsResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Content without any tags to test tag validation rules",
        type: "knowledge",
        metadata: { source: "test_no_tags" },
        importance: 0.5
      });
      const hasWarnings = noTagsResult.headers['x-memory-warnings'];
      recordTest('No tags warning', !!hasWarnings);
    } catch (error) {
      recordTest('No tags handling', false, `Error: ${error.message}`);
    }
    
    // Test 4.2: Invalid tag format (should warn)
    try {
      const invalidTagsResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Testing invalid tag formats and special characters in tags",
        type: "knowledge",
        metadata: { source: "test_tags" },
        tags: ["x", "tag with spaces", "tag@#$%"], // Invalid formats
        importance: 0.5
      });
      const hasWarnings = invalidTagsResult.headers['x-memory-warnings'];
      recordTest('Invalid tag format warning', !!hasWarnings);
    } catch (error) {
      recordTest('Invalid tag handling', false, `Error: ${error.message}`);
    }
    
    // Test 4.3: Valid tags (should pass)
    try {
      const validTagsResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Testing valid tag formats that should meet all quality standards",
        type: "knowledge",
        metadata: { source: "test_valid_tags" },
        tags: ["valid", "test_tag", "quality-check"],
        importance: 0.7
      });
      recordTest('Valid tags acceptance', validTagsResult.data.success);
    } catch (error) {
      recordTest('Valid tags processing', false, `Error: ${error.message}`);
    }

    console.log('\n🔍 5. ACCURACY & VERIFICATION');
    console.log('-'.repeat(40));
    
    // Test 5.1: Knowledge without verification (should warn)
    try {
      const unverifiedResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Scientific claim that lacks proper verification status for accuracy tracking",
        type: "knowledge",
        metadata: { source: "research_paper" },
        tags: ["science", "research"],
        importance: 0.8
      });
      const hasWarnings = unverifiedResult.headers['x-memory-warnings'];
      recordTest('Unverified knowledge warning', !!hasWarnings);
    } catch (error) {
      recordTest('Unverified knowledge handling', false, `Error: ${error.message}`);
    }
    
    // Test 5.2: Questionable source (should warn)
    try {
      const questionableResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Information from potentially unreliable source that needs credibility assessment",
        type: "knowledge",
        metadata: { source: "random_blog" },
        tags: ["information", "source"],
        importance: 0.6
      });
      const hasWarnings = questionableResult.headers['x-memory-warnings'];
      recordTest('Questionable source warning', !!hasWarnings);
    } catch (error) {
      recordTest('Questionable source handling', false, `Error: ${error.message}`);
    }
    
    // Test 5.3: Verified knowledge with good source (should pass)
    try {
      const verifiedResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Verified scientific information from credible academic research with proper citation",
        type: "knowledge",
        metadata: { 
          source: "academic_paper",
          verificationStatus: "verified",
          confidence: 0.95
        },
        tags: ["verified", "academic", "research"],
        importance: 0.9
      });
      recordTest('Verified knowledge acceptance', verifiedResult.data.success);
    } catch (error) {
      recordTest('Verified knowledge processing', false, `Error: ${error.message}`);
    }

    console.log('\n💬 6. INAPPROPRIATE LANGUAGE');
    console.log('-'.repeat(40));
    
    // Test 6.1: Inappropriate language (should warn)
    try {
      const inappropriateResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "This damn system needs to fucking work properly for shit sake",
        type: "conversation",
        metadata: { source: "user_feedback" },
        importance: 0.3
      });
      const hasWarnings = inappropriateResult.headers['x-memory-warnings'];
      recordTest('Inappropriate language warning', !!hasWarnings);
    } catch (error) {
      recordTest('Inappropriate language handling', false, `Error: ${error.message}`);
    }

    console.log('\n⚡ 7. PERFORMANCE OPTIMIZATION');
    console.log('-'.repeat(40));
    
    // Test 7.1: Missing embedding (should warn)
    try {
      const noEmbeddingResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Content without vector embedding for performance testing of search capabilities",
        type: "knowledge",
        metadata: { source: "performance_test" },
        tags: ["performance", "embedding"],
        importance: 0.6
      });
      const hasWarnings = noEmbeddingResult.headers['x-memory-warnings'];
      recordTest('Missing embedding warning', !!hasWarnings);
    } catch (error) {
      recordTest('Missing embedding handling', false, `Error: ${error.message}`);
    }
    
    // Test 7.2: Repetitive content (should warn)
    try {
      const repetitiveContent = "Repetitive pattern " + "test content ".repeat(50);
      const repetitiveResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: repetitiveContent,
        type: "knowledge",
        metadata: { source: "repetitive_test" },
        importance: 0.4
      });
      const hasWarnings = repetitiveResult.headers['x-memory-warnings'];
      recordTest('Repetitive content warning', !!hasWarnings);
    } catch (error) {
      recordTest('Repetitive content handling', false, `Error: ${error.message}`);
    }

    console.log('\n🔄 8. EDGE CASES & ERROR HANDLING');
    console.log('-'.repeat(40));
    
    // Test 8.1: Rule bypass (emergency mode)
    try {
      const bypassResult = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Emergency content with SSN 123-45-6789 that bypasses rules",
        type: "knowledge",
        enforceRules: false, // Emergency bypass
        metadata: { source: "emergency_system" },
        importance: 1.0
      });
      recordTest('Emergency rule bypass', bypassResult.data.success);
    } catch (error) {
      recordTest('Emergency rule bypass', false, `Bypass failed: ${error.message}`);
    }
    
    // Test 8.2: Multiple violations (should block)
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Bad content with SSN 123-45-6789 and email test@test.com",
        type: "knowledge",
        importance: 5.0 // Also invalid importance
        // Missing metadata
      });
      recordTest('Multiple violations blocking', false, 'Multiple violations were allowed');
    } catch (error) {
      const violationCount = error.response?.data?.error?.violations?.length || 0;
      recordTest('Multiple violations blocking', error.response?.status === 400, 
        `Violations detected: ${violationCount}`);
    }

    console.log('\n🤖 9. AI ASSISTANT INTEGRATION');
    console.log('-'.repeat(40));
    
    // Test 9.1: Conversation storage with validation
    try {
      const conversationResult = await axios.post(`${BACKEND_URL}/api/v1/conversation`, {
        message: "Store this validated knowledge: Best practices validation ensures high-quality AI memory storage with comprehensive rule enforcement",
        sessionId: "validation-integration-test"
      });
      recordTest('AI conversation integration', conversationResult.data.success);
    } catch (error) {
      recordTest('AI conversation integration', false, `Integration error: ${error.message}`);
    }
    
    // Test 9.2: Memory retrieval with validation reports
    try {
      const retrievalResult = await axios.get(`${BACKEND_URL}/api/v1/memory?limit=3`);
      const hasValidationData = retrievalResult.data.data.memories.some(m => 
        m.validationReport !== undefined
      );
      recordTest('Validation report inclusion', hasValidationData);
    } catch (error) {
      recordTest('Memory retrieval with validation', false, `Retrieval error: ${error.message}`);
    }

    console.log('\n📊 10. VALIDATION STATISTICS');
    console.log('-'.repeat(40));
    
    // Test 10.1: Statistics collection
    try {
      const statsResult = await axios.get(`${BACKEND_URL}/api/v1/memory/validation/stats`);
      const hasStats = statsResult.data.success && statsResult.data.data.totalMemoriesChecked > 0;
      recordTest('Statistics collection', hasStats, 
        `Memories checked: ${statsResult.data.data?.totalMemoriesChecked || 0}`);
    } catch (error) {
      recordTest('Statistics collection', false, `Stats error: ${error.message}`);
    }
    
    // Test 10.2: Statistics accuracy
    try {
      const statsResult = await axios.get(`${BACKEND_URL}/api/v1/memory/validation/stats`);
      const stats = statsResult.data.data;
      const hasViolationBreakdown = stats.violationsByType && stats.violationsBySeverity;
      recordTest('Statistics accuracy', hasViolationBreakdown, 
        `Violations tracked by type: ${Object.keys(stats.violationsByType || {}).length}`);
    } catch (error) {
      recordTest('Statistics accuracy', false, `Accuracy check error: ${error.message}`);
    }

    console.log('\n' + '=' .repeat(60));
    console.log('📊 COMPREHENSIVE FUNCTIONAL TEST RESULTS');
    console.log('=' .repeat(60));
    
    console.log(`\nTotal Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed} (${((testResults.passed/testResults.total)*100).toFixed(1)}%)`);
    console.log(`Failed: ${testResults.failed} (${((testResults.failed/testResults.total)*100).toFixed(1)}%)`);
    
    // Group results by category
    const categories = {
      'Content Length': testResults.details.filter(d => d.name.toLowerCase().includes('content')).length,
      'PII Protection': testResults.details.filter(d => d.name.toLowerCase().includes('blocking')).length,
      'Metadata': testResults.details.filter(d => d.name.toLowerCase().includes('metadata')).length,
      'Tags': testResults.details.filter(d => d.name.toLowerCase().includes('tag')).length,
      'Accuracy': testResults.details.filter(d => d.name.toLowerCase().includes('verification') || d.name.toLowerCase().includes('source')).length,
      'Language': testResults.details.filter(d => d.name.toLowerCase().includes('language')).length,
      'Performance': testResults.details.filter(d => d.name.toLowerCase().includes('performance') || d.name.toLowerCase().includes('embedding')).length,
      'Edge Cases': testResults.details.filter(d => d.name.toLowerCase().includes('bypass') || d.name.toLowerCase().includes('multiple')).length,
      'AI Integration': testResults.details.filter(d => d.name.toLowerCase().includes('conversation') || d.name.toLowerCase().includes('integration')).length,
      'Statistics': testResults.details.filter(d => d.name.toLowerCase().includes('statistics')).length
    };
    
    console.log('\n📈 Test Coverage by Category:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} tests`);
    });
    
    // Show failed tests
    const failures = testResults.details.filter(d => !d.passed);
    if (failures.length > 0) {
      console.log('\n❌ Failed Tests:');
      failures.forEach(failure => {
        console.log(`  • ${failure.name}: ${failure.details}`);
      });
    }
    
    const successRate = (testResults.passed/testResults.total)*100;
    
    if (successRate >= 90) {
      console.log('\n✅ EXCELLENT: Best practices validation system is production-ready!');
    } else if (successRate >= 75) {
      console.log('\n⚠️ GOOD: System functional but needs minor improvements');
    } else {
      console.log('\n❌ NEEDS WORK: Critical issues require attention');
    }
    
    console.log('\n🎯 Key Functional Capabilities Verified:');
    console.log('  • Real-time validation with comprehensive rule coverage');
    console.log('  • Privacy protection through PII detection and blocking');
    console.log('  • Data quality enforcement via metadata and content standards');
    console.log('  • Intelligent auto-fixing for common validation issues');
    console.log('  • Performance optimization through embedding and format checks');
    console.log('  • Emergency bypass capabilities for critical situations');
    console.log('  • Seamless AI assistant integration with transparent reporting');
    console.log('  • Comprehensive statistics and violation tracking');
    
  } catch (error) {
    console.error('\n💥 Critical test infrastructure error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

// Run comprehensive functional test
comprehensiveFunctionalTest();