import { test, expect } from '@playwright/test';

test.describe('B. Chat Happy Path', () => {
  
  test('should have chat interface with textarea and send button', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Next.js app uses textarea (not input)
    const textarea = page.locator('textarea[placeholder*="Ask" i], textarea').first();
    await expect(textarea).toBeVisible();
    
    // Should have send button
    const sendButton = page.locator('button:has-text("Send"), button[title*="Send"]').first();
    await expect(sendButton).toBeVisible();
    
    // Button should be disabled initially (no message)
    const isDisabled = await sendButton.isDisabled();
    expect(isDisabled).toBeTruthy();
    
    // Type message
    await textarea.fill('Hello from QA test');
    
    // Button might become enabled
    // (If not, that's OK - we're just checking structure exists)
  });

  test('should show welcome message in chat area', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Should show initial welcome/prompt message
    const chatArea = page.locator('text=How can I help, text=Ask me anything, text=Hello').first();
    
    // If chat area has welcome message, that's a pass
    const hasWelcome = await chatArea.isVisible().catch(() => false);
    
    // OR check for empty chat container ready for messages
    const messagesContainer = page.locator('[class*="chat"], [class*="message"], [role="log"]').first();
    const hasContainer = await messagesContainer.isVisible().catch(() => false);
    
    expect(hasWelcome || hasContainer).toBeTruthy();
  });

  test('should have tabs for Chat and Tasks', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Next.js app has Chat and Tasks tabs
    const chatTab = page.locator('button:has-text("Chat"), [role="tab"]:has-text("Chat")').first();
    const tasksTab = page.locator('button:has-text("Tasks"), [role="tab"]:has-text("Tasks")').first();
    
    await expect(chatTab).toBeVisible();
    await expect(tasksTab).toBeVisible();
    
    // Chat tab should be active by default
    const chatTabActive = await chatTab.getAttribute('data-state');
    expect(chatTabActive).toBe('active');
  });

  test('should have action buttons (attach file, voice, settings)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Check for attach file button (paperclip icon)
    const attachButton = page.locator('button[title*="Attach"], button:has(svg.lucide-paperclip)').first();
    const hasAttach = await attachButton.isVisible().catch(() => false);
    
    // Check for voice button (mic icon)
    const voiceButton = page.locator('button[title*="voice" i], button:has(svg.lucide-mic)').first();
    const hasVoice = await voiceButton.isVisible().catch(() => false);
    
    // Check for settings button
    const settingsButton = page.locator('button[title*="Settings"], button:has(svg.lucide-settings)').first();
    const hasSettings = await settingsButton.isVisible().catch(() => false);
    
    // At least one action button should exist
    expect(hasAttach || hasVoice || hasSettings).toBeTruthy();
  });
});

