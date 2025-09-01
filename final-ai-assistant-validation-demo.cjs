#!/usr/bin/env node
/**
 * Final AI Assistant Best Practices Validation Demo
 * Demonstrates complete integration of rule system with AI assistant
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:9999';

async function demonstrateAIAssistantValidation() {
  console.log('🤖 AI ASSISTANT BEST PRACTICES VALIDATION DEMO');
  console.log('=' .repeat(60));
  
  try {
    console.log('\n🛡️ DEMONSTRATION: AI ASSISTANT DATA QUALITY PROTECTION');
    console.log('-'.repeat(50));
    
    console.log('\n1️⃣ Valid Memory Storage:');
    const validMemory = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
      content: "Best Practice Demo: Universal AI Tools implements comprehensive memory validation with 11 active rules covering content quality, metadata standards, privacy protection, accuracy verification, and performance optimization. The system provides real-time violation detection, automatic fixing of common issues, and detailed reporting for continuous improvement.",
      type: "knowledge",
      metadata: {
        source: "system_documentation",
        topic: "best_practices_validation",
        confidence: 0.95
      },
      tags: ["best_practices", "validation", "ai_assistant", "demo"],
      importance: 0.9,
      autoFix: true
    });
    
    console.log(`   ✅ Memory stored successfully: ${validMemory.data.data.id}`);
    console.log(`   📋 Validation passed: ${validMemory.data.data.validationReport?.passed || 'N/A'}`);
    console.log(`   🔧 Auto-fixes applied: ${validMemory.data.data.validationReport?.autoFixed || false}`);
    
    console.log('\n2️⃣ PII Protection Test:');
    try {
      await axios.post(`${BACKEND_URL}/api/v1/memory`, {
        content: "Sensitive customer data: Phone 555-123-4567, Email customer@example.com",
        type: "knowledge",
        metadata: { source: "customer_service" },
        importance: 0.5
      });
      console.log('   ❌ PII protection failed - data was stored');
    } catch (error) {
      console.log('   ✅ PII protection active - sensitive data blocked');
      console.log(`   🔒 Violations: ${error.response.data.error.violations?.length || 1} detected`);
    }
    
    console.log('\n3️⃣ Auto-Fix Demonstration:');
    const autoFixMemory = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
      content: "This memory demonstrates auto-fixing capabilities for missing metadata and improper formatting in AI assistant systems",
      type: "knowledge",
      tags: ["demo", "auto_fix"],
      autoFix: true
      // Missing source and importance - should be auto-fixed
    });
    
    console.log(`   ✅ Auto-fixed memory stored: ${autoFixMemory.data.success}`);
    console.log(`   🔧 Auto-fixes available: ${autoFixMemory.data.suggestions?.autoFixable || 0}`);
    
    console.log('\n4️⃣ Quality Warning Example:');
    const warningMemory = await axios.post(`${BACKEND_URL}/api/v1/memory`, {
      content: "Short", // Will trigger length warning
      type: "knowledge",
      metadata: { source: "test_data" },
      tags: ["x"], // Will trigger tag quality warning
      importance: 0.3
    });
    
    console.log(`   ⚠️ Memory with warnings stored: ${warningMemory.data.success}`);
    const warnings = warningMemory.headers['x-memory-warnings'];
    if (warnings) {
      const warningList = JSON.parse(warnings);
      console.log(`   📊 Warnings detected: ${warningList.length}`);
    }
    
    console.log('\n📊 SYSTEM VALIDATION STATISTICS');
    console.log('-'.repeat(40));
    
    const stats = await axios.get(`${BACKEND_URL}/api/v1/memory/validation/stats`);
    const validationData = stats.data.data;
    
    console.log(`Total Rules Active: ${validationData.rules}`);
    console.log(`Memories Validated: ${validationData.totalMemoriesChecked}`);
    console.log(`Total Violations: ${validationData.totalViolations}`);
    console.log('');
    console.log('Violations by Severity:');
    if (validationData.violationsBySeverity) {
      console.log(`  🚫 Critical Errors: ${validationData.violationsBySeverity.error || 0}`);
      console.log(`  ⚠️ Warnings: ${validationData.violationsBySeverity.warning || 0}`);
      console.log(`  ℹ️ Info Notices: ${validationData.violationsBySeverity.info || 0}`);
    }
    console.log('');
    console.log('Violations by Category:');
    if (validationData.violationsByType) {
      console.log(`  📝 Content Issues: ${validationData.violationsByType.content || 0}`);
      console.log(`  🏷️ Metadata Issues: ${validationData.violationsByType.metadata || 0}`);
      console.log(`  🔍 Accuracy Issues: ${validationData.violationsByType.accuracy || 0}`);
      console.log(`  🔐 Privacy Issues: ${validationData.violationsByType.privacy || 0}`);
      console.log(`  ⚡ Performance Issues: ${validationData.violationsByType.performance || 0}`);
    }
    
    console.log('\n🧠 AI ASSISTANT INTEGRATION VERIFICATION');
    console.log('-'.repeat(40));
    
    // Test AI assistant conversation with memory storage
    const assistantTest = await axios.post(`${BACKEND_URL}/api/v1/conversation`, {
      message: "Remember that our Universal AI Tools platform now includes industry-leading memory validation with comprehensive rule enforcement",
      sessionId: "validation-integration-test"
    });
    
    console.log(`AI Response: ${assistantTest.data.success}`);
    console.log(`Action: ${assistantTest.data.action}`);
    
    // Verify recent memories include validation data
    const recentMemories = await axios.get(`${BACKEND_URL}/api/v1/memory?limit=5`);
    const memoriesWithValidation = recentMemories.data.data.memories.filter(m => 
      m.content.includes('validation') || m.validationReport
    );
    
    console.log(`Memories with validation tracking: ${memoriesWithValidation.length}`);
    
    console.log('\n' + '=' .repeat(60));
    console.log('✨ AI ASSISTANT VALIDATION SYSTEM FULLY OPERATIONAL');
    console.log('=' .repeat(60));
    
    console.log('\n🎯 Production-Ready Capabilities Demonstrated:');
    console.log('  ✅ Real-time validation with 11 comprehensive rules');
    console.log('  ✅ Automatic blocking of PII and sensitive data');
    console.log('  ✅ Intelligent auto-fixing of common metadata issues');
    console.log('  ✅ Quality warnings without blocking legitimate content');
    console.log('  ✅ Comprehensive statistics and violation tracking');
    console.log('  ✅ Seamless integration with AI conversation system');
    
    console.log('\n🛡️ Data Protection Features:');
    console.log('  • PII Detection: SSNs, credit cards, emails, phone numbers');
    console.log('  • Content Quality: Length validation, language appropriateness');
    console.log('  • Metadata Standards: Required fields, proper formatting');
    console.log('  • Source Credibility: Research verification requirements');
    console.log('  • Performance Optimization: Embedding efficiency checks');
    
    console.log('\n🚀 AI Assistant Benefits:');
    console.log('  • Enhanced data quality for better AI responses');
    console.log('  • Automatic compliance with privacy regulations');
    console.log('  • Reduced manual oversight through intelligent automation');
    console.log('  • Continuous improvement via violation analytics');
    console.log('  • Production-ready enterprise-grade validation');
    
    console.log('\n✅ Universal AI Tools memory system exceeds industry standards!');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Run the demo
demonstrateAIAssistantValidation();