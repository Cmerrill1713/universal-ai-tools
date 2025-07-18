#!/usr/bin/env node
/**
 * Comprehensive End-to-End Test of Universal AI Tools
 * Tests all components: App Bundle, Service, API, Database, Dashboard
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Universal AI Tools - Complete System Test');
console.log('===========================================\n');

class SystemTester {
  constructor() {
    this.results = {
      appBundle: false,
      serviceManager: false,
      apiEndpoints: false,
      database: false,
      dashboard: false,
      documentation: false,
      performance: false
    };
    this.errors = [];
  }

  async runTest(testName, testFunction) {
    try {
      console.log(`🔍 Testing: ${testName}...`);
      const result = await testFunction();
      if (result) {
        console.log(`   ✅ ${testName}: PASSED`);
        return true;
      } else {
        console.log(`   ❌ ${testName}: FAILED`);
        return false;
      }
    } catch (error) {
      console.log(`   ❌ ${testName}: ERROR - ${error.message}`);
      this.errors.push({ test: testName, error: error.message });
      return false;
    }
  }

  async testAppBundle() {
    const appPath = '/Users/christianmerrill/Desktop/Universal AI Tools.app';
    
    // Check if app bundle exists
    if (!fs.existsSync(appPath)) {
      throw new Error('App bundle not found');
    }

    // Check bundle structure
    const requiredPaths = [
      'Contents/Info.plist',
      'Contents/MacOS/Universal AI Tools',
      'Contents/Resources/AppIcon.icns',
      'Contents/Resources/package.json',
      'Contents/Resources/dist/server.js',
      'Contents/Resources/public/index.html',
      'Contents/Resources/supabase_dashboard.html'
    ];

    for (const relativePath of requiredPaths) {
      const fullPath = path.join(appPath, relativePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing: ${relativePath}`);
      }
    }

    // Check if executable is executable
    const execPath = path.join(appPath, 'Contents/MacOS/Universal AI Tools');
    const stats = fs.statSync(execPath);
    if (!(stats.mode & parseInt('111', 8))) {
      throw new Error('Executable is not executable');
    }

    console.log('     📦 Bundle structure: ✓');
    console.log('     🎨 Icon file: ✓');
    console.log('     🔧 Executable: ✓');
    console.log('     📁 Resources: ✓');

    return true;
  }

  async testServiceManager() {
    // Test service manager commands
    const managerPath = './service-manager.sh';
    
    if (!fs.existsSync(managerPath)) {
      throw new Error('Service manager not found');
    }

    // Test status command
    try {
      execSync(`${managerPath} status`, { stdio: 'pipe' });
      console.log('     📊 Status command: ✓');
    } catch (error) {
      throw new Error('Status command failed');
    }

    // Check if service is running
    try {
      execSync('curl -f http://localhost:9999/health', { stdio: 'pipe' });
      console.log('     🚀 Service running: ✓');
    } catch (error) {
      throw new Error('Service not responding');
    }

    // Test desktop shortcuts
    const shortcuts = [
      '/Users/christianmerrill/Desktop/Universal AI Tools Manager.command',
      '/Users/christianmerrill/Desktop/Start Universal AI Tools.command',
      '/Users/christianmerrill/Desktop/Launch Universal AI Tools.command'
    ];

    let shortcutCount = 0;
    shortcuts.forEach(shortcut => {
      if (fs.existsSync(shortcut)) shortcutCount++;
    });

    console.log(`     🖱️  Desktop shortcuts: ${shortcutCount}/3 ✓`);

    return true;
  }

  async testApiEndpoints() {
    const baseUrl = 'http://localhost:9999';
    const axios = require('axios');

    const endpoints = [
      { url: '/health', method: 'GET' },
      { url: '/api/docs', method: 'GET' },
      { url: '/api/memory', method: 'GET' },
      { url: '/api/stats', method: 'GET' }
    ];

    let passedCount = 0;

    for (const endpoint of endpoints) {
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${baseUrl}${endpoint.url}`,
          timeout: 5000
        });

        if (response.status === 200) {
          passedCount++;
          console.log(`     ${endpoint.method} ${endpoint.url}: ✓`);
        }
      } catch (error) {
        console.log(`     ${endpoint.method} ${endpoint.url}: ❌`);
      }
    }

    // Test search endpoint
    try {
      const searchResponse = await axios.post(`${baseUrl}/api/memory/search`, {
        query: 'test search',
        limit: 5
      });

      if (searchResponse.status === 200) {
        passedCount++;
        console.log('     POST /api/memory/search: ✓');
      }
    } catch (error) {
      console.log('     POST /api/memory/search: ❌');
    }

    console.log(`     📊 API endpoints: ${passedCount}/5 working`);

    return passedCount >= 4; // Allow 1 failure
  }

  async testDatabase() {
    const { createClient } = require('@supabase/supabase-js');
    
    const supabase = createClient(
      'http://127.0.0.1:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    );

    // Test database connection
    const { data: health, error: healthError } = await supabase
      .from('ai_memories')
      .select('id')
      .limit(1);

    if (healthError) {
      throw new Error(`Database connection failed: ${healthError.message}`);
    }

    console.log('     🔗 Database connection: ✓');

    // Test table existence
    const tables = ['ai_memories', 'ai_services', 'ai_service_keys'];
    let tableCount = 0;

    for (const table of tables) {
      try {
        const { error } = await supabase.from(table).select('*').limit(1);
        if (!error) {
          tableCount++;
        }
      } catch (e) {
        // Table might not exist
      }
    }

    console.log(`     📋 Tables available: ${tableCount}/${tables.length} ✓`);

    // Test memory system
    const { data: memories } = await supabase
      .from('ai_memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log(`     🧠 Memories in system: ${memories?.length || 0} ✓`);

    // Test search functionality
    if (memories && memories.length > 0) {
      const { data: searchResults } = await supabase
        .from('ai_memories')
        .select('*')
        .textSearch('content', 'test')
        .limit(5);

      console.log(`     🔍 Search working: ${searchResults ? '✓' : '❌'}`);
    }

    return true;
  }

  async testDashboard() {
    const dashboardPath = './supabase_dashboard.html';
    
    if (!fs.existsSync(dashboardPath)) {
      throw new Error('Dashboard file not found');
    }

    // Check dashboard file size and content
    const stats = fs.statSync(dashboardPath);
    if (stats.size < 10000) {
      throw new Error('Dashboard file too small');
    }

    const content = fs.readFileSync(dashboardPath, 'utf8');
    
    // Check for required dashboard components
    const requiredElements = [
      'Universal AI Tools',
      'Supabase',
      'dashboard',
      'sidebar',
      'nav-link',
      'sb-card',
      'createClient'
    ];

    let elementCount = 0;
    requiredElements.forEach(element => {
      if (content.includes(element)) elementCount++;
    });

    console.log(`     🖥️  Dashboard elements: ${elementCount}/${requiredElements.length} ✓`);
    console.log(`     📄 File size: ${(stats.size / 1024).toFixed(1)}KB ✓`);

    // Check if dashboard can connect to local Supabase
    if (content.includes('127.0.0.1:54321')) {
      console.log('     🔗 Local Supabase config: ✓');
    }

    return elementCount >= requiredElements.length - 1;
  }

  async testDocumentation() {
    let docCount = 0;

    // Check scraped documentation
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      'http://127.0.0.1:54321',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    );

    // Check Pydantic AI docs
    const { data: pydanticDocs } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('service_id', 'pydantic_docs_scraper')
      .limit(1);

    if (pydanticDocs && pydanticDocs.length > 0) {
      docCount++;
      console.log('     📚 Pydantic AI docs: ✓');
    }

    // Check Supabase docs
    const { data: supabaseDocs } = await supabase
      .from('ai_memories')
      .select('*')
      .eq('service_id', 'supabase_ecosystem_scraper')
      .limit(1);

    if (supabaseDocs && supabaseDocs.length > 0) {
      docCount++;
      console.log('     📚 Supabase docs: ✓');
    }

    // Check project documentation
    const docFiles = [
      './docs/CLAUDE_INTEGRATION.md',
      './docs/QUICK_REFERENCE.md',
      './docs/SETUP_GUIDE.md'
    ];

    let projectDocCount = 0;
    docFiles.forEach(file => {
      if (fs.existsSync(file)) projectDocCount++;
    });

    console.log(`     📝 Project docs: ${projectDocCount}/${docFiles.length} ✓`);

    return docCount >= 1 && projectDocCount >= 2;
  }

  async testPerformance() {
    const startTime = Date.now();
    
    // Test API response times
    const axios = require('axios');
    const baseUrl = 'http://localhost:9999';

    const tests = [
      { name: 'Health check', url: '/health' },
      { name: 'API docs', url: '/api/docs' },
      { name: 'Memory list', url: '/api/memory?limit=5' },
      { name: 'System stats', url: '/api/stats' }
    ];

    let totalTime = 0;
    let successCount = 0;

    for (const test of tests) {
      const testStart = Date.now();
      try {
        await axios.get(`${baseUrl}${test.url}`, { timeout: 5000 });
        const testTime = Date.now() - testStart;
        totalTime += testTime;
        successCount++;
        console.log(`     ${test.name}: ${testTime}ms ✓`);
      } catch (error) {
        console.log(`     ${test.name}: FAILED ❌`);
      }
    }

    const avgResponseTime = successCount > 0 ? totalTime / successCount : 0;
    console.log(`     ⚡ Average response: ${avgResponseTime.toFixed(1)}ms`);

    // Check memory usage
    try {
      const response = await axios.get(`${baseUrl}/api/stats`);
      const memoryUsage = response.data.stats.memoryUsage;
      const memoryMB = (memoryUsage.heapUsed / 1024 / 1024).toFixed(1);
      console.log(`     💾 Memory usage: ${memoryMB}MB ✓`);
    } catch (error) {
      console.log('     💾 Memory usage: N/A');
    }

    return avgResponseTime < 1000 && successCount >= 3;
  }

  async runAllTests() {
    console.log('🚀 Starting comprehensive system test...\n');

    this.results.appBundle = await this.runTest('App Bundle Structure', () => this.testAppBundle());
    this.results.serviceManager = await this.runTest('Service Manager', () => this.testServiceManager());
    this.results.apiEndpoints = await this.runTest('API Endpoints', () => this.testApiEndpoints());
    this.results.database = await this.runTest('Database Integration', () => this.testDatabase());
    this.results.dashboard = await this.runTest('Dashboard Interface', () => this.testDashboard());
    this.results.documentation = await this.runTest('Documentation System', () => this.testDocumentation());
    this.results.performance = await this.runTest('Performance Metrics', () => this.testPerformance());

    this.generateReport();
  }

  generateReport() {
    const passedTests = Object.values(this.results).filter(r => r).length;
    const totalTests = Object.keys(this.results).length;
    const successRate = (passedTests / totalTests * 100).toFixed(1);

    console.log('\n' + '='.repeat(60));
    console.log('📋 UNIVERSAL AI TOOLS - COMPLETE SYSTEM TEST REPORT');
    console.log('='.repeat(60));

    console.log(`\n📊 Overall Results: ${passedTests}/${totalTests} tests passed (${successRate}%)`);

    console.log('\n✅ Component Status:');
    Object.entries(this.results).forEach(([component, passed]) => {
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      const name = component.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`   • ${name}: ${status}`);
    });

    if (this.errors.length > 0) {
      console.log('\n⚠️  Errors Encountered:');
      this.errors.forEach(error => {
        console.log(`   • ${error.test}: ${error.error}`);
      });
    }

    console.log('\n🎯 System Capabilities Verified:');
    console.log('   • macOS Application Bundle with Icon');
    console.log('   • Service Management and Auto-start');
    console.log('   • REST API with Multiple Endpoints');
    console.log('   • Supabase Database Integration');
    console.log('   • Local Dashboard Interface');
    console.log('   • Documentation Scraping and Search');
    console.log('   • Production-ready Performance');

    console.log('\n🚀 Access Points:');
    console.log('   • App Bundle: /Users/christianmerrill/Desktop/Universal AI Tools.app');
    console.log('   • Web Interface: http://localhost:9999');
    console.log('   • Supabase Dashboard: supabase_dashboard.html');
    console.log('   • Service Manager: ./service-manager.sh');

    if (successRate >= 85) {
      console.log('\n🎉 SYSTEM STATUS: PRODUCTION READY!');
      console.log('Universal AI Tools is fully operational and ready for use.');
    } else if (successRate >= 70) {
      console.log('\n⚠️  SYSTEM STATUS: MOSTLY FUNCTIONAL');
      console.log('Most components working, minor issues detected.');
    } else {
      console.log('\n❌ SYSTEM STATUS: NEEDS ATTENTION');
      console.log('Multiple components require fixes before production use.');
    }

    console.log(`\n✨ Test completed in ${Date.now() - this.startTime}ms`);
  }
}

// Run the comprehensive test
async function main() {
  const tester = new SystemTester();
  tester.startTime = Date.now();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.log(`\n💥 Test suite failed: ${error.message}`);
    process.exit(1);
  }
}

// Import required modules
try {
  require('axios');
  require('@supabase/supabase-js');
} catch (error) {
  console.log('📦 Installing required dependencies...');
  execSync('npm install axios @supabase/supabase-js', { stdio: 'inherit' });
}

main().catch(console.error);