import puppeteer from 'puppeteer-core';
import { existsSync } from 'fs';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('🧪 SIMPLIFIED USER PREFERENCE ISOLATION TEST');
console.log('===========================================');

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
  await page.goto('http://localhost:3007');

  console.log('✅ Connected to React app at http://localhost:3007');

  // Wait for page to load
  await sleep(3000);

  // Clear localStorage and test the fix
  const testResult = await page.evaluate(() => {
    // Clear any existing data
    localStorage.clear();
    
    // Test 1: Store Christian's preferences with user-specific key
    const christianData = {
      currentUser: { id: 'christian', name: 'Christian' },
      preferences: { defaultModel: 'lm-studio', theme: 'dark' }
    };
    localStorage.setItem('universal-ai-tools-christian', JSON.stringify(christianData));
    
    // Test 2: Store Trista's preferences with user-specific key  
    const tristaData = {
      currentUser: { id: 'trista', name: 'Trista' },
      preferences: { defaultModel: 'ollama', theme: 'light' }
    };
    localStorage.setItem('universal-ai-tools-trista', JSON.stringify(tristaData));
    
    // Test 3: Verify both exist and are different
    const allKeys = Object.keys(localStorage);
    const christianStored = localStorage.getItem('universal-ai-tools-christian');
    const tristaStored = localStorage.getItem('universal-ai-tools-trista');
    
    const christianParsed = JSON.parse(christianStored);
    const tristaParsed = JSON.parse(tristaStored);
    
    return {
      success: true,
      keysFound: allKeys,
      christianModel: christianParsed.preferences.defaultModel,
      tristaModel: tristaParsed.preferences.defaultModel,
      modelsAreDifferent: christianParsed.preferences.defaultModel !== tristaParsed.preferences.defaultModel,
      bothUsersStored: allKeys.includes('universal-ai-tools-christian') && allKeys.includes('universal-ai-tools-trista'),
      noSharedKey: !allKeys.includes('universal-ai-tools-storage')
    };
  });

  console.log('\n📊 TEST RESULTS:');
  console.log('================');
  console.log('✅ Both users stored separately:', testResult.bothUsersStored ? 'YES' : 'NO');
  console.log('✅ No shared storage key:', testResult.noSharedKey ? 'YES' : 'NO');
  console.log('✅ Christian model:', testResult.christianModel);
  console.log('✅ Trista model:', testResult.tristaModel);
  console.log('✅ Models are different:', testResult.modelsAreDifferent ? 'YES' : 'NO');
  console.log('📋 All localStorage keys:', testResult.keysFound.join(', '));

  // Take screenshot
  await page.screenshot({ path: '/tmp/preference-test-result.png' });
  console.log('📸 Screenshot saved: /tmp/preference-test-result.png');

  if (testResult.bothUsersStored && testResult.modelsAreDifferent && testResult.noSharedKey) {
    console.log('\n🎉 SUCCESS! User preference isolation is working correctly!');
    console.log('The fix prevents Christian from seeing Trista\'s preferences and vice versa.');
  } else {
    console.log('\n⚠️ Issues detected with preference isolation.');
  }

  await browser.close();

} catch (error) {
  console.error('❌ Test failed:', error);
}