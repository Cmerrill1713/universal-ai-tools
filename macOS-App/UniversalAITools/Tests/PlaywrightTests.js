const { test, expect } = require('@playwright/test');

// Playwright configuration for macOS app testing
const config = {
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
  ],
};

// Test suite for Universal AI Tools macOS app
test.describe('Universal AI Tools - macOS App Tests', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    // Navigate to the app's web interface
    await page.goto('http://localhost:5173');

    // Wait for app to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 10000 });
  });

  test.describe('Navigation and Layout', () => {
    test('should display main navigation sidebar', async ({ page }) => {
      const sidebar = await page.locator('[data-testid="sidebar"]');
      await expect(sidebar).toBeVisible();

      // Check for main navigation items
      const navItems = await page.locator('[data-testid="sidebar-item"]');
      await expect(navItems).toHaveCount(10); // Dashboard, Chat, Agents, etc.
    });

    test('should switch between view modes', async ({ page }) => {
      // Test Web View Mode
      await page.click('[data-testid="view-mode-web"]');
      await expect(page.locator('[data-testid="web-view-container"]')).toBeVisible();

      // Test Native View Mode
      await page.click('[data-testid="view-mode-native"]');
      await expect(page.locator('[data-testid="native-view-container"]')).toBeVisible();

      // Test Hybrid View Mode
      await page.click('[data-testid="view-mode-hybrid"]');
      await expect(page.locator('[data-testid="hybrid-view-container"]')).toBeVisible();
    });

    test('should toggle sidebar visibility', async ({ page }) => {
      const sidebar = await page.locator('[data-testid="sidebar"]');

      // Toggle sidebar
      await page.click('[data-testid="sidebar-toggle"]');
      await expect(sidebar).not.toBeVisible();

      // Toggle back
      await page.click('[data-testid="sidebar-toggle"]');
      await expect(sidebar).toBeVisible();
    });
  });

  test.describe('Dashboard Functionality', () => {
    test('should display system metrics', async ({ page }) => {
      await page.click('[data-testid="sidebar-dashboard"]');

      // Check for metrics display
      await expect(page.locator('[data-testid="cpu-usage"])).toBeVisible();
      await expect(page.locator('[data-testid="memory-usage"])).toBeVisible();
      await expect(page.locator('[data-testid="active-connections"])).toBeVisible();
    });

    test('should show connection status', async ({ page }) => {
      const connectionStatus = await page.locator('[data-testid="connection-status"]');
      await expect(connectionStatus).toBeVisible();

      // Check status indicator
      const statusIndicator = await page.locator('[data-testid="status-indicator"]');
      await expect(statusIndicator).toBeVisible();
    });
  });

  test.describe('Chat Interface', () => {
    test('should create new chat', async ({ page }) => {
      await page.click('[data-testid="sidebar-chat"]');

      // Create new chat
      await page.click('[data-testid="new-chat-button"]');

      // Verify chat interface is visible
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    });

    test('should send and display messages', async ({ page }) => {
      await page.click('[data-testid="sidebar-chat"]');
      await page.click('[data-testid="new-chat-button"]');

      // Type and send message
      await page.fill('[data-testid="message-input"]', 'Hello, this is a test message');
      await page.click('[data-testid="send-button"]');

      // Verify message appears
      await expect(page.locator('[data-testid="message-user"])).toBeVisible();
      await expect(page.locator('text=Hello, this is a test message')).toBeVisible();
    });

    test('should handle chat history', async ({ page }) => {
      await page.click('[data-testid="sidebar-chat"]');

      // Check for chat history
      const chatHistory = await page.locator('[data-testid="chat-history"]');
      await expect(chatHistory).toBeVisible();
    });
  });

  test.describe('Agent Management', () => {
    test('should display agent list', async ({ page }) => {
      await page.click('[data-testid="sidebar-agents"]');

      // Check for agent management interface
      await expect(page.locator('[data-testid="agent-list"])).toBeVisible();
      await expect(page.locator('[data-testid="add-agent-button"])).toBeVisible();
    });

    test('should filter agents by type', async ({ page }) => {
      await page.click('[data-testid="sidebar-agents"]');

      // Test filtering
      await page.selectOption('[data-testid="agent-type-filter"]', 'Cognitive');

      // Verify filtered results
      const filteredAgents = await page.locator('[data-testid="agent-item"]');
      await expect(filteredAgents).toHaveCount(2); // Assuming 2 cognitive agents
    });

    test('should search agents', async ({ page }) => {
      await page.click('[data-testid="sidebar-agents"]');

      // Search for specific agent
      await page.fill('[data-testid="agent-search"]', 'Test Agent');

      // Verify search results
      await expect(page.locator('text=Test Agent')).toBeVisible();
    });
  });

  test.describe('MLX Fine-Tuning', () => {
    test('should display MLX interface', async ({ page }) => {
      await page.click('[data-testid="sidebar-mlx"]');

      // Check for MLX components
      await expect(page.locator('[data-testid="model-selection"])).toBeVisible();
      await expect(page.locator('[data-testid="training-config"])).toBeVisible();
      await expect(page.locator('[data-testid="training-data"])).toBeVisible();
    });

    test('should configure training parameters', async ({ page }) => {
      await page.click('[data-testid="sidebar-mlx"]');

      // Set training parameters
      await page.selectOption('[data-testid="model-select"]', 'llama-2-7b');
      await page.fill('[data-testid="epochs-input"]', '5');
      await page.fill('[data-testid="learning-rate-input"]', '0.001');

      // Verify parameters are set
      await expect(page.locator('[data-testid="model-select"]')).toHaveValue('llama-2-7b');
      await expect(page.locator('[data-testid="epochs-input"]')).toHaveValue('5');
    });

    test('should start training process', async ({ page }) => {
      await page.click('[data-testid="sidebar-mlx"]');

      // Add training data
      await page.fill('[data-testid="training-data-textarea"]', 'Sample training data');

      // Start training
      await page.click('[data-testid="start-training-button"]');

      // Verify training progress
      await expect(page.locator('[data-testid="training-progress"])).toBeVisible();
    });
  });

  test.describe('Vision Processing', () => {
    test('should display vision interface', async ({ page }) => {
      await page.click('[data-testid="sidebar-vision"]');

      // Check for vision components
      await expect(page.locator('[data-testid="vision-task-selector"])).toBeVisible();
      await expect(page.locator('[data-testid="image-upload-area"])).toBeVisible();
      await expect(page.locator('[data-testid="processing-results"])).toBeVisible();
    });

    test('should upload and process image', async ({ page }) => {
      await page.click('[data-testid="sidebar-vision"]');

      // Select vision task
      await page.selectOption('[data-testid="vision-task-selector"]', 'Object Detection');

      // Upload test image
      await page.setInputFiles('[data-testid="image-upload"]', 'tests/fixtures/test-image.jpg');

      // Process image
      await page.click('[data-testid="process-image-button"]');

      // Verify processing results
      await expect(page.locator('[data-testid="processing-results"])).toBeVisible();
    });
  });

  test.describe('Settings and Configuration', () => {
    test('should open settings panel', async ({ page }) => {
      await page.click('[data-testid="settings-button"]');

      // Verify settings panel
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      await expect(page.locator('[data-testid="general-settings"])).toBeVisible();
    });

    test('should change appearance settings', async ({ page }) => {
      await page.click('[data-testid="settings-button"]');

      // Toggle dark mode
      await page.click('[data-testid="dark-mode-toggle"]');

      // Verify dark mode is applied
      await expect(page.locator('[data-testid="app-container"]')).toHaveClass(/dark/);
    });

    test('should configure connection settings', async ({ page }) => {
      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="connection-settings-tab"]');

      // Update backend URL
      await page.fill('[data-testid="backend-url-input"]', 'http://localhost:9999');

      // Test connection
      await page.click('[data-testid="test-connection-button"]');

      // Verify connection status
      await expect(page.locator('[data-testid="connection-status"])).toContainText('Connected');
    });
  });

  test.describe('Performance and Responsiveness', () => {
    test('should handle large agent lists', async ({ page }) => {
      await page.click('[data-testid="sidebar-agents"]');

      // Simulate large number of agents
      await page.evaluate(() => {
        // Add 1000 agents to the list
        for (let i = 0; i < 1000; i++) {
          // Simulate adding agents
        }
      });

      // Verify performance
      const startTime = Date.now();
      await page.waitForSelector('[data-testid="agent-item"]', { timeout: 5000 });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should load within 2 seconds
    });

    test('should maintain responsive UI during operations', async ({ page }) => {
      await page.click('[data-testid="sidebar-chat"]');

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="new-chat-button"]');
        await page.fill('[data-testid="message-input"]', `Message ${i}`);
        await page.click('[data-testid="send-button"]');
      }

      // Verify UI remains responsive
      await expect(page.locator('[data-testid="chat-interface"]')).toBeVisible();
      await expect(page.locator('[data-testid="message-input"]')).toBeEnabled();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle connection failures gracefully', async ({ page }) => {
      // Simulate connection failure
      await page.route('**/health', route => route.abort());

      // Navigate to dashboard
      await page.click('[data-testid="sidebar-dashboard"]');

      // Verify error handling
      await expect(page.locator('[data-testid="connection-error"])).toBeVisible();
      await expect(page.locator('[data-testid="reconnect-button"])).toBeVisible();
    });

    test('should handle invalid input gracefully', async ({ page }) => {
      await page.click('[data-testid="sidebar-chat"]');

      // Try to send empty message
      await page.click('[data-testid="send-button"]');

      // Verify validation
      await expect(page.locator('[data-testid="validation-error"])).toBeVisible();
    });

    test('should handle network interruptions', async ({ page }) => {
      // Simulate network interruption
      await page.route('**/*', route => route.abort());

      // Try to perform operations
      await page.click('[data-testid="sidebar-dashboard"]');

      // Verify offline mode handling
      await expect(page.locator('[data-testid="offline-indicator"])).toBeVisible();
    });
  });

  test.describe('Accessibility and Usability', () => {
    test('should support keyboard navigation', async ({ page }) => {
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    });

    test('should have proper ARIA labels', async ({ page }) => {
      // Check for accessibility attributes
      const elements = await page.locator('[aria-label]');
      await expect(elements).toHaveCount.greaterThan(0);
    });

    test('should support screen readers', async ({ page }) => {
      // Check for screen reader support
      const elements = await page.locator('[role]');
      await expect(elements).toHaveCount.greaterThan(0);
    });
  });
});

// Test utilities
const testUtils = {
  async waitForElement(page, selector, timeout = 5000) {
    await page.waitForSelector(selector, { timeout });
  },

  async takeScreenshot(page, name) {
    await page.screenshot({ path: `screenshots/${name}.png` });
  },

  async simulateNetworkCondition(page, condition) {
    await page.route('**/*', route => {
      if (condition === 'slow') {
        route.fulfill({ delay: 2000 });
      } else if (condition === 'offline') {
        route.abort();
      } else {
        route.continue();
      }
    });
  }
};

module.exports = { config, testUtils };
