/**
 * Test Smart Auto-Healing System
 * Demonstrates how the system automatically detects and fixes issues
 */

import { smartAutoHealingProcessor } from './src/services/smart-auto-healing-processor';

async function testSmartHealing() {
  console.log('🧪 Testing Smart Auto-Healing System');
  console.log('===================================\n');

  try {
    // Start the processor
    await smartAutoHealingProcessor.start();
    console.log('✅ Smart Auto-Healing Processor started\n');

    // Test 1: Normal message that should work
    console.log('Test 1: Normal message processing');
    console.log('--------------------------------');
    const normalResult = await smartAutoHealingProcessor.processMessage({
      id: 'test-normal-1',
      content: 'Hello, can you help me with a simple task?',
      userId: 'test-user',
      timestamp: Date.now(),
    });
    console.log(`Result: ${normalResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Response: ${normalResult.response}`);
    console.log(`Auto-healed: ${normalResult.autoFixed}\n`);

    // Test 2: Message that will trigger syntax error healing
    console.log('Test 2: Message triggering syntax error healing');
    console.log('-----------------------------------------------');
    const syntaxResult = await smartAutoHealingProcessor.processMessage({
      id: 'test-syntax-1',
      content: 'Process this: { invalid json syntax error missing quotes }',
      userId: 'test-user',
      timestamp: Date.now(),
      context: { expectError: 'syntax' },
    });
    console.log(`Result: ${syntaxResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Response: ${syntaxResult.response || syntaxResult.error}`);
    console.log(`Auto-healed: ${syntaxResult.autoFixed}`);
    if (syntaxResult.healingActions && syntaxResult.healingActions.length > 0) {
      console.log('Healing actions taken:');
      syntaxResult.healingActions.forEach((action, i) => {
        console.log(`  ${i + 1}. ${action.description} (${action.executed ? 'executed' : 'skipped'})`);
      });
    }
    console.log();

    // Test 3: Message that will trigger service healing
    console.log('Test 3: Message triggering service healing');
    console.log('------------------------------------------');
    const serviceResult = await smartAutoHealingProcessor.processMessage({
      id: 'test-service-1',
      content: 'Connect to service that is unavailable: connection refused error 503',
      userId: 'test-user',
      timestamp: Date.now(),
      context: { expectError: 'service' },
    });
    console.log(`Result: ${serviceResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Response: ${serviceResult.response || serviceResult.error}`);
    console.log(`Auto-healed: ${serviceResult.autoFixed}`);
    if (serviceResult.healingActions && serviceResult.healingActions.length > 0) {
      console.log('Healing actions taken:');
      serviceResult.healingActions.forEach((action, i) => {
        console.log(`  ${i + 1}. ${action.description} (${action.executed ? 'executed' : 'skipped'})`);
      });
    }
    console.log();

    // Test 4: Message that will trigger parameter optimization
    console.log('Test 4: Message triggering parameter optimization');
    console.log('------------------------------------------------');
    const paramResult = await smartAutoHealingProcessor.processMessage({
      id: 'test-param-1',
      content: 'Generate response with invalid parameter configuration error',
      userId: 'test-user',
      timestamp: Date.now(),
      context: { expectError: 'parameter' },
    });
    console.log(`Result: ${paramResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    console.log(`Response: ${paramResult.response || paramResult.error}`);
    console.log(`Auto-healed: ${paramResult.autoFixed}`);
    if (paramResult.healingActions && paramResult.healingActions.length > 0) {
      console.log('Healing actions taken:');
      paramResult.healingActions.forEach((action, i) => {
        console.log(`  ${i + 1}. ${action.description} (${action.executed ? 'executed' : 'skipped'})`);
      });
    }
    console.log();

    // Show overall statistics
    console.log('Overall Statistics');
    console.log('==================');
    const stats = smartAutoHealingProcessor.getStats();
    console.log(`Total messages processed: ${stats.totalMessages}`);
    console.log(`Successful messages: ${stats.successfulMessages}`);
    console.log(`Failed messages: ${stats.failedMessages}`);
    console.log(`Auto-healed messages: ${stats.autoHealed}`);
    console.log(`Total healing actions: ${stats.healingActions}`);
    console.log(`Success rate: ${stats.totalMessages > 0 ? ((stats.successfulMessages / stats.totalMessages) * 100).toFixed(1) : 0}%`);
    console.log(`Healing rate: ${stats.totalMessages > 0 ? ((stats.autoHealed / stats.totalMessages) * 100).toFixed(1) : 0}%`);
    console.log(`Average response time: ${stats.averageResponseTime.toFixed(0)}ms`);

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    // Clean up 
    await smartAutoHealingProcessor.stop();
    console.log('\n🛑 Smart Auto-Healing Processor stopped');
  }
}

// Run the test
testSmartHealing().catch(console.error);