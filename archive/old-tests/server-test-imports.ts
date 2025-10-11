// Test script to identify which import causes the hang

console.log('📍 Starting import test...');

async function testImports() {
  const imports = [
    { name: 'ToolRouter', path: './src/routers/tools' },
    { name: 'MemoryRouter', path: './src/routers/memory' },
    { name: 'ContextRouter', path: './src/routers/context' },
    { name: 'KnowledgeRouter', path: './src/routers/knowledge' },
    { name: 'OrchestrationRouter', path: './src/routers/orchestration' },
    { name: 'SpeechRouter', path: './src/routers/speech' },
    { name: 'DocumentationRouter', path: './src/routers/documentation' },
    { name: 'BackupRouter', path: './src/routers/backup' },
    { name: 'HealthRouter', path: './src/routers/health' },
    { name: 'createKnowledgeMonitoringRouter', path: './src/routers/knowledge-monitoring' },
    { name: 'LoggingMiddleware', path: './src/middleware/logging-middleware' },
    { name: 'PrometheusMiddleware', path: './src/middleware/prometheus-middleware' },
    { name: 'DebugMiddleware', path: './src/middleware/debug-middleware' },
    { name: 'apiVersioning', path: './src/middleware/api-versioning' },
    { name: 'getOllamaAssistant', path: './src/services/ollama-assistant' },
    { name: 'dspyService', path: './src/services/dspy-service' },
    { name: 'PerformanceMiddleware', path: './src/middleware/performance' },
    { name: 'SecurityMiddleware', path: './src/middleware/security' },
    { name: 'createHealthCheckService', path: './src/services/health-check' },
    { name: 'DatabaseMigrationService', path: './src/services/database-migration' },
    { name: 'securityHardeningService', path: './src/services/security-hardening' },
  ];

  for (const imp of imports) {
    try {
      console.log(`\n📍 Testing import: ${imp.name} from ${imp.path}`);
      const startTime = Date.now();
      
      // Set a timeout for each import
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Import timeout')), 5000);
      });
      
      const importPromise = import(imp.path);
      
      await Promise.race([importPromise, timeoutPromise]);
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${imp.name} imported successfully in ${duration}ms`);
    } catch (error) {
      if (error.message === 'Import timeout') {
        console.error(`❌ ${imp.name} TIMED OUT - This is likely the hanging import!`);
        process.exit(1);
      } else {
        console.error(`❌ ${imp.name} failed to import:`, error.message);
      }
    }
  }
  
  console.log('\n✅ All imports tested successfully!');
  process.exit(0);
}

// Overall timeout
setTimeout(() => {
  console.error('\n❌ Overall test timeout reached');
  process.exit(1);
}, 60000);

testImports();