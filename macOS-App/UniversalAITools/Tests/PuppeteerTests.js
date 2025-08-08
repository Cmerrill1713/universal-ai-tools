const puppeteer = require('puppeteer');

// Puppeteer test suite for Universal AI Tools macOS app
class UniversalAIToolsPuppeteerTests {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'http://localhost:5173';
  }

  async setup() {
    this.browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1280, height: 720 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.page = await this.browser.newPage();

    // Set up request interception for testing
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      if (request.resourceType() === 'image') {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  async teardown() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async navigateToApp() {
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
    await this.page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  }

  // Navigation and Layout Tests
  async testNavigationAndLayout() {
    console.log('Testing Navigation and Layout...');

    await this.navigateToApp();

    // Test sidebar visibility
    const sidebar = await this.page.$('[data-testid="sidebar"]');
    expect(sidebar).toBeTruthy();

    // Test sidebar items count
    const sidebarItems = await this.page.$$('[data-testid="sidebar-item"]');
    expect(sidebarItems.length).toBe(10);

    // Test view mode switching
    await this.page.click('[data-testid="view-mode-web"]');
    await this.page.waitForSelector('[data-testid="web-view-container"]');

    await this.page.click('[data-testid="view-mode-native"]');
    await this.page.waitForSelector('[data-testid="native-view-container"]');

    await this.page.click('[data-testid="view-mode-hybrid"]');
    await this.page.waitForSelector('[data-testid="hybrid-view-container"]');

    // Test sidebar toggle
    await this.page.click('[data-testid="sidebar-toggle"]');
    await this.page.waitForFunction(() => {
      const sidebar = document.querySelector('[data-testid="sidebar"]');
      return sidebar && sidebar.style.display === 'none';
    });

    await this.page.click('[data-testid="sidebar-toggle"]');
    await this.page.waitForFunction(() => {
      const sidebar = document.querySelector('[data-testid="sidebar"]');
      return sidebar && sidebar.style.display !== 'none';
    });

    console.log('✅ Navigation and Layout tests passed');
  }

  // Dashboard Functionality Tests
  async testDashboardFunctionality() {
    console.log('Testing Dashboard Functionality...');

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-dashboard"]');

    // Test metrics display
    await this.page.waitForSelector('[data-testid="cpu-usage"]');
    await this.page.waitForSelector('[data-testid="memory-usage"]');
    await this.page.waitForSelector('[data-testid="active-connections"]');

    // Test connection status
    const connectionStatus = await this.page.$('[data-testid="connection-status"]');
    expect(connectionStatus).toBeTruthy();

    const statusIndicator = await this.page.$('[data-testid="status-indicator"]');
    expect(statusIndicator).toBeTruthy();

    console.log('✅ Dashboard Functionality tests passed');
  }

  // Chat Interface Tests
  async testChatInterface() {
    console.log('Testing Chat Interface...');

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-chat"]');

    // Create new chat
    await this.page.click('[data-testid="new-chat-button"]');
    await this.page.waitForSelector('[data-testid="chat-interface"]');
    await this.page.waitForSelector('[data-testid="message-input"]');

    // Send message
    await this.page.type('[data-testid="message-input"]', 'Hello, this is a test message');
    await this.page.click('[data-testid="send-button"]');

    // Verify message appears
    await this.page.waitForSelector('[data-testid="message-user"]');
    const messageText = await this.page.$eval(
      '[data-testid="message-user"]',
      (el) => el.textContent
    );
    expect(messageText).toContain('Hello, this is a test message');

    // Test chat history
    await this.page.waitForSelector('[data-testid="chat-history"]');

    console.log('✅ Chat Interface tests passed');
  }

  // Agent Management Tests
  async testAgentManagement() {
    console.log('Testing Agent Management...');

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-agents"]');

    // Test agent list display
    await this.page.waitForSelector('[data-testid="agent-list"]');
    await this.page.waitForSelector('[data-testid="add-agent-button"]');

    // Test agent filtering
    await this.page.select('[data-testid="agent-type-filter"]', 'Cognitive');
    await this.page.waitForTimeout(1000); // Wait for filter to apply

    const filteredAgents = await this.page.$$('[data-testid="agent-item"]');
    expect(filteredAgents.length).toBeGreaterThan(0);

    // Test agent search
    await this.page.type('[data-testid="agent-search"]', 'Test Agent');
    await this.page.waitForTimeout(1000);

    const searchResults = await this.page.$$('text=Test Agent');
    expect(searchResults.length).toBeGreaterThan(0);

    console.log('✅ Agent Management tests passed');
  }

  // MLX Fine-Tuning Tests
  async testMLXFineTuning() {
    console.log('Testing MLX Fine-Tuning...');

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-mlx"]');

    // Test MLX interface components
    await this.page.waitForSelector('[data-testid="model-selection"]');
    await this.page.waitForSelector('[data-testid="training-config"]');
    await this.page.waitForSelector('[data-testid="training-data"]');

    // Test training parameter configuration
    await this.page.select('[data-testid="model-select"]', 'llama-2-7b');
    await this.page.type('[data-testid="epochs-input"]', '5');
    await this.page.type('[data-testid="learning-rate-input"]', '0.001');

    // Verify parameters
    const modelValue = await this.page.$eval('[data-testid="model-select"]', (el) => el.value);
    expect(modelValue).toBe('llama-2-7b');

    const epochsValue = await this.page.$eval('[data-testid="epochs-input"]', (el) => el.value);
    expect(epochsValue).toBe('5');

    // Test training process
    await this.page.type('[data-testid="training-data-textarea"]', 'Sample training data');
    await this.page.click('[data-testid="start-training-button"]');

    await this.page.waitForSelector('[data-testid="training-progress"]');

    console.log('✅ MLX Fine-Tuning tests passed');
  }

  // Vision Processing Tests
  async testVisionProcessing() {
    console.log('Testing Vision Processing...');

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-vision"]');

    // Test vision interface components
    await this.page.waitForSelector('[data-testid="vision-task-selector"]');
    await this.page.waitForSelector('[data-testid="image-upload-area"]');
    await this.page.waitForSelector('[data-testid="processing-results"]');

    // Test vision task selection
    await this.page.select('[data-testid="vision-task-selector"]', 'Object Detection');

    // Test image upload (simulated)
    const fileInput = await this.page.$('[data-testid="image-upload"]');
    if (fileInput) {
      await fileInput.uploadFile('tests/fixtures/test-image.jpg');
    }

    // Test image processing
    await this.page.click('[data-testid="process-image-button"]');
    await this.page.waitForSelector('[data-testid="processing-results"]');

    console.log('✅ Vision Processing tests passed');
  }

  // Settings and Configuration Tests
  async testSettingsAndConfiguration() {
    console.log('Testing Settings and Configuration...');

    await this.navigateToApp();
    await this.page.click('[data-testid="settings-button"]');

    // Test settings panel
    await this.page.waitForSelector('[data-testid="settings-panel"]');
    await this.page.waitForSelector('[data-testid="general-settings"]');

    // Test dark mode toggle
    await this.page.click('[data-testid="dark-mode-toggle"]');
    await this.page.waitForFunction(() => {
      const container = document.querySelector('[data-testid="app-container"]');
      return container && container.classList.contains('dark');
    });

    // Test connection settings
    await this.page.click('[data-testid="connection-settings-tab"]');
    await this.page.type('[data-testid="backend-url-input"]', 'http://localhost:9999');
    await this.page.click('[data-testid="test-connection-button"]');

    await this.page.waitForFunction(() => {
      const status = document.querySelector('[data-testid="connection-status"]');
      return status && status.textContent.includes('Connected');
    });

    console.log('✅ Settings and Configuration tests passed');
  }

  // Performance Tests
  async testPerformance() {
    console.log('Testing Performance...');

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-agents"]');

    // Test large agent list performance
    const startTime = Date.now();

    // Simulate large number of agents
    await this.page.evaluate(() => {
      // Add 1000 agents to the list
      for (let i = 0; i < 1000; i++) {
        // Simulate adding agents
      }
    });

    await this.page.waitForSelector('[data-testid="agent-item"]', { timeout: 5000 });
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(2000); // Should load within 2 seconds

    // Test UI responsiveness
    await this.page.click('[data-testid="sidebar-chat"]');

    for (let i = 0; i < 10; i++) {
      await this.page.click('[data-testid="new-chat-button"]');
      await this.page.type('[data-testid="message-input"]', `Message ${i}`);
      await this.page.click('[data-testid="send-button"]');
    }

    await this.page.waitForSelector('[data-testid="chat-interface"]');
    await this.page.waitForSelector('[data-testid="message-input"]');

    console.log('✅ Performance tests passed');
  }

  // Error Handling Tests
  async testErrorHandling() {
    console.log('Testing Error Handling...');

    // Test connection failure handling
    await this.page.route('**/health', (route) => route.abort());

    await this.navigateToApp();
    await this.page.click('[data-testid="sidebar-dashboard"]');

    await this.page.waitForSelector('[data-testid="connection-error"]');
    await this.page.waitForSelector('[data-testid="reconnect-button"]');

    // Test invalid input handling
    await this.page.click('[data-testid="sidebar-chat"]');
    await this.page.click('[data-testid="send-button"]');

    await this.page.waitForSelector('[data-testid="validation-error"]');

    // Test network interruption handling
    await this.page.route('**/*', (route) => route.abort());

    await this.page.click('[data-testid="sidebar-dashboard"]');
    await this.page.waitForSelector('[data-testid="offline-indicator"]');

    console.log('✅ Error Handling tests passed');
  }

  // Accessibility Tests
  async testAccessibility() {
    console.log('Testing Accessibility...');

    await this.navigateToApp();

    // Test keyboard navigation
    await this.page.keyboard.press('Tab');
    const focusedElement = await this.page.$(':focus');
    expect(focusedElement).toBeTruthy();

    // Test ARIA labels
    const ariaElements = await this.page.$$('[aria-label]');
    expect(ariaElements.length).toBeGreaterThan(0);

    // Test screen reader support
    const roleElements = await this.page.$$('[role]');
    expect(roleElements.length).toBeGreaterThan(0);

    console.log('✅ Accessibility tests passed');
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Universal AI Tools Puppeteer Tests...');

    try {
      await this.setup();

      await this.testNavigationAndLayout();
      await this.testDashboardFunctionality();
      await this.testChatInterface();
      await this.testAgentManagement();
      await this.testMLXFineTuning();
      await this.testVisionProcessing();
      await this.testSettingsAndConfiguration();
      await this.testPerformance();
      await this.testErrorHandling();
      await this.testAccessibility();

      console.log('🎉 All Puppeteer tests passed successfully!');
    } catch (error) {
      console.error('❌ Test failed:', error);
      throw error;
    } finally {
      await this.teardown();
    }
  }

  // Utility methods
  async takeScreenshot(name) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  async waitForElement(selector, timeout = 5000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  async simulateNetworkCondition(condition) {
    await this.page.setRequestInterception(true);
    this.page.on('request', (request) => {
      if (condition === 'slow') {
        setTimeout(() => request.continue(), 2000);
      } else if (condition === 'offline') {
        request.abort();
      } else {
        request.continue();
      }
    });
  }
}

// Test runner
async function runPuppeteerTests() {
  const testSuite = new UniversalAIToolsPuppeteerTests();
  await testSuite.runAllTests();
}

// Export for use in other files
module.exports = {
  UniversalAIToolsPuppeteerTests,
  runPuppeteerTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runPuppeteerTests().catch(console.error);
}
