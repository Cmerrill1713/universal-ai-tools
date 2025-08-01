import puppeteer from 'puppeteer';

async function testChatComprehensive() {
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
    console.log('❌ Failed request:', request.url(), request.failure().errorText);
  });
  
  // Intercept API responses
  page.on('response', async response => {
    if (response.url().includes('/api/') || response.url().includes('/assistant')) {
      const status = response.ok() ? '✅' : '❌';
      console.log(`${status} API ${response.status()}: ${response.url()}`);
      if (!response.ok()) {
        try {
          const body = await response.text();
          console.log('Response body:', body);
        } catch (e) {
          console.log('Could not read response body');
        }
      }
    }
  });

  console.log('=== Testing Universal AI Tools Dashboard ===');
  
  try {
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Dashboard loaded successfully');
    
    // Look for the chat input in the dashboard
    await page.waitForSelector('input[placeholder*="message" i], textarea', { timeout: 10000 });
    console.log('✅ Found chat input element');
    
    // Type a test message
    const chatInput = await page.$('input[placeholder*="message" i], textarea');
    if (chatInput) {
      await chatInput.type('Hello from Puppeteer comprehensive test');
      console.log('✅ Typed test message');
      
      // Find and click send button
      const sendButton = await page.$('button[type="submit"], button:has-text("Send"), button:has(svg)');
      if (sendButton) {
        console.log('🔄 Clicking send button...');
        await sendButton.click();
        
        // Wait for response
        console.log('⏳ Waiting for chat response...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Take screenshot
        await page.screenshot({ path: 'dashboard-chat-test.png', fullPage: true });
        console.log('📸 Dashboard screenshot saved');
      } else {
        console.log('❌ No send button found in dashboard');
      }
    }
  } catch (error) {
    console.log('❌ Dashboard test error:', error.message);
  }
  
  console.log('\n=== Testing Dedicated Chat Page ===');
  
  try {
    await page.goto('http://localhost:5173/chat', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Chat page loaded successfully');
    
    // Wait for chat input
    await page.waitForSelector('input, textarea', { timeout: 10000 });
    console.log('✅ Found chat page input element');
    
    // Type a test message
    const chatInput = await page.$('input, textarea');
    if (chatInput) {
      await chatInput.clear();
      await chatInput.type('Testing dedicated chat page functionality');
      console.log('✅ Typed test message on chat page');
      
      // Find and click send button
      const sendButton = await page.$('button[type="submit"], button:contains("Send"), button:has(svg)');
      if (sendButton) {
        console.log('🔄 Clicking send button on chat page...');
        await sendButton.click();
        
        // Wait for response
        console.log('⏳ Waiting for chat page response...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Take screenshot
        await page.screenshot({ path: 'chat-page-test.png', fullPage: true });
        console.log('📸 Chat page screenshot saved');
      } else {
        console.log('❌ No send button found on chat page');
      }
    }
  } catch (error) {
    console.log('❌ Chat page test error:', error.message);
  }
  
  console.log('\n=== Test Summary ===');
  console.log('Screenshots saved:');
  console.log('- dashboard-chat-test.png');
  console.log('- chat-page-test.png');
  console.log('\n🔍 Browser will stay open for manual inspection. Close when done.');
}

testChatComprehensive().catch(console.error);