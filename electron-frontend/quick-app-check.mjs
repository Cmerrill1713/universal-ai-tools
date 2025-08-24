import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';

console.log('📸 Quick App Screenshot Test');
console.log('============================');

try {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  
  if (!existsSync(chromePath)) {
    throw new Error('Chrome not found');
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  
  // Set viewport for better screenshots
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('http://localhost:3007', { waitUntil: 'networkidle0' });

  console.log('✅ Connected to app');
  
  // Wait a moment for full load
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Take screenshot
  await page.screenshot({ path: '/tmp/current-app-state.png', fullPage: true });
  console.log('📸 Current app state: /tmp/current-app-state.png');

  // Check what's in localStorage
  const currentStorage = await page.evaluate(() => {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        storage[key] = localStorage.getItem(key);
      }
    }
    return {
      keys: Object.keys(storage),
      storage: storage
    };
  });

  console.log('💾 Current localStorage keys:', currentStorage.keys);
  
  if (currentStorage.keys.length > 0) {
    currentStorage.keys.forEach(key => {
      if (key.includes('universal-ai-tools')) {
        const data = JSON.parse(currentStorage.storage[key]);
        console.log(`👤 ${key}:`);
        console.log(`   User: ${data.currentUser?.name || 'Unknown'}`);
        console.log(`   Model: ${data.preferences?.defaultModel || 'Not set'}`);
      }
    });
  } else {
    console.log('⚠️ No localStorage data found');
  }

  await browser.close();
  console.log('✅ Test completed successfully');

} catch (error) {
  console.error('❌ Test failed:', error.message);
}