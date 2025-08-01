import puppeteer from 'puppeteer';

async function testChatFocused() {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  // Log API responses
  page.on('response', async response => {
    if (response.url().includes('/api/v1/chat')) {
      const status = response.ok() ? '✅' : '❌';
      console.log(`${status} CHAT API ${response.status()}: ${response.url()}`);
      if (response.ok()) {
        try {
          const body = await response.text();
          const data = JSON.parse(body);
          if (data.message) {
            console.log('✅ Response has message field');
          }
          if (data.data?.message?.content) {
            console.log('✅ Response has nested message content');
          }
        } catch (e) {
          console.log('Could not parse response body');
        }
      }
    }
  });

  console.log('🧪 Testing Chat Page Specifically...');
  
  try {
    await page.goto('http://localhost:5173/chat', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    console.log('✅ Chat page loaded');
    
    // Wait for and find the input
    await page.waitForSelector('input[type="text"], textarea', { timeout: 10000 });
    console.log('✅ Found input element');
    
    // Type a test message
    await page.type('input[type="text"], textarea', 'Testing fixed chat functionality');
    console.log('✅ Typed test message');
    
    // Find and click send button
    const sendButton = await page.$('button[type="submit"]');
    if (sendButton) {
      console.log('🔄 Clicking send button...');
      await sendButton.click();
      
      // Wait for response
      console.log('⏳ Waiting for response...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // Check for assistant response
      const responses = await page.$$eval('[role="assistant"], .bg-gray-800', elements => 
        elements.map(el => el.textContent).filter(text => text && text.length > 0)
      );
      
      if (responses.length > 0) {
        console.log('✅ Found assistant response(s):');
        responses.forEach((resp, i) => console.log(`  ${i + 1}. ${resp.substring(0, 100)}...`));
      } else {
        console.log('❌ No assistant responses found');
      }
      
      // Take screenshot
      await page.screenshot({ path: 'chat-functionality-test.png', fullPage: true });
      console.log('📸 Screenshot saved as chat-functionality-test.png');
      
    } else {
      console.log('❌ No send button found');
    }
    
  } catch (error) {
    console.log('❌ Test error:', error.message);
  }
  
  console.log('\n✅ Test complete! Check browser and screenshot for results.');
  
  // Keep browser open for 10 seconds then close
  setTimeout(() => {
    browser.close();
    console.log('🔒 Browser closed.');
  }, 10000);
}

testChatFocused().catch(console.error);