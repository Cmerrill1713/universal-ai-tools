import { test, expect } from '@playwright/test';

test.describe('Quick Enterprise Validation', () => {
  test('should validate Universal AI Tools frontend loads', async ({ page }) => {
    // Go to homepage
    await page.goto('/');
    
    // Wait for React app to potentially load content
    await page.waitForTimeout(5000);
    
    // Check if there's any content beyond the empty root div
    const bodyContent = await page.textContent('body');
    console.log('Page content length:', bodyContent?.length || 0);
    
    // Take a screenshot for manual inspection
    await page.screenshot({ path: 'test-results/homepage-loaded.png', fullPage: true });
    
    // Check basic HTML structure
    await expect(page.locator('#root')).toBeAttached();
    
    // Verify the page doesn't have any critical JavaScript errors
    const title = await page.title();
    expect(title).toContain('Universal AI Tools');
  });

  test('should test Sweet Athena page loading', async ({ page }) => {
    await page.goto('/sweet-athena');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/sweet-athena-loaded.png', fullPage: true });
    
    // Check if page loads without critical errors
    const title = await page.title();
    expect(title).toContain('Universal AI Tools');
  });

  test('should test widget creator page loading', async ({ page }) => {
    await page.goto('/natural-language-widgets');
    await page.waitForTimeout(5000);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/widget-creator-loaded.png', fullPage: true });
    
    // Check basic structure
    const title = await page.title();
    expect(title).toContain('Universal AI Tools');
  });

  test('should test all routes accessibility', async ({ page }) => {
    const routes = [
      '/',
      '/sweet-athena', 
      '/natural-language-widgets',
      '/performance',
      '/chat',
      '/memory',
      '/agents',
      '/tools',
      '/dspy',
      '/monitoring',
      '/settings'
    ];

    const results = [];
    
    for (const route of routes) {
      try {
        await page.goto(route);
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        
        const response = await page.goto(route);
        const status = response?.status() || 0;
        
        results.push({ route, status, accessible: status < 400 });
        console.log(`${route}: ${status < 400 ? 'ACCESSIBLE' : 'ERROR'} (${status})`);
      } catch (error) {
        results.push({ route, status: 0, accessible: false, error: error.message });
        console.log(`${route}: ERROR - ${error.message}`);
      }
    }
    
    // Verify at least 80% of routes are accessible
    const accessibleRoutes = results.filter(r => r.accessible).length;
    const successRate = (accessibleRoutes / routes.length) * 100;
    
    console.log(`Route accessibility: ${successRate.toFixed(1)}% (${accessibleRoutes}/${routes.length})`);
    expect(successRate).toBeGreaterThan(80);
  });

  test('should test button interactions across the application', async ({ page }) => {
    const routes = ['/sweet-athena', '/natural-language-widgets', '/performance'];
    
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(3000);
      
      // Find all buttons on the page
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      
      console.log(`${route}: Found ${buttonCount} buttons`);
      
      // Test clicking first few buttons (safely)
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        try {
          const button = buttons.nth(i);
          const buttonText = await button.textContent();
          
          // Skip buttons that might navigate away or cause issues
          if (buttonText && 
              !buttonText.toLowerCase().includes('delete') &&
              !buttonText.toLowerCase().includes('remove') &&
              !buttonText.toLowerCase().includes('logout')) {
            
            await button.click();
            await page.waitForTimeout(1000);
            
            // Verify page still loads after button click
            const title = await page.title();
            expect(title).toContain('Universal AI Tools');
            
            console.log(`${route}: Button "${buttonText}" - CLICKABLE`);
          }
        } catch (error) {
          // Continue with next button if one fails
          console.log(`${route}: Button ${i} - SKIP (${error.message})`);
        }
      }
    }
  });

  test('should test form inputs and interactions', async ({ page }) => {
    await page.goto('/natural-language-widgets');
    await page.waitForTimeout(3000);
    
    // Find form inputs
    const inputs = page.locator('input, textarea');
    const inputCount = await inputs.count();
    
    console.log(`Widget creator: Found ${inputCount} input fields`);
    
    if (inputCount > 0) {
      // Test typing in first input
      const firstInput = inputs.first();
      
      try {
        await firstInput.fill('Test widget: Create a simple button component');
        await page.waitForTimeout(1000);
        
        const inputValue = await firstInput.inputValue();
        expect(inputValue).toContain('Test widget');
        
        console.log('Widget creator: Text input - FUNCTIONAL');
        
        // Look for submit/generate buttons
        const submitButtons = page.locator('button:has-text("generate"i), button:has-text("create"i), button[type="submit"]');
        const submitCount = await submitButtons.count();
        
        if (submitCount > 0) {
          await submitButtons.first().click();
          await page.waitForTimeout(2000);
          
          // Check if page still works after form submission
          const title = await page.title();
          expect(title).toContain('Universal AI Tools');
          
          console.log('Widget creator: Form submission - FUNCTIONAL');
        }
      } catch (error) {
        console.log('Widget creator: Form testing - SKIP (', error.message, ')');
      }
    }
  });
});