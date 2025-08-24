#!/usr/bin/env node

/**
 * Sweet Athena Integration Test Suite
 * Tests all components of the Sweet Athena system
 */

const WebSocket = require('ws');
const axios = require('axios');
const chalk = require('chalk');

class SweetAthenaTestSuite {
  constructor() {
    this.baseUrl = 'http://localhost:9999';
    this.wsUrl = 'ws://localhost:8888';
    this.ws = null;
    this.testResults = [];
    this.isConnected = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: chalk.blue,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow,
    };

    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`[${timestamp}] ${colors[type](message)}`);
  }

  async runAllTests() {
    this.log('🌸 Starting Sweet Athena Integration Tests', 'info');
    console.log(chalk.gray('='.repeat(50)));

    // Test 1: Backend Health
    await this.testBackendHealth();

    // Test 2: Signaling Server Connection
    await this.testSignalingServer();

    // Test 3: WebRTC Data Channel
    await this.testDataChannel();

    // Test 4: Personality Commands
    await this.testPersonalityCommands();

    // Test 5: Action Commands
    await this.testActionCommands();

    // Test 6: Chat Commands
    await this.testChatCommands();

    // Test 7: State Updates
    await this.testStateUpdates();

    // Print results
    this.printTestResults();
  }

  async testBackendHealth() {
    this.log('Testing backend server health...', 'info');

    try {
      const response = await axios.get(`${this.baseUrl}/health`);

      if (response.data.status === 'healthy') {
        this.addTestResult('Backend Health', true, 'Server is healthy');
      } else {
        this.addTestResult('Backend Health', false, 'Server unhealthy: ' + response.data.status);
      }
    } catch (error) {
      this.addTestResult('Backend Health', false, error.message);
    }
  }

  async testSignalingServer() {
    this.log('Testing signaling server connection...', 'info');

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        const timeout = setTimeout(() => {
          this.addTestResult('Signaling Server', false, 'Connection timeout');
          resolve();
        }, 5000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.isConnected = true;
          this.log('Connected to signaling server', 'success');
        });

        this.ws.on('message', (data) => {
          const message = JSON.parse(data.toString());

          if (message.type === 'welcome') {
            this.addTestResult('Signaling Server', true, 'Connected and welcomed');

            // Identify as viewer
            this.ws.send(JSON.stringify({ type: 'viewer', id: 'test-suite' }));

            setTimeout(resolve, 1000);
          }
        });

        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          this.addTestResult('Signaling Server', false, error.message);
          resolve();
        });
      } catch (error) {
        this.addTestResult('Signaling Server', false, error.message);
        resolve();
      }
    });
  }

  async testDataChannel() {
    this.log('Testing WebRTC data channel setup...', 'info');

    if (!this.isConnected) {
      this.addTestResult('Data Channel', false, 'Not connected to signaling server');
      return;
    }

    // Simulate data channel creation
    const testCommand = {
      type: 'avatar_command',
      data: {
        type: 'test',
        value: 'data_channel_test',
      },
    };

    try {
      this.ws.send(JSON.stringify(testCommand));
      this.addTestResult('Data Channel', true, 'Command sent successfully');
    } catch (error) {
      this.addTestResult('Data Channel', false, error.message);
    }
  }

  async testPersonalityCommands() {
    this.log('Testing personality change commands...', 'info');

    if (!this.isConnected) {
      this.addTestResult('Personality Commands', false, 'Not connected');
      return;
    }

    const personalities = ['sweet', 'shy', 'confident', 'caring', 'playful'];
    let successCount = 0;

    for (const personality of personalities) {
      try {
        const command = {
          type: 'avatar_command',
          data: {
            type: 'personality',
            value: personality,
          },
        };

        this.ws.send(JSON.stringify(command));
        this.log(`Sent personality change: ${personality}`, 'info');
        successCount++;

        // Small delay between commands
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        this.log(`Failed to send ${personality}: ${error.message}`, 'error');
      }
    }

    this.addTestResult(
      'Personality Commands',
      successCount === personalities.length,
      `${successCount}/${personalities.length} personalities tested`
    );
  }

  async testActionCommands() {
    this.log('Testing action commands...', 'info');

    if (!this.isConnected) {
      this.addTestResult('Action Commands', false, 'Not connected');
      return;
    }

    const actions = ['wave', 'dance', 'laugh', 'think'];
    let successCount = 0;

    for (const action of actions) {
      try {
        const command = {
          type: 'avatar_command',
          data: {
            type: 'action',
            value: action,
          },
        };

        this.ws.send(JSON.stringify(command));
        this.log(`Sent action: ${action}`, 'info');
        successCount++;

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        this.log(`Failed to send ${action}: ${error.message}`, 'error');
      }
    }

    this.addTestResult(
      'Action Commands',
      successCount === actions.length,
      `${successCount}/${actions.length} actions tested`
    );
  }

  async testChatCommands() {
    this.log('Testing chat commands...', 'info');

    if (!this.isConnected) {
      this.addTestResult('Chat Commands', false, 'Not connected');
      return;
    }

    const testMessages = [
      { text: 'Hello Sweet Athena!', personality: 'sweet' },
      { text: 'How are you today?', personality: 'caring' },
      { text: "Let's have some fun!", personality: 'playful' },
    ];

    let successCount = 0;

    for (const message of testMessages) {
      try {
        const command = {
          type: 'avatar_command',
          data: {
            type: 'chat',
            text: message.text,
            personality: message.personality,
          },
        };

        this.ws.send(JSON.stringify(command));
        this.log(`Sent chat: "${message.text}" (${message.personality})`, 'info');
        successCount++;

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        this.log(`Failed to send chat: ${error.message}`, 'error');
      }
    }

    this.addTestResult(
      'Chat Commands',
      successCount === testMessages.length,
      `${successCount}/${testMessages.length} messages tested`
    );
  }

  async testStateUpdates() {
    this.log('Testing state update reception...', 'info');

    if (!this.isConnected) {
      this.addTestResult('State Updates', false, 'Not connected');
      return;
    }

    // Listen for state updates
    let receivedUpdate = false;

    const stateHandler = (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'avatar_state') {
        receivedUpdate = true;
        this.log('Received avatar state update', 'success');
      }
    };

    this.ws.on('message', stateHandler);

    // Wait for potential state update
    await new Promise((resolve) => setTimeout(resolve, 3000));

    this.ws.off('message', stateHandler);

    this.addTestResult(
      'State Updates',
      receivedUpdate,
      receivedUpdate ? 'Received state updates' : 'No state updates received'
    );
  }

  addTestResult(testName, passed, details) {
    this.testResults.push({ testName, passed, details });
  }

  printTestResults() {
    console.log('\n' + chalk.gray('='.repeat(50)));
    console.log(chalk.bold('🌸 Sweet Athena Test Results:\n'));

    let passedCount = 0;

    this.testResults.forEach((result) => {
      const status = result.passed ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
      console.log(`${status} ${chalk.bold(result.testName)}`);
      console.log(chalk.gray(`   ${result.details}\n`));

      if (result.passed) passedCount++;
    });

    const totalTests = this.testResults.length;
    const passRate = ((passedCount / totalTests) * 100).toFixed(1);

    console.log(chalk.gray('='.repeat(50)));
    console.log(chalk.bold(`Total: ${passedCount}/${totalTests} passed (${passRate}%)`));

    if (passedCount === totalTests) {
      console.log(chalk.green('\n🎉 All tests passed! Sweet Athena is ready!'));
    } else {
      console.log(chalk.yellow('\n⚠️  Some tests failed. Check the logs above.'));
    }

    // Cleanup
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Run tests
const tester = new SweetAthenaTestSuite();
tester.runAllTests().catch((error) => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(chalk.red('Test suite error:'), error);
  process.exit(1);
});
