import puppeteer from 'puppeteer';

async function manualInspection() {
  console.log('🔍 Opening browser for manual inspection...\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const page = await browser.newPage();
  
  // Log all API calls
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      const status = response.ok() ? '✅' : '❌';
      console.log(`${status} ${response.status()}: ${response.url()}`);
    }
  });

  console.log('Loading chat page...');
  await page.goto('http://localhost:5173/chat');
  
  console.log('\n✨ Browser opened! Please manually test:');
  console.log('1. ✅ Check if chat page loads');
  console.log('2. ✅ Try typing a message');
  console.log('3. ✅ Click send button');  
  console.log('4. ✅ Check if you get a response');
  console.log('5. ✅ Verify no "Error processing message" appears');
  console.log('\nPress Ctrl+C to close when done testing.');
  
  // Keep open indefinitely
  setInterval(() => {}, 1000);
}

manualInspection().catch(console.error);