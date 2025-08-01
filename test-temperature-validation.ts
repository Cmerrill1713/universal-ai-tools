#!/usr/bin/env npx tsx
/**
 * Comprehensive Temperature Automation Validation
 */

import axios from 'axios';
import chalk from 'chalk';

interface TestCase {
  name: string;
  message: string;
  expectedTaskType: string;
  expectedTempRange: [number, number];
}

async function validateTemperatureAutomation() {
  console.log(chalk.blue.bold('\n🌡️  Validating Intelligent Temperature Automation\n'));

  const testCases: TestCase[] = [
    {
      name: 'Factual Question',
      message: 'What is the capital of France?',
      expectedTaskType: 'factual_qa',
      expectedTempRange: [0.0, 0.2]
    },
    {
      name: 'Math Problem',
      message: 'Calculate 15% of 200',
      expectedTaskType: 'factual_qa',
      expectedTempRange: [0.0, 0.1]
    },
    {
      name: 'Creative Writing',
      message: 'Write a haiku about artificial intelligence',
      expectedTaskType: 'creative_writing',
      expectedTempRange: [0.7, 1.0]
    },
    {
      name: 'Code Generation',
      message: 'Write a TypeScript function to reverse a string',
      expectedTaskType: 'code_generation',
      expectedTempRange: [0.1, 0.3]
    },
    {
      name: 'Reasoning Task',
      message: 'Explain the pros and cons of electric vehicles',
      expectedTaskType: 'reasoning',
      expectedTempRange: [0.2, 0.4]
    },
    {
      name: 'Summarization',
      message: 'Summarize the key features of TypeScript in 3 bullet points',
      expectedTaskType: 'summarization',
      expectedTempRange: [0.1, 0.3]
    },
    {
      name: 'Classification',
      message: 'Is this a positive or negative review: "The product exceeded my expectations"',
      expectedTaskType: 'classification',
      expectedTempRange: [0.0, 0.2]
    }
  ];

  let passed = 0;
  let failed = 0;

  // First, ensure server is running
  try {
    await axios.get('http://localhost:9999/health');
    console.log(chalk.green('✅ Server is running\n'));
  } catch {
    console.log(chalk.red('❌ Server is not running! Start with: npm run dev\n'));
    return;
  }

  for (const test of testCases) {
    try {
      console.log(chalk.yellow(`Testing: ${test.name}`));
      console.log(chalk.gray(`Message: "${test.message}"`));
      
      const response = await axios.post('http://localhost:9999/api/v1/chat', {
        message: test.message
      });
      
      const metadata = response.data.metadata || {};
      const params = metadata.parameters || {};
      const temperature = params.temperature;
      const taskType = metadata.taskType;
      
      // Check if temperature is in expected range
      const inRange = temperature !== undefined && 
                      temperature >= test.expectedTempRange[0] && 
                      temperature <= test.expectedTempRange[1];
      
      if (inRange) {
        console.log(chalk.green('✅ Temperature correctly set'));
        passed++;
      } else {
        console.log(chalk.red('❌ Temperature out of range'));
        failed++;
      }
      
      console.log(chalk.gray(`   Task Type: ${taskType || 'unknown'} (expected: ${test.expectedTaskType})`));
      console.log(chalk.gray(`   Temperature: ${temperature || 'not set'} (expected: ${test.expectedTempRange[0]}-${test.expectedTempRange[1]})`));
      console.log(chalk.gray(`   Model: ${response.data.model || 'unknown'}`));
      console.log(chalk.gray(`   Service: ${metadata.serviceUsed || 'unknown'}`));
      
      // Show a preview of the response
      const preview = response.data.response?.substring(0, 60) + '...';
      console.log(chalk.gray(`   Response: ${preview}`));
      console.log();
      
    } catch (error: any) {
      console.log(chalk.red('❌ Test failed'));
      console.log(chalk.gray(`   Error: ${error.message}`));
      failed++;
      console.log();
    }
  }

  // Summary
  console.log(chalk.blue.bold('\n📊 Temperature Automation Summary\n'));
  console.log(chalk.green(`✅ Passed: ${passed}/${testCases.length}`));
  if (failed > 0) {
    console.log(chalk.red(`❌ Failed: ${failed}/${testCases.length}`));
  }
  
  // Check intelligent parameter service
  console.log(chalk.blue('\n🧠 Intelligent Parameter Service Status\n'));
  try {
    const metricsResponse = await axios.get('http://localhost:9999/api/v1/monitoring/metrics');
    const metrics = metricsResponse.data;
    
    console.log(chalk.green('✅ Service is active'));
    console.log(chalk.gray(`   Total requests: ${metrics.totalRequests || 0}`));
    console.log(chalk.gray(`   Average response time: ${metrics.avgResponseTime || 0}ms`));
    
    // Show parameter effectiveness if available
    if (metrics.parameterEffectiveness) {
      console.log(chalk.gray('\n   Parameter Effectiveness:'));
      Object.entries(metrics.parameterEffectiveness).forEach(([model, effectiveness]) => {
        console.log(chalk.gray(`     ${model}: ${effectiveness}%`));
      });
    }
  } catch {
    console.log(chalk.yellow('⚠️  Could not fetch metrics'));
  }
  
  console.log(chalk.blue.bold('\n✨ Temperature Automation Validation Complete!\n'));
}

validateTemperatureAutomation().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});