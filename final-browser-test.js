import puppeteer from 'puppeteer';

async function finalTest() {
  console.log('🔍 Final Browser Test - Manual Verification');
  console.log('==========================================\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  // Log the specific error we're looking for
  page.on('console', msg => {
    if (msg.text().includes('api.chat is not a function')) {
      console.log('❌ ERROR STILL PRESENT: api.chat is not a function');
    }
  });
  
  // Track API calls
  page.on('response', response => {
    if (response.url().includes('/api/v1/chat')) {
      console.log(`📡 Chat API called: ${response.status()}`);
    }
  });

  console.log('Loading chat page...');
  await page.goto('http://localhost:5173/chat');
  
  console.log('\n🎯 PLEASE TEST MANUALLY:');
  console.log('1. Look for the text input field');
  console.log('2. Type a message like "hello test"'); 
  console.log('3. Click the Send button');
  console.log('4. Watch console for "api.chat is not a function" error');
  console.log('5. Check if you get a response or error message\n');
  console.log('If you see an API call logged above and no "api.chat is not a function",');
  console.log('then the fix is working! 🎉\n');
  console.log('Press Ctrl+C when done testing.');
  
  // Keep open until manually closed
  setInterval(() => {}, 1000);
}

finalTest().catch(console.error);