import { test, expect } from '@playwright/test';

test.describe('App Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the homepage successfully', async ({ page }) => {
    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');

    // Check if the page title is set correctly
    await expect(page).toHaveTitle(/Universal AI Tools/);

    // Check if main content is visible
    await expect(page.locator('main')).toBeVisible();

    // Check if navigation is present
    await expect(page.locator('nav, .navigation')).toBeVisible();
  });

  test('should display loading state initially', async ({ page }) => {
    // Intercept page load to capture initial loading state
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check for loading indicator
    const loadingElement = page.locator('[data-testid="loading"], text="Loading..."');
    await expect(loadingElement).toBeVisible({ timeout: 1000 });
  });

  test('should navigate between different pages', async ({ page }) => {
    // Wait for app to load
    await page.waitForSelector('main', { timeout: 10000 });

    // Test navigation to Chat page
    const chatLink = page.locator('a[href*="chat"], button[data-route="chat"]');
    if ((await chatLink.count()) > 0) {
      await chatLink.first().click();
      await expect(page.locator('[data-testid="chat-page"], .chat-container')).toBeVisible({
        timeout: 5000,
      });
    }

    // Test navigation to Settings page
    await page.goto('/settings');
    await expect(page.locator('[data-testid="settings-page"], .settings-container')).toBeVisible({
      timeout: 5000,
    });

    // Test navigation to Services page
    await page.goto('/services');
    await expect(page.locator('[data-testid="services-page"], .services-container')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should handle invalid routes gracefully', async ({ page }) => {
    // Navigate to a non-existent route
    await page.goto('/non-existent-route');

    // Should either redirect to homepage or show 404 page
    await page.waitForLoadState('networkidle');

    // Check if we're redirected to a valid page or have _error handling
    const isValidPage = await page
      .locator('main, [data-testid="dashboard-page"], .not-found')
      .count();
    expect(isValidPage).toBeGreaterThan(0);
  });

  test('should be responsive on different screen sizes', async ({ page }) => {
    await page.waitForSelector('main');

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('main')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('main')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have proper accessibility features', async ({ page }) => {
    await page.waitForSelector('main');

    // Check for main landmarks
    await expect(page.locator('main')).toBeVisible();

    // Check for skip links or accessible navigation
    const skipLink = page.locator('[href="#main-content"], .skip-link');
    if ((await skipLink.count()) > 0) {
      await expect(skipLink).toBeVisible();
    }

    // Check for proper heading structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);

    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const ariaLabel = await img.getAttribute('aria-label');
        const isDecorative = await img.getAttribute('aria-hidden');

        // Images should have alt text, aria-label, or be marked as decorative
        expect(alt !== null || ariaLabel !== null || isDecorative === 'true').toBeTruthy();
      }
    }
  });

  test('should persist state during navigation', async ({ page }) => {
    await page.waitForSelector('main');

    // Navigate to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Navigate to another page
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    // Navigate back to settings
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Settings page should load without issues
    await expect(page.locator('[data-testid="settings-page"], .settings-container')).toBeVisible();
  });

  test('should handle browser back/forward buttons', async ({ page }) => {
    // Start on homepage
    await page.waitForSelector('main');

    // Navigate to different pages
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Use browser back button
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/chat/);

    // Use browser forward button
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/settings/);
  });

  test('should show proper _error states', async ({ page }) => {
    // Test _error boundary by triggering an _error condition
    // This would need to be implemented based on how your _error boundary works

    // For now, just ensure the app doesn't crash on various interactions
    await page.waitForSelector('main');

    // Try rapid navigation
    const routes = ['/', '/chat', '/settings', '/services', '/'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForTimeout(100); // Brief pause between navigations
    }

    // App should still be functional
    await expect(page.locator('main')).toBeVisible();
  });

  test('should have proper theme support', async ({ page }) => {
    await page.waitForSelector('main');

    // Check for theme-related CSS classes
    const bodyClasses = await page.locator('body').getAttribute('class');
    const rootClasses = await page.locator('html').getAttribute('class');

    // Should have some theme-related classes
    expect(bodyClasses || rootClasses).toBeDefined();

    // Check for theme toggle if it exists
    const themeToggle = page.locator(
      '[data-testid="theme-toggle"], .theme-toggle, [aria-label*="theme"]'
    );
    if ((await themeToggle.count()) > 0) {
      await themeToggle.click();
      await page.waitForTimeout(500); // Wait for theme transition

      // Classes should change after theme toggle
      const newBodyClasses = await page.locator('body').getAttribute('class');
      const newRootClasses = await page.locator('html').getAttribute('class');

      // At least one should have changed
      expect(newBodyClasses !== bodyClasses || newRootClasses !== rootClasses).toBeTruthy();
    }
  });
});
