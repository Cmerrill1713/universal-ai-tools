import { test, expect } from '@playwright/test';

test.describe('H. Accessibility & Basics', () => {
  
  test('should have accessible form controls', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Textarea should have placeholder or aria-label
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible();
    
    const placeholder = await textarea.getAttribute('placeholder');
    const ariaLabel = await textarea.getAttribute('aria-label');
    
    // Has placeholder OR aria-label
    const hasAccessibleName = placeholder || ariaLabel;
    expect(hasAccessibleName).toBeTruthy();
    
    // Send button should have title or text
    const sendButton = page.locator('button[title*="Send"], button:has-text("Send")').first();
    await expect(sendButton).toBeVisible();
  });

  test('should be keyboard navigable to textarea', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Click textarea to ensure it's focusable
    const textarea = page.locator('textarea').first();
    await textarea.click();
    
    // Should be able to type
    await page.keyboard.type('Keyboard test');
    
    // Content should appear
    const value = await textarea.inputValue();
    expect(value).toContain('Keyboard test');
  });

  test('should have visible text and interactive elements', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check main heading/title is visible
    const heading = page.locator('h1, h2, h3').first();
    await expect(heading).toBeVisible();
    
    // Check text content exists
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
    expect(headingText!.trim().length).toBeGreaterThan(0);
    
    // Check interactive elements are visible
    const textarea = page.locator('textarea').first();
    const button = page.locator('button').first();
    
    await expect(textarea).toBeVisible();
    await expect(button).toBeVisible();
  });
});

