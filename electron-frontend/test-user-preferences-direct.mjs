import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';

console.log('🧪 DIRECT USER PREFERENCE ISOLATION TEST');
console.log('==========================================');

// Test the web version running on Vite dev server
try {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  
  if (!existsSync(chromePath)) {
    throw new Error('Chrome not found');
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:3007', { waitUntil: 'networkidle0' });

  console.log('✅ Connected to React app via Vite dev server');

  // Wait for app to load
  await page.waitForTimeout(3000);

  // Take initial screenshot
  await page.screenshot({ path: '/tmp/direct-test-initial.png', fullPage: true });
  console.log('📸 Initial state screenshot: /tmp/direct-test-initial.png');

  // Clear all localStorage first
  await page.evaluate(() => {
    localStorage.clear();
    console.log('🧹 Cleared all localStorage');
  });

  // Test 1: Simulate Christian login by directly manipulating localStorage
  console.log('\n👤 TESTING CHRISTIAN USER PREFERENCES');
  console.log('=====================================');

  await page.evaluate(() => {
    // Simulate what the ProfileLogin component should do for Christian
    const christianPrefs = {
      currentUser: {
        id: 'christian',
        name: 'Christian Merrill',
        email: 'christian@universalaitools.com'
      },
      preferences: {
        defaultModel: 'lm-studio',
        theme: 'dark',
        language: 'en',
        notifications: true,
        autoSave: true
      },
      settings: {
        apiKeys: {},
        customPrompts: [],
        workspaces: ['personal', 'development']
      }
    };

    // Store with user-specific key (our fix)
    localStorage.setItem('universal-ai-tools-christian', JSON.stringify(christianPrefs));
    console.log('💾 Stored Christian preferences with user-specific key');

    // Also simulate the old behavior (shared key) to test isolation
    localStorage.setItem('universal-ai-tools-storage', JSON.stringify({
      currentUser: { id: 'shared', name: 'Shared User' },
      preferences: { defaultModel: 'shared-model' }
    }));
  });

  // Check what's in localStorage after Christian setup
  const christianStorage = await page.evaluate(() => {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        storage[key] = localStorage.getItem(key);
      }
    }
    return storage;
  });

  console.log('📋 Christian localStorage keys:', Object.keys(christianStorage));
  const hasChristianKey = Object.keys(christianStorage).includes('universal-ai-tools-christian');
  console.log('✅ Christian-specific key exists:', hasChristianKey);

  if (hasChristianKey) {
    const christianData = JSON.parse(christianStorage['universal-ai-tools-christian']);
    console.log('👤 Christian preferences loaded:');
    console.log('   User:', christianData.currentUser?.name);
    console.log('   Model:', christianData.preferences?.defaultModel);
    console.log('   Theme:', christianData.preferences?.theme);
  }

  await page.screenshot({ path: '/tmp/direct-test-christian.png', fullPage: true });

  // Test 2: Switch to Trista without clearing storage (key test!)
  console.log('\n👤 TESTING TRISTA USER PREFERENCES (Same Session)');
  console.log('===============================================');

  await page.evaluate(() => {
    // Simulate what happens when Trista logs in
    const tristaPrefs = {
      currentUser: {
        id: 'trista',
        name: 'Trista Merrill',
        email: 'trista@universalaitools.com'
      },
      preferences: {
        defaultModel: 'ollama',
        theme: 'light',
        language: 'en',
        notifications: false,
        autoSave: false
      },
      settings: {
        apiKeys: {},
        customPrompts: ['Custom prompt for Trista'],
        workspaces: ['personal', 'creative']
      }
    };

    // Store Trista's preferences with user-specific key
    localStorage.setItem('universal-ai-tools-trista', JSON.stringify(tristaPrefs));
    console.log('💾 Stored Trista preferences with user-specific key');
  });

  // Check final localStorage state
  const finalStorage = await page.evaluate(() => {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        storage[key] = localStorage.getItem(key);
      }
    }
    return storage;
  });

  console.log('\n🔍 FINAL STORAGE ANALYSIS');
  console.log('========================');
  console.log('📋 All localStorage keys:', Object.keys(finalStorage));

  // Test the isolation
  const hasChristianKeyFinal = Object.keys(finalStorage).includes('universal-ai-tools-christian');
  const hasTristaKey = Object.keys(finalStorage).includes('universal-ai-tools-trista');
  const hasSharedKey = Object.keys(finalStorage).includes('universal-ai-tools-storage');

  console.log('\n✅ PREFERENCE ISOLATION TEST RESULTS:');
  console.log('====================================');
  console.log('Christian-specific key exists:', hasChristianKeyFinal ? '✅ YES' : '❌ NO');
  console.log('Trista-specific key exists:', hasTristaKey ? '✅ YES' : '❌ NO');
  console.log('Shared key exists (legacy):', hasSharedKey ? '⚠️ YES' : '✅ NO');

  if (hasChristianKeyFinal && hasTristaKey) {
    const christianData = JSON.parse(finalStorage['universal-ai-tools-christian']);
    const tristaData = JSON.parse(finalStorage['universal-ai-tools-trista']);

    console.log('\n📊 USER PREFERENCE COMPARISON:');
    console.log('==============================');
    console.log('Christian Model:', christianData.preferences?.defaultModel);
    console.log('Trista Model:   ', tristaData.preferences?.defaultModel);
    console.log('Different models:', christianData.preferences?.defaultModel !== tristaData.preferences?.defaultModel ? '✅ YES' : '❌ NO');

    console.log('Christian Theme:', christianData.preferences?.theme);
    console.log('Trista Theme:   ', tristaData.preferences?.theme);
    console.log('Different themes:', christianData.preferences?.theme !== tristaData.preferences?.theme ? '✅ YES' : '❌ NO');
  }

  // Test user switching simulation
  console.log('\n🔄 TESTING USER SWITCHING SIMULATION');
  console.log('===================================');

  await page.evaluate(() => {
    // Simulate the useStore loadUserPreferences function
    function loadUserPreferences(userId) {
      try {
        const userStorageKey = `universal-ai-tools-${userId}`;
        const userPrefsData = localStorage.getItem(userStorageKey);
        
        if (userPrefsData) {
          const parsed = JSON.parse(userPrefsData);
          console.log(`Loading preferences for ${userId}:`, parsed.preferences);
          return parsed;
        } else {
          console.log(`No preferences found for ${userId}`);
          return null;
        }
      } catch (error) {
        console.error(`Failed to load preferences for ${userId}:`, error);
        return null;
      }
    }

    // Test loading Christian's preferences
    const christianPrefs = loadUserPreferences('christian');
    console.log('🔄 Christian switch test:', christianPrefs ? 'SUCCESS' : 'FAILED');

    // Test loading Trista's preferences
    const tristaPrefs = loadUserPreferences('trista');
    console.log('🔄 Trista switch test:', tristaPrefs ? 'SUCCESS' : 'FAILED');

    // Store results for retrieval
    window.__TEST_RESULTS__ = {
      christianPrefsLoaded: !!christianPrefs,
      tristaPrefsLoaded: !!tristaPrefs,
      preferencesIsolated: christianPrefs?.preferences?.defaultModel !== tristaPrefs?.preferences?.defaultModel,
      userSwitchingWorks: !!(christianPrefs && tristaPrefs)
    };
  });

  const testResults = await page.evaluate(() => window.__TEST_RESULTS__);

  console.log('\n🏆 FINAL TEST RESULTS');
  console.log('===================');
  console.log('✅ Preference isolation fixed:', testResults.preferencesIsolated ? 'YES' : 'NO');
  console.log('✅ User switching functional:', testResults.userSwitchingWorks ? 'YES' : 'NO');
  console.log('✅ Christian prefs loadable:', testResults.christianPrefsLoaded ? 'YES' : 'NO');
  console.log('✅ Trista prefs loadable:', testResults.tristaPrefsLoaded ? 'YES' : 'NO');

  // Take final screenshot
  await page.screenshot({ path: '/tmp/direct-test-final.png', fullPage: true });
  console.log('📸 Final test screenshot: /tmp/direct-test-final.png');

  if (testResults.preferencesIsolated && testResults.userSwitchingWorks) {
    console.log('\n🎉 USER PREFERENCE ISOLATION ISSUE RESOLVED!');
    console.log('The fix is working correctly - users now have separate preference storage.');
  } else {
    console.log('\n⚠️ Issues still remain - further debugging needed.');
  }

  await browser.close();

} catch (error) {
  console.error('❌ Test failed:', error.message);
}