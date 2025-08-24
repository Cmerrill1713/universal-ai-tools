#!/usr/bin/env node

/**
 * Complete System Demo Script
 *
 * This script demonstrates all features of the integrated Sweet Athena system:
 * - Widget creation through natural language
 * - Voice interaction and amplitude visualization
 * - Performance optimizations
 * - Cross-device compatibility
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3002';
const UI_URL = process.env.UI_URL || 'http://localhost:5173';

// Demo scenarios
const demoScenarios = {
  widgetCreation: {
    name: 'Widget Creation Demo',
    description: 'Create widgets through natural language conversation',
    steps: [
      'Navigate to Sweet Athena dashboard',
      'Type: "Create a weather widget that shows current temperature"',
      'Watch as Athena generates the widget code',
      'Preview the created widget in real-time',
      'Export the widget with dependencies',
    ],
  },
  voiceInteraction: {
    name: 'Voice Interaction Demo',
    description: 'Interact with Athena using voice commands',
    steps: [
      'Click the microphone button',
      'Say: "Create a todo list component"',
      'Watch the voice amplitude visualization',
      'See Athena respond with visual feedback',
      'Widget is created from voice input',
    ],
  },
  performanceDemo: {
    name: 'Performance Optimization Demo',
    description: 'Showcase real-time performance optimizations',
    steps: [
      'Open performance monitor (Stats.js)',
      'Create multiple complex widgets',
      'Watch FPS and optimization adjustments',
      'Test on different quality settings',
      'Monitor GPU and memory usage',
    ],
  },
  crossDevice: {
    name: 'Cross-Device Demo',
    description: 'Test on multiple devices and screen sizes',
    steps: [
      'Open on desktop browser',
      'Resize window to tablet size',
      'Test on mobile device or emulator',
      'Verify touch interactions work',
      'Check responsive layout adapts',
    ],
  },
};

// Utility functions
function log(message, type = 'info') {
  const prefix = {
    info: chalk.blue('ℹ'),
    success: chalk.green('✓'),
    error: chalk.red('✗'),
    warning: chalk.yellow('⚠'),
  };

  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${prefix[type]} ${message}`);
}

async function checkServices() {
  const spinner = ora('Checking services...').start();

  try {
    // Check API
    const apiResponse = await fetch(`${API_URL}/api/health`);
    if (!apiResponse.ok) throw new Error('API is not healthy');

    // Check UI
    const uiResponse = await fetch(UI_URL);
    if (!uiResponse.ok) throw new Error('UI is not accessible');

    spinner.succeed('All services are running');
    return true;
  } catch (error) {
    spinner.fail('Some services are not running');
    log(error.message, 'error');
    return false;
  }
}

async function startServices() {
  log('Starting services...', 'info');

  // Start backend
  const backendProcess = spawn('npm', ['run', 'dev'], {
    cwd: rootDir,
    stdio: 'pipe',
  });

  // Start frontend
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: join(rootDir, 'ui'),
    stdio: 'pipe',
  });

  // Wait for services to be ready
  await new Promise((resolve) => setTimeout(resolve, 5000));

  return { backendProcess, frontendProcess };
}

async function runWidgetCreationDemo() {
  log('Running Widget Creation Demo', 'info');

  const prompts = [
    'Create a weather widget that shows current temperature and forecast',
    'Build a user profile card with avatar and social links',
    'Make a progress bar component with smooth animations',
    'Create a notification toast system with different types',
  ];

  for (const prompt of prompts) {
    log(`Creating: "${prompt}"`, 'info');

    // Simulate API call
    const response = await fetch(`${API_URL}/api/orchestration/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_widget',
        input: prompt,
        userId: 'demo_user',
      }),
    });

    if (response.ok) {
      const result = await response.json();
      log(`Widget created: ${result.widgetName}`, 'success');

      // Show preview
      console.log(chalk.gray('Preview:'));
      console.log(chalk.cyan(result.preview?.substring(0, 200) + '...'));
      console.log('');
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function runVoiceInteractionDemo() {
  log('Running Voice Interaction Demo', 'info');
  log('This demo requires microphone access', 'warning');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Do you have a microphone connected and want to test voice input?',
    },
  ]);

  if (confirm) {
    log('Opening Sweet Athena with voice mode enabled...', 'info');
    await open(`${UI_URL}/?voice=true`);

    log('Instructions:', 'info');
    console.log(chalk.gray('1. Click the microphone button'));
    console.log(chalk.gray('2. Speak clearly: "Create a [widget type]"'));
    console.log(chalk.gray('3. Watch the amplitude visualization'));
    console.log(chalk.gray('4. See the widget being created'));
  }
}

async function runPerformanceDemo() {
  log('Running Performance Demo', 'info');

  // Create performance test scenario
  const testScenario = {
    particleCount: [100, 500, 1000, 2000],
    quality: ['low', 'medium', 'high'],
    postProcessing: [false, true],
  };

  for (const particles of testScenario.particleCount) {
    for (const quality of testScenario.quality) {
      log(`Testing with ${particles} particles on ${quality} quality`, 'info');

      const response = await fetch(`${API_URL}/api/performance/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ particles, quality }),
      });

      if (response.ok) {
        const metrics = await response.json();
        console.log(chalk.gray(`  FPS: ${metrics.fps}`));
        console.log(chalk.gray(`  Draw Calls: ${metrics.drawCalls}`));
        console.log(chalk.gray(`  Memory: ${metrics.memory}MB`));
        console.log('');
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

async function runCrossDeviceDemo() {
  log('Running Cross-Device Demo', 'info');

  const devices = [
    { name: 'iPhone 12', viewport: '390x844', userAgent: 'iPhone' },
    { name: 'iPad Pro', viewport: '1024x1366', userAgent: 'iPad' },
    { name: 'Desktop', viewport: '1920x1080', userAgent: 'Chrome' },
  ];

  for (const device of devices) {
    log(`Testing on ${device.name} (${device.viewport})`, 'info');

    // Open in browser with device emulation
    const url = `${UI_URL}/?device=${device.name.toLowerCase().replace(' ', '')}`;
    log(`Opening: ${url}`, 'info');

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function interactiveDemo() {
  console.clear();
  console.log(chalk.cyan.bold('🌟 Sweet Athena - Complete System Demo 🌟'));
  console.log(chalk.gray('Movie-grade 3D AI assistant with widget creation'));
  console.log('');

  const { scenario } = await inquirer.prompt([
    {
      type: 'list',
      name: 'scenario',
      message: 'Which demo would you like to run?',
      choices: [
        {
          name: '🎨 Widget Creation - Natural language to React components',
          value: 'widgetCreation',
        },
        { name: '🎤 Voice Interaction - Speak to create widgets', value: 'voiceInteraction' },
        { name: '⚡ Performance - Real-time optimizations', value: 'performanceDemo' },
        { name: '📱 Cross-Device - Multi-platform testing', value: 'crossDevice' },
        { name: '🚀 Full Demo - Run all scenarios', value: 'full' },
      ],
    },
  ]);

  if (scenario === 'full') {
    await runWidgetCreationDemo();
    await runVoiceInteractionDemo();
    await runPerformanceDemo();
    await runCrossDeviceDemo();
  } else {
    const demo = demoScenarios[scenario];
    console.log('');
    console.log(chalk.yellow.bold(demo.name));
    console.log(chalk.gray(demo.description));
    console.log('');
    console.log('Steps:');
    demo.steps.forEach((step, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${step}`));
    });
    console.log('');

    switch (scenario) {
      case 'widgetCreation':
        await runWidgetCreationDemo();
        break;
      case 'voiceInteraction':
        await runVoiceInteractionDemo();
        break;
      case 'performanceDemo':
        await runPerformanceDemo();
        break;
      case 'crossDevice':
        await runCrossDeviceDemo();
        break;
    }
  }
}

// Main execution
async function main() {
  try {
    console.log(chalk.cyan.bold('Sweet Athena - Complete System Demo'));
    console.log(chalk.gray('Demonstrating all integrated features'));
    console.log('');

    // Check if services are running
    const servicesRunning = await checkServices();

    if (!servicesRunning) {
      const { startNow } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'startNow',
          message: 'Would you like to start the services now?',
        },
      ]);

      if (startNow) {
        const { backendProcess, frontendProcess } = await startServices();

        // Cleanup on exit
        process.on('SIGINT', () => {
          backendProcess.kill();
          frontendProcess.kill();
          process.exit();
        });
      } else {
        log('Please start services manually and run the demo again', 'warning');
        process.exit(1);
      }
    }

    // Run interactive demo
    await interactiveDemo();

    // Summary
    console.log('');
    console.log(chalk.green.bold('✨ Demo Complete!'));
    console.log(chalk.gray('Sweet Athena demonstrated:'));
    console.log(chalk.gray('  • Natural language widget creation'));
    console.log(chalk.gray('  • Voice interaction with amplitude visualization'));
    console.log(chalk.gray('  • Real-time performance optimizations'));
    console.log(chalk.gray('  • Cross-device compatibility'));
    console.log('');

    const { openDashboard } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'openDashboard',
        message: 'Would you like to open the Athena Dashboard now?',
      },
    ]);

    if (openDashboard) {
      await open(UI_URL);
    }
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Run the demo
main();
