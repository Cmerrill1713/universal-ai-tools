import puppeteer from 'puppeteer';

async function testChatDirect() {
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
    if (response.url().includes('/api/') || response.url().includes('/assistant')) {
      console.log(`API ${response.status()}: ${response.url()}`);
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

  console.log('Going to http://localhost:5173/chat directly...');
  try {
    await page.goto('http://localhost:5173/chat', { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
  } catch (error) {
    console.log('Navigation error:', error.message);
    // Continue anyway to see what we can test
  }
  
  // Wait a bit for the page to load
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if we can find any chat-related elements
  try {
    const textarea = await page.$('textarea');
    if (textarea) {
      console.log('✅ Found textarea element');
      
      // Type a test message
      await textarea.type('Hello from Puppeteer test');
      console.log('✅ Typed test message');
      
      // Look for send button - try multiple selectors
      const sendSelectors = [
        'button[type="submit"]',
        'button:has(svg)',
        'button[aria-label*="send" i]',
        'button[title*="send" i]',
        '.send-button',
        '[data-testid="send-button"]'
      ];
      
      let sendButton = null;
      for (const selector of sendSelectors) {
        try {
          sendButton = await page.$(selector);
          if (sendButton) {
            console.log(`✅ Found send button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      if (sendButton) {
        console.log('🔄 Clicking send button...');
        await sendButton.click();
        
        // Wait for response
        console.log('⏳ Waiting for response...');
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Take screenshot
        await page.screenshot({ path: 'chat-test-result.png', fullPage: true });
        console.log('📸 Screenshot saved as chat-test-result.png');
      } else {
        console.log('❌ No send button found');
        
        // Try pressing Enter instead
        console.log('🔄 Trying Enter key...');
        await textarea.press('Enter');
        
        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Take screenshot
        await page.screenshot({ path: 'chat-enter-test-result.png', fullPage: true });
        console.log('📸 Screenshot saved as chat-enter-test-result.png');
      }
    } else {
      console.log('❌ No textarea found');
    }
  } catch (error) {
    console.log('Chat test error:', error.message);
  }
  
  // Take a final screenshot regardless
  try {
    await page.screenshot({ path: 'chat-final-state.png', fullPage: true });
    console.log('📸 Final screenshot saved as chat-final-state.png');
  } catch (e) {
    console.log('Could not take final screenshot');
  }
  
  // Keep browser open for manual inspection
  console.log('🔍 Browser will stay open for manual inspection. Close when done.');
}

testChatDirect().catch(console.error);