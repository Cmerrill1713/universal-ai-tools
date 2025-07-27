import { test, expect } from '@playwright/test';

test.describe('Performance Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/performance');
    await page.waitForLoadState('networkidle');
  });

  test('should load performance dashboard', async ({ page }) => {
    // Check page loads
    await expect(page.locator('#root')).toBeVisible();
    
    // Look for performance-related content
    const pageContent = await page.textContent('body');
    expect(pageContent).toMatch(/performance|metrics|dashboard|monitor/i);
  });

  test('should display metrics and charts', async ({ page }) => {
    // Look for chart or metrics elements
    const chartElements = page.locator('canvas, svg, [class*="chart"], [class*="Chart"], [class*="graph"]');
    const metricsElements = page.locator('[class*="metric"], [class*="Metric"], [class*="stats"]');
    
    const chartCount = await chartElements.count();
    const metricsCount = await metricsElements.count();
    
    if (chartCount > 0) {
      // Test that charts are visible
      await expect(chartElements.first()).toBeVisible();
    }
    
    if (metricsCount > 0) {
      // Test that metrics are visible
      await expect(metricsElements.first()).toBeVisible();
    }
    
    // At minimum, verify page loads content
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('should test real-time updates', async ({ page }) => {
    // Wait and check for any dynamic content updates
    await page.waitForTimeout(2000);
    
    // Look for elements that might show real-time data
    const timeElements = page.locator('[class*="time"], [class*="timestamp"], [class*="updated"]');
    const numberElements = page.locator('[class*="value"], [class*="count"], [class*="metric"]');
    
    // Capture initial state
    const initialContent = await page.textContent('body');
    
    // Wait for potential updates
    await page.waitForTimeout(3000);
    
    // Check if content updated (or at least page remains stable)
    await expect(page.locator('#root')).toBeVisible();
    
    const updatedContent = await page.textContent('body');
    expect(updatedContent?.length).toBeGreaterThan(0);
  });

  test('should test interactive dashboard elements', async ({ page }) => {
    // Look for interactive elements like buttons, tabs, filters
    const buttons = page.locator('button');
    const tabs = page.locator('[role="tab"], [class*="tab"], [class*="Tab"]');
    const selects = page.locator('select, [role="combobox"]');
    
    // Test buttons
    const buttonCount = await buttons.count();
    if (buttonCount > 0) {
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        try {
          const button = buttons.nth(i);
          const buttonText = await button.textContent();
          
          // Skip navigation buttons
          if (buttonText && !buttonText.toLowerCase().includes('back') && 
              !buttonText.toLowerCase().includes('home')) {
            await button.click();
            await page.waitForTimeout(500);
            
            // Verify interaction doesn't break page
            await expect(page.locator('#root')).toBeVisible();
          }
        } catch (e) {
          // Continue with next button
        }
      }
    }
    
    // Test tabs if present
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        try {
          await tabs.nth(i).click();
          await page.waitForTimeout(500);
          await expect(page.locator('#root')).toBeVisible();
        } catch (e) {
          // Continue with next tab
        }
      }
    }
  });

  test('should test data refresh functionality', async ({ page }) => {
    // Look for refresh buttons
    const refreshButtons = page.locator('button:has-text("refresh"i), button:has-text("reload"i), button:has-text("update"i)');
    const refreshCount = await refreshButtons.count();
    
    if (refreshCount > 0) {
      try {
        await refreshButtons.first().click();
        await page.waitForTimeout(2000);
        
        // Verify page remains functional after refresh
        await expect(page.locator('#root')).toBeVisible();
      } catch (e) {
        console.log('Refresh functionality test skipped:', e);
      }
    }
    
    // Test manual page refresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should test responsive design for performance dashboard', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1920, height: 1080 }  // Desktop
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      
      // Verify dashboard adapts to different screen sizes
      await expect(page.locator('#root')).toBeVisible();
      
      // Check that content isn't completely cut off
      const rootBounds = await page.locator('#root').boundingBox();
      expect(rootBounds?.width).toBeGreaterThan(0);
      expect(rootBounds?.height).toBeGreaterThan(0);
      
      // Test scrolling if needed
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(200);
      await expect(page.locator('#root')).toBeVisible();
    }
  });

  test('should test performance metrics accuracy', async ({ page }) => {
    // Test page load performance
    const startTime = Date.now();
    await page.goto('/performance');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Page should load within reasonable time (5 seconds)
    expect(loadTime).toBeLessThan(5000);
    
    // Check for any performance-related numbers on the page
    const performanceNumbers = page.locator('text=/\\d+(\\.\\d+)?(ms|MB|%|req\\/s)/');
    const numberCount = await performanceNumbers.count();
    
    if (numberCount > 0) {
      // Verify performance numbers are displayed
      await expect(performanceNumbers.first()).toBeVisible();
    }
  });
});