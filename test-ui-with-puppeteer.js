import puppeteer from 'puppeteer';

async function testUniversalAIToolsUI() {
  console.log('🚀 Starting UI test with Puppeteer...');
  
  const browser = await puppeteer.launch({
    headless: false, // Show the browser
    devtools: true,  // Open DevTools
    slowMo: 100,     // Slow down actions for visibility
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });
    
    // Log network errors
    page.on('pageerror', error => {
      console.error('Page error:', error.message);
    });
    
    // Log failed requests
    page.on('requestfailed', request => {
      console.error('Request failed:', request.url(), request.failure().errorText);
    });
    
    // Log responses
    page.on('response', response => {
      if (!response.ok() && response.url().includes('api')) {
        console.error(`API error ${response.status()}: ${response.url()}`);
        response.text().then(text => console.error('Response:', text));
      }
    });
    
    console.log('📱 Navigating to Universal AI Tools UI...');
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Take initial screenshot
    await page.screenshot({ 
      path: 'ui-initial-state.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: ui-initial-state.png');
    
    // Wait for the chat interface to load
    console.log('⏳ Waiting for chat interface...');
    
    // Try to find the chat page or navigate to it
    const chatLink = await page.$('a[href="/chat"]');
    if (chatLink) {
      console.log('🔗 Found chat link, clicking...');
      await chatLink.click();
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
    } else {
      // Maybe we're already on the chat page
      console.log('📍 Checking if already on chat page...');
    }
    
    // Look for chat input
    const selectors = [
      'textarea[placeholder*="message"]',
      'input[placeholder*="message"]',
      'textarea[placeholder*="ask"]',
      'input[placeholder*="ask"]',
      'textarea',
      'input[type="text"]'
    ];
    
    let chatInput = null;
    for (const selector of selectors) {
      chatInput = await page.$(selector);
      if (chatInput) {
        console.log(`✅ Found chat input with selector: ${selector}`);
        break;
      }
    }
    
    if (!chatInput) {
      console.error('❌ Could not find chat input!');
      await page.screenshot({ path: 'ui-no-chat-input.png', fullPage: true });
      console.log('📸 Screenshot saved: ui-no-chat-input.png');
      
      // Try to get page HTML for debugging
      const html = await page.content();
      console.log('Page HTML preview:', html.substring(0, 500));
      return;
    }
    
    // Type a message
    console.log('💬 Typing test message...');
    await chatInput.click();
    await page.keyboard.type('Hello, this is a test message from Puppeteer!');
    
    await page.screenshot({ 
      path: 'ui-message-typed.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: ui-message-typed.png');
    
    // Find and click send button
    const sendSelectors = [
      'button[aria-label*="send"]',
      'button svg[class*="Send"]',
      'button:has(svg)',
      'button[type="submit"]',
      'button'
    ];
    
    let sendButton = null;
    for (const selector of sendSelectors) {
      const buttons = await page.$$(selector);
      for (const button of buttons) {
        const text = await page.evaluate(el => el.textContent, button);
        const hasIcon = await page.evaluate(el => el.querySelector('svg') !== null, button);
        if (hasIcon || text?.toLowerCase().includes('send')) {
          sendButton = button;
          console.log(`✅ Found send button with selector: ${selector}`);
          break;
        }
      }
      if (sendButton) break;
    }
    
    if (!sendButton) {
      console.error('❌ Could not find send button!');
      await page.screenshot({ path: 'ui-no-send-button.png', fullPage: true });
      return;
    }
    
    // Click send button
    console.log('📤 Clicking send button...');
    await sendButton.click();
    
    // Wait for response
    console.log('⏳ Waiting for response...');
    await page.waitForTimeout(5000); // Wait 5 seconds for response
    
    // Take final screenshot
    await page.screenshot({ 
      path: 'ui-after-send.png',
      fullPage: true 
    });
    console.log('📸 Screenshot saved: ui-after-send.png');
    
    // Check for error messages
    const errorSelectors = [
      '.error',
      '[class*="error"]',
      '[class*="Error"]',
      'div[role="alert"]',
      '.alert-error'
    ];
    
    for (const selector of errorSelectors) {
      const errors = await page.$$(selector);
      for (const error of errors) {
        const text = await page.evaluate(el => el.textContent, error);
        if (text) {
          console.error(`🚨 Error found: ${text}`);
        }
      }
    }
    
    // Get network logs
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        error: request.failure().errorText
      });
    });
    
    console.log('📊 Test completed!');
    console.log(`Failed requests: ${failedRequests.length}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    await page.screenshot({ 
      path: 'ui-error-state.png',
      fullPage: true 
    });
  } finally {
    console.log('🔚 Test finished. Browser will remain open for inspection.');
    // Don't close the browser so we can inspect
    // await browser.close();
  }
}

// Run the test
testUniversalAIToolsUI().catch(console.error);