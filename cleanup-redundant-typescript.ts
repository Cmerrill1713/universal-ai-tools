#!/usr/bin/env tsx
/**
 * Cleanup Redundant TypeScript Services
 * Removes TypeScript implementations that have been replaced by Rust or Go
 */

import fs from 'fs';
import path from 'path';

// Services that have Rust/Go replacements and should be removed
const REDUNDANT_SERVICES = {
  // Replaced by Rust crates/
  'src/services/redis-service.ts': 'crates/redis-service',
  'src/services/vision-resource-manager.ts': 'crates/vision-resource-manager',
  'src/services/vision-resource-manager-rust.ts': 'crates/vision-resource-manager',
  'src/services/vision-resource-manager-enhanced.ts': 'crates/vision-resource-manager',
  'src/services/advanced-vision-service.ts': 'crates/vision-service',
  'src/services/voice-processing-service.ts': 'crates/voice-processing',
  'src/services/fast-llm-coordinator.ts': 'crates/fast-llm-coordinator',
  'src/services/fast-llm-coordinator-rust.ts': 'crates/fast-llm-coordinator',
  'src/services/parameter-analytics-service.ts': 'crates/parameter-analytics',
  'src/services/llm-router.ts': 'crates/llm-router',
  'src/services/mlx-bridge.ts': 'crates/mlx-bridge',
  'src/services/agent-orchestration.ts': 'crates/agent-orchestration',
  
  // Replaced by rust-services/
  'src/services/ab-mcts-service.ts': 'rust-services/ab-mcts-service',
  'src/services/ab-mcts-rust-integration.ts': 'rust-services/ab-mcts-service',
  'src/services/ab-mcts-tree-storage.ts': 'rust-services/ab-mcts-service',
  'src/services/ab-mcts-auto-pilot.ts': 'rust-services/ab-mcts-service',
  'src/services/intelligent-parameter-service.ts': 'rust-services/intelligent-parameter-service',
  'src/services/intelligent-parameter-native.ts': 'rust-services/intelligent-parameter-service',
  'src/services/ml-inference-service.ts': 'rust-services/ml-inference-service',
  'src/services/multimodal-fusion-service.ts': 'rust-services/multimodal-fusion-service',
  'src/services/parameter-analytics-service.ts': 'rust-services/parameter-analytics-service',
  
  // Replaced by Go services
  'src/services/websocket-service.ts': 'go-services/websocket-hub',
  'src/services/athena-websocket.ts': 'go-services/websocket-hub',
  'src/services/memory-service.ts': 'go-services/memory-service',
  'src/services/visual-memory-service.ts': 'go-services/memory-service',
  'src/services/chat-service.ts': 'go-services/chat-service',
  'src/services/cache-service.ts': 'go-services/cache-coordinator',
  'src/services/message-broker.ts': 'go-services/message-broker',
  'src/services/api-gateway.ts': 'go-services/api-gateway',
  'src/services/ml-stream-processor.ts': 'go-services/ml-stream-processor',
  
  // Duplicate implementations
  'src/services/healing-coordinator.ts': 'consolidated into healing-service',
  'src/services/healing-learning-database.ts': 'consolidated into healing-service',
  'src/services/enhanced-healing-optimizer.ts': 'consolidated into healing-service',
  'src/services/enhanced-healing-orchestrator.ts': 'consolidated into healing-service',
  'src/services/healing-mlx-training-pipeline.ts': 'consolidated into healing-service',
  'src/services/healing-rollback-service.ts': 'consolidated into healing-service',
  'src/services/healing-integration-test-suite.ts': 'moved to tests/',
};

// Additional patterns to clean up
const CLEANUP_PATTERNS = [
  'src/services/*-backup.ts',
  'src/services/*-old.ts',
  'src/services/*-deprecated.ts',
  'src/services/*-test.ts',
  'src/services/test-*.ts',
  'src/services/demo-*.ts',
  'src/services/example-*.ts',
];

async function cleanupRedundantServices() {
  console.log('🧹 Starting TypeScript redundancy cleanup...\n');
  
  let removedCount = 0;
  let totalSize = 0;
  
  // Remove explicitly redundant services
  for (const [tsFile, replacement] of Object.entries(REDUNDANT_SERVICES)) {
    const fullPath = path.join(process.cwd(), tsFile);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      totalSize += stats.size;
      
      console.log(`❌ Removing ${tsFile}`);
      console.log(`   └─ Replaced by: ${replacement}`);
      
      fs.unlinkSync(fullPath);
      removedCount++;
    }
  }
  
  // Clean up pattern-based files
  const glob = await import('glob');
  for (const pattern of CLEANUP_PATTERNS) {
    const files = await glob.glob(pattern);
    for (const file of files) {
      const stats = fs.statSync(file);
      totalSize += stats.size;
      
      console.log(`❌ Removing ${file} (cleanup pattern)`);
      fs.unlinkSync(file);
      removedCount++;
    }
  }
  
  // Find and report remaining TypeScript services
  const remainingServices = await glob.glob('src/services/*.ts');
  const essentialServices = remainingServices.filter(file => {
    const basename = path.basename(file);
    // Keep only essential orchestration and bridge files
    return basename.includes('bridge') || 
           basename.includes('coordinator') ||
           basename === 'server.ts' ||
           basename === 'router.ts' ||
           basename === 'index.ts';
  });
  
  console.log('\n📊 Cleanup Summary:');
  console.log(`   • Files removed: ${removedCount}`);
  console.log(`   • Space freed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   • Essential services kept: ${essentialServices.length}`);
  console.log(`   • Remaining to review: ${remainingServices.length - essentialServices.length}`);
  
  if (remainingServices.length - essentialServices.length > 0) {
    console.log('\n⚠️  Services that may need further review:');
    remainingServices
      .filter(f => !essentialServices.includes(f))
      .slice(0, 10)
      .forEach(f => console.log(`   • ${f}`));
  }
  
  return { removedCount, totalSize, remaining: remainingServices.length };
}

// Update imports in remaining files
async function updateImports() {
  console.log('\n🔄 Updating imports to use Rust/Go bridges...');
  
  const filesToUpdate = [
    'src/server.ts',
    'src/routers/*.ts',
    'src/index.ts',
  ];
  
  const glob = await import('glob');
  const files = await glob.glob(filesToUpdate);
  
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;
    
    // Replace TypeScript service imports with bridge imports
    if (content.includes("from './services/redis-service'")) {
      content = content.replace(
        /from ['"]\.\/services\/redis-service['"]/g,
        "from '../crates/redis-service'"
      );
      modified = true;
    }
    
    if (content.includes("from './services/vision-resource-manager")) {
      content = content.replace(
        /from ['"]\.\/services\/vision-resource-manager[^'"]*['"]/g,
        "from '../crates/vision-resource-manager'"
      );
      modified = true;
    }
    
    if (modified) {
      fs.writeFileSync(file, content);
      console.log(`   ✅ Updated imports in ${file}`);
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 TypeScript Redundancy Cleanup Tool\n');
    console.log('This will remove TypeScript services that have been replaced by Rust or Go.\n');
    
    // Perform cleanup
    const result = await cleanupRedundantServices();
    
    // Update imports
    await updateImports();
    
    console.log('\n✅ Cleanup complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run: npm run build');
    console.log('   2. Test the system: npm test');
    console.log('   3. Verify Rust/Go services are running');
    
    // Report final stats
    const tsFiles = await import('glob').then(g => g.glob('src/**/*.ts'));
    console.log(`\n📊 Final statistics:`);
    console.log(`   • Total TypeScript files: ${tsFiles.length}`);
    console.log(`   • Removed: ${result.removedCount} files`);
    console.log(`   • Space saved: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { cleanupRedundantServices, updateImports };