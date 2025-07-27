#!/usr/bin/env node

import { PerformanceTestRunner } from '../src/tests/performance/performance-test-runner';
import { logger } from '../src/utils/logger';
import chalk from 'chalk';

async function main() {
  const args = process.argv.slice(2);
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  // Parse command line arguments
  const options = {
    duration: 60,
    concurrent_users: 20,
    include_ai_tests: args.includes('--ai'),
    include_websocket_tests: args.includes('--websocket'),
    include_stress_tests: args.includes('--stress'),
    data_size: 'medium' as 'small' | 'medium' | 'large',
    generate_report: true,
    output_format: 'console' as 'json' | 'html' | 'console',
  };

  // Override defaults with environment variables
  if (process.env.TEST_DURATION) options.duration = parseInt(process.env.TEST_DURATION);
  if (process.env.CONCURRENT_USERS)
    options.concurrent_users = parseInt(process.env.CONCURRENT_USERS);
  if (process.env.DATA_SIZE) options.data_size = process.env.DATA_SIZE as any;
  if (process.env.OUTPUT_FORMAT) options.output_format = process.env.OUTPUT_FORMAT as any;

  console.log(chalk.blue('🔥 Starting Universal AI Tools Performance Testing Suite'));
  console.log(chalk.dim(`Target URL: ${baseUrl}`));
  console.log(chalk.dim(`Test Configuration:`));
  console.log(chalk.dim(`  Duration: ${options.duration}s per test`));
  console.log(chalk.dim(`  Concurrent Users: ${options.concurrent_users}`));
  console.log(chalk.dim(`  Data Size: ${options.data_size}`));
  console.log(chalk.dim(`  AI Tests: ${options.include_ai_tests ? 'Yes' : 'No'}`));
  console.log(chalk.dim(`  WebSocket Tests: ${options.include_websocket_tests ? 'Yes' : 'No'}`));
  console.log(chalk.dim(`  Stress Tests: ${options.include_stress_tests ? 'Yes' : 'No'}`));

  try {
    const runner = new PerformanceTestRunner(baseUrl);
    const results = await runner.runComprehensivePerformanceTests(options);

    console.log(chalk.green('\n✅ Performance testing completed successfully!'));
    console.log(chalk.cyan(`Overall Performance Score: ${results.test_summary.overall_score}/100`));

    // Exit with appropriate code
    process.exit(results.test_summary.tests_failed > 0 ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('\n❌ Performance testing failed:'));
    console.error(error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in performance test:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in performance test:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}
