const { test, expect } = require('@playwright/test');

test.describe('Frontend Rendering Test', () => {
  test('should render Sweet Athena dashboard with interactive components', async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5174/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'dashboard.png', fullPage: true });
    
    // Check if the main title is visible
    await expect(page.locator('text=Sweet Athena')).toBeVisible();
    
    // Check for personality buttons
    const personalityButtons = page.locator('button[role="button"]');
    const buttonCount = await personalityButtons.count();
    console.log(`Found ${buttonCount} buttons on the page`);
    
    // Expect at least 5 personality buttons plus other UI buttons
    expect(buttonCount).toBeGreaterThan(5);
    
    // Check for specific personality options
    await expect(page.locator('text=Sweet')).toBeVisible();
    await expect(page.locator('text=Shy')).toBeVisible();
    await expect(page.locator('text=Confident')).toBeVisible();
    await expect(page.locator('text=Caring')).toBeVisible();
    await expect(page.locator('text=Playful')).toBeVisible();
    
    // Check for widget creator textarea
    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();
    
    // Test personality switching
    await page.locator('text=Confident').click();
    await expect(page.locator('text=Current Mood: ⭐ Confident')).toBeVisible();
    
    // Test widget input
    await textarea.fill('Create a simple calculator widget');
    await expect(textarea).toHaveValue('Create a simple calculator widget');
    
    // Test create widget button
    const createButton = page.locator('button:has-text("Create Widget")');
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    
    // Test quick action buttons
    await expect(page.locator('button:has-text("Memory")')).toBeVisible();
    await expect(page.locator('button:has-text("Agents")')).toBeVisible();
    await expect(page.locator('button:has-text("Themes")')).toBeVisible();
    
    // Check system status indicators
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=Frontend')).toBeVisible();
    await expect(page.locator('text=Backend API')).toBeVisible();
    
    console.log('✅ All rendering tests passed!');
  });
  
  test('should navigate to different pages', async ({ page }) => {
    await page.goto('http://localhost:5174/');
    await page.waitForLoadState('networkidle');
    
    // Test navigation to Sweet Athena Demo
    await page.locator('a:has-text("Sweet Athena Demo")').click();
    await page.waitForLoadState('networkidle');
    
    // Test navigation to Widget Creator
    await page.locator('a:has-text("Widget Creator")').click();
    await page.waitForLoadState('networkidle');
    
    // Test navigation back to main dashboard
    await page.locator('a:has-text("Sweet Athena")').first().click();
    await page.waitForLoadState('networkidle');
    
    await expect(page.locator('text=Sweet Athena')).toBeVisible();
    
    console.log('✅ Navigation tests passed!');
  });
});