/**
 * Accessibility E2E Tests
 * Comprehensive accessibility testing with axe-core and Playwright
 */

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from '@axe-core/playwright';

test.describe('Accessibility Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Inject axe-core for accessibility testing
    await injectAxe(page);
  });

  test('should not have any accessibility violations on homepage', async ({ page }) => {
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Check for accessibility violations
    await checkA11y(page, undefined, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });

  test('should have proper heading structure', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for proper heading hierarchy
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
    
    // Ensure main heading is visible and accessible
    const mainHeading = page.locator('h1').first();
    await expect(mainHeading).toBeVisible();
    await expect(mainHeading).toHaveAccessibleName();
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check navigation accessibility
    const navigation = page.locator('nav');
    await expect(navigation).toBeVisible();
    
    // All navigation links should be keyboard accessible
    const navLinks = navigation.locator('a, button');
    const linkCount = await navLinks.count();
    
    for (let i = 0; i < linkCount; i++) {
      const link = navLinks.nth(i);
      await expect(link).toHaveAccessibleName();
      
      // Test keyboard navigation
      await link.focus();
      await expect(link).toBeFocused();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Test Tab navigation through interactive elements
    const interactiveElements = page.locator('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const elementCount = await interactiveElements.count();
    
    expect(elementCount).toBeGreaterThan(0);
    
    // Tab through first few elements
    for (let i = 0; i < Math.min(elementCount, 5); i++) {
      await page.keyboard.press('Tab');
      
      // Check that focus is visible
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
    
    // Test Shift+Tab (reverse navigation)
    await page.keyboard.press('Shift+Tab');
    const focusedAfterReverse = page.locator(':focus');
    await expect(focusedAfterReverse).toBeVisible();
  });

  test('should have accessible forms if present', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for form elements
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    if (formCount > 0) {
      for (let i = 0; i < formCount; i++) {
        const form = forms.nth(i);
        
        // Check form inputs have labels or accessible names
        const inputs = form.locator('input, textarea, select');
        const inputCount = await inputs.count();
        
        for (let j = 0; j < inputCount; j++) {
          const input = inputs.nth(j);
          await expect(input).toHaveAccessibleName();
        }
      }
    }
  });

  test('should have accessible buttons', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Find all buttons
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      
      // Each button should have an accessible name
      await expect(button).toHaveAccessibleName();
      
      // Button should be keyboard accessible
      await button.focus();
      await expect(button).toBeFocused();
      
      // Test Enter and Space key activation
      await button.focus();
      const buttonText = await button.textContent();
      if (buttonText && !buttonText.includes('Navigate')) {
        // Test keyboard activation (but avoid navigation buttons in tests)
        await button.press('Enter');
        // Button should remain accessible after interaction
        await expect(button).toHaveAccessibleName();
      }
    }
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check accessibility violations including color contrast
    await checkA11y(page, undefined, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: true },
      },
    });
  });

  test('should work with screen reader simulation', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Test ARIA labels and descriptions
    const elementsWithAria = page.locator('[aria-label], [aria-labelledby], [aria-describedby]');
    const ariaElementCount = await elementsWithAria.count();
    
    for (let i = 0; i < Math.min(ariaElementCount, 10); i++) {
      const element = elementsWithAria.nth(i);
      
      // Verify ARIA attributes are meaningful
      const ariaLabel = await element.getAttribute('aria-label');
      if (ariaLabel) {
        expect(ariaLabel.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle focus management correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Test focus trap in modals if present
    const modals = page.locator('[role="dialog"], .modal, [aria-modal="true"]');
    const modalCount = await modals.count();
    
    if (modalCount > 0) {
      // Open first modal if there's a trigger
      const modalTriggers = page.locator('button:has-text("Open"), button:has-text("Show")');
      const triggerCount = await modalTriggers.count();
      
      if (triggerCount > 0) {
        await modalTriggers.first().click();
        
        // Focus should be trapped within modal
        await page.keyboard.press('Tab');
        const focusedInModal = page.locator('[role="dialog"] :focus, .modal :focus');
        await expect(focusedInModal).toBeVisible();
      }
    }
  });

  test('should be accessible with reduced motion', async ({ page, context }) => {
    // Set reduced motion preference
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check accessibility with reduced motion
    await checkA11y(page);
  });

  test('should work with high contrast mode', async ({ page, context }) => {
    // Simulate high contrast mode
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Verify accessibility in high contrast mode
    await checkA11y(page, undefined, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
  });

  test('should have semantic HTML structure', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for semantic landmarks
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    const header = page.locator('header');
    if (await header.count() > 0) {
      await expect(header.first()).toBeVisible();
    }
    
    const nav = page.locator('nav');
    if (await nav.count() > 0) {
      await expect(nav.first()).toBeVisible();
    }
    
    // Ensure proper use of headings
    await checkA11y(page, undefined, {
      rules: {
        'heading-order': { enabled: true },
        'empty-heading': { enabled: true },
      },
    });
  });
});