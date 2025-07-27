import { test, expect } from '@playwright/test';

test.describe('Universal AI Tools - Navigation', () => {
  const routes = [
    { path: '/', name: 'Homepage' },
    { path: '/sweet-athena', name: 'Sweet Athena Demo' },
    { path: '/natural-language-widgets', name: 'Widget Creator' },
    { path: '/performance', name: 'Performance Dashboard' },
    { path: '/chat', name: 'AI Chat' },
    { path: '/memory', name: 'Memory System' },
    { path: '/agents', name: 'Agent Management' },
    { path: '/tools', name: 'Tools Panel' },
    { path: '/dspy', name: 'DSPy Orchestration' },
    { path: '/monitoring', name: 'System Monitoring' },
    { path: '/settings', name: 'Settings' }
  ];

  routes.forEach(({ path, name }) => {
    test(`should navigate to ${name} (${path})`, async ({ page }) => {
      await page.goto(path);
      
      // Check that page loads successfully
      await expect(page.locator('#root')).toBeVisible();
      
      // Verify no network errors (4xx, 5xx)
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      
      // Check for React app content
      await page.waitForLoadState('networkidle');
      const content = await page.locator('body').textContent();
      expect(content?.length).toBeGreaterThan(0);
    });
  });

  test('should handle navigation between routes', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    
    // Navigate to Sweet Athena
    await page.goto('/sweet-athena');
    await expect(page.locator('#root')).toBeVisible();
    
    // Navigate to Widget Creator
    await page.goto('/natural-language-widgets');
    await expect(page.locator('#root')).toBeVisible();
    
    // Navigate back to homepage
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    
    // Navigate to another page
    await page.goto('/sweet-athena');
    await expect(page.locator('#root')).toBeVisible();
    
    // Use browser back
    await page.goBack();
    expect(page.url()).toContain('/');
    
    // Use browser forward
    await page.goForward();
    expect(page.url()).toContain('/sweet-athena');
  });
});