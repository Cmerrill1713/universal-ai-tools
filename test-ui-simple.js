import puppeteer from 'puppeteer';

async function testUI() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Log all console messages
  page.on('console', msg => console.log('Browser:', msg.type(), msg.text()));
  
  // Log all failed requests
  page.on('requestfailed', request => {
    console.log('Failed request:', request.url(), request.failure().errorText);
  });
  
  // Intercept API responses
  page.on('response', async response => {
    if (response.url().includes('/api/')) {
      console.log(`API ${response.status()}: ${response.url()}`);
      if (!response.ok()) {
        const body = await response.text();
        console.log('Response body:', body);
      }
    }
  });

  console.log('Going to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  
  // Navigate to chat
  await page.click('a[href="/chat"]');
  await page.waitForNavigation();
  
  // Wait for chat input
  await page.waitForSelector('textarea');
  
  // Type message
  await page.type('textarea', 'Test message from Puppeteer');
  
  // Find send button (it has an SVG icon)
  const sendButton = await page.$('button:has(svg)');
  
  console.log('Clicking send...');
  await sendButton.click();
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Take screenshot
  await page.screenshot({ path: 'chat-result.png', fullPage: true });
  console.log('Screenshot saved as chat-result.png');
  
  // Keep browser open
  console.log('Browser will stay open. Close manually when done.');
}

testUI().catch(console.error);