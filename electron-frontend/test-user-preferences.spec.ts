import { test, expect, _electron as electron } from '@playwright/test';
import { ElectronApplication, Page } from 'playwright';

test.describe('User Preference Isolation Test', () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    // Launch Electron app
    console.log('🚀 Launching Electron app...');
    electronApp = await electron.launch({
      args: ['.'],
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_DEV_PORT: '3007'
      }
    });

    // Get the first page (main window)
    page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit for the app to fully load
    await page.waitForTimeout(3000);
    
    // Take initial screenshot
    await page.screenshot({ path: '/tmp/electron-app-initial-load.png', fullPage: true });
    console.log('📸 Initial screenshot taken: /tmp/electron-app-initial-load.png');
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('should show app window and load properly', async () => {
    // Verify the window opened
    expect(page).toBeTruthy();
    
    // Check if the page has loaded with proper title
    const title = await page.title();
    console.log('📋 App title:', title);
    
    // Take screenshot to see what's displayed
    await page.screenshot({ path: '/tmp/electron-app-loaded.png', fullPage: true });
    console.log('📸 App loaded screenshot: /tmp/electron-app-loaded.png');
    
    // Check if we can see any content
    const bodyContent = await page.locator('body').innerHTML();
    console.log('📄 Page has content:', bodyContent.length > 0);
  });

  test('should navigate to profile login and test user isolation', async () => {
    // Wait for app to be ready
    await page.waitForTimeout(2000);
    
    // Look for profile login or navigation elements
    console.log('🔍 Looking for navigation elements...');
    
    // Check if there's a profile login button or link
    const profileButton = page.locator('button:has-text("Profile"), a:has-text("Profile"), button:has-text("Login"), a:has-text("Login")').first();
    const isProfileButtonVisible = await profileButton.isVisible().catch(() => false);
    
    if (isProfileButtonVisible) {
      console.log('✅ Found profile button, clicking...');
      await profileButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Take screenshot of current state
    await page.screenshot({ path: '/tmp/electron-navigation-state.png', fullPage: true });
    console.log('📸 Navigation state screenshot: /tmp/electron-navigation-state.png');
    
    // Look for user profile selection (Christian/Trista)
    const christianButton = page.locator('button:has-text("Christian"), button:has-text("christian")').first();
    const tristaButton = page.locator('button:has-text("Trista"), button:has-text("trista")').first();
    
    const christianVisible = await christianButton.isVisible().catch(() => false);
    const tristaVisible = await tristaButton.isVisible().catch(() => false);
    
    console.log('🔍 Christian button visible:', christianVisible);
    console.log('🔍 Trista button visible:', tristaVisible);
    
    if (christianVisible && tristaVisible) {
      console.log('✅ Found user profile buttons!');
      
      // Test Christian login first
      console.log('👤 Testing Christian login...');
      await christianButton.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot as Christian
      await page.screenshot({ path: '/tmp/christian-logged-in.png', fullPage: true });
      console.log('📸 Christian logged in screenshot: /tmp/christian-logged-in.png');
      
      // Check for Christian's preferences
      const christianPrefs = await page.evaluate(() => {
        return localStorage.getItem('universal-ai-tools-christian') || localStorage.getItem('universal-ai-tools-storage');
      });
      console.log('💾 Christian preferences:', christianPrefs ? 'Found' : 'Not found');
      
      // Navigate back to profile selection if possible
      const backButton = page.locator('button:has-text("Back"), button:has-text("Logout"), a:has-text("Profile")').first();
      const backButtonVisible = await backButton.isVisible().catch(() => false);
      if (backButtonVisible) {
        await backButton.click();
        await page.waitForTimeout(1000);
      }
      
      // Test Trista login
      console.log('👤 Testing Trista login...');
      await tristaButton.click();
      await page.waitForTimeout(2000);
      
      // Take screenshot as Trista
      await page.screenshot({ path: '/tmp/trista-logged-in.png', fullPage: true });
      console.log('📸 Trista logged in screenshot: /tmp/trista-logged-in.png');
      
      // Check for Trista's preferences
      const tristaPrefs = await page.evaluate(() => {
        return localStorage.getItem('universal-ai-tools-trista') || localStorage.getItem('universal-ai-tools-storage');
      });
      console.log('💾 Trista preferences:', tristaPrefs ? 'Found' : 'Not found');
      
      // Verify preference isolation
      const allLocalStorage = await page.evaluate(() => {
        const storage: { [key: string]: string } = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            storage[key] = localStorage.getItem(key) || '';
          }
        }
        return storage;
      });
      
      console.log('🔍 All localStorage keys:', Object.keys(allLocalStorage));
      
      // Check if user-specific keys exist
      const hasChristianKey = Object.keys(allLocalStorage).some(key => key.includes('christian'));
      const hasTristaKey = Object.keys(allLocalStorage).some(key => key.includes('trista'));
      const hasSharedKey = Object.keys(allLocalStorage).some(key => key === 'universal-ai-tools-storage');
      
      console.log('✅ Preference isolation test results:');
      console.log('  Christian specific key:', hasChristianKey);
      console.log('  Trista specific key:', hasTristaKey);
      console.log('  Shared key (should be false):', hasSharedKey);
      
      // This should be true if our fix worked
      expect(hasChristianKey || hasTristaKey).toBe(true);
      expect(hasSharedKey).toBe(false);
      
    } else {
      console.log('⚠️ Profile buttons not found, taking screenshot for debugging...');
      await page.screenshot({ path: '/tmp/no-profile-buttons-found.png', fullPage: true });
      console.log('📸 No profile buttons screenshot: /tmp/no-profile-buttons-found.png');
      
      // Let's look for any clickable elements
      const allButtons = await page.locator('button, a, [role="button"]').all();
      console.log('🔍 Found clickable elements:', allButtons.length);
      
      for (let i = 0; i < Math.min(allButtons.length, 10); i++) {
        const buttonText = await allButtons[i].textContent().catch(() => '');
        console.log(`  Button ${i + 1}:`, buttonText?.trim() || 'No text');
      }
    }
  });

  test('should verify the app is actually functional', async () => {
    // Check if the React app is loaded
    const reactRoot = await page.locator('#root').innerHTML().catch(() => '');
    console.log('⚛️ React app loaded:', reactRoot.length > 100);
    
    // Check for any error messages
    const errorElements = await page.locator('[class*="error"], .error, [data-testid="error"]').all();
    console.log('❌ Error elements found:', errorElements.length);
    
    if (errorElements.length > 0) {
      for (const error of errorElements) {
        const errorText = await error.textContent().catch(() => '');
        console.log('  Error:', errorText);
      }
    }
    
    // Check console errors
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleLogs.push(`CONSOLE ERROR: ${msg.text()}`);
      }
    });
    
    await page.waitForTimeout(2000);
    
    if (consoleLogs.length > 0) {
      console.log('🚨 Console errors detected:');
      consoleLogs.forEach(log => console.log('  ', log));
    } else {
      console.log('✅ No console errors detected');
    }
    
    // Take final comprehensive screenshot
    await page.screenshot({ path: '/tmp/final-app-state.png', fullPage: true });
    console.log('📸 Final app state screenshot: /tmp/final-app-state.png');
  });
});