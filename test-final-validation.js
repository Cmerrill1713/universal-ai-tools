import puppeteer from 'puppeteer';

async function testFinalValidation() {
  console.log('🔧 Final Chat Functionality Validation');
  console.log('=====================================\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  
  // Track API calls
  let chatApiCalled = false;
  let chatApiSuccess = false;
  let responseData = null;
  
  page.on('response', async response => {
    if (response.url().includes('/api/v1/chat') && !response.url().includes('history')) {
      chatApiCalled = true;
      chatApiSuccess = response.ok();
      console.log(`📡 Chat API called: ${response.status()} ${response.url()}`);
      
      if (response.ok()) {
        try {
          const body = await response.text();
          responseData = JSON.parse(body);
          console.log('✅ API Response received successfully');
          console.log(`   Message: ${responseData.message ? '✅ Present' : '❌ Missing'}`);
          console.log(`   Data.message.content: ${responseData.data?.message?.content ? '✅ Present' : '❌ Missing'}`);
          console.log(`   ConversationId: ${responseData.conversationId ? '✅ Present' : '❌ Missing'}`);
        } catch (e) {
          console.log('❌ Could not parse API response');
        }
      }
    }
  });

  try {
    console.log('1️⃣ Loading chat page...');
    await page.goto('http://localhost:5173/chat', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    console.log('✅ Chat page loaded successfully\n');
    
    console.log('2️⃣ Looking for chat elements...');
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    console.log('✅ Input field found');
    
    const sendButton = await page.$('button[type="submit"]');
    if (sendButton) {
      console.log('✅ Send button found');
    } else {
      console.log('❌ Send button not found');
      throw new Error('Send button missing');
    }
    
    console.log('\n3️⃣ Testing chat interaction...');
    await page.type('input[type="text"]', 'Hello! This is a final validation test.');
    console.log('✅ Test message typed');
    
    await sendButton.click();
    console.log('✅ Send button clicked');
    
    // Wait for API call and response
    console.log('⏳ Waiting for API response...');
    await page.waitForTimeout(8000);
    
    console.log('\n4️⃣ Validation Results:');
    console.log(`   API Called: ${chatApiCalled ? '✅ Yes' : '❌ No'}`);
    console.log(`   API Success: ${chatApiSuccess ? '✅ Yes' : '❌ No'}`);
    
    if (responseData) {
      const hasMessage = responseData.message || responseData.data?.message?.content;
      console.log(`   Response Format: ${hasMessage ? '✅ Valid' : '❌ Invalid'}`);
    }
    
    // Check for assistant response in UI
    await page.waitForTimeout(2000);
    const messageElements = await page.$$('.bg-gray-800');
    const assistantMessages = [];
    
    for (const element of messageElements) {
      const text = await element.evaluate(el => el.textContent);
      if (text && text.length > 10 && !text.includes('Type your message')) {
        assistantMessages.push(text);
      }
    }
    
    console.log(`   UI Response: ${assistantMessages.length > 0 ? '✅ Found' : '❌ None'}`);
    if (assistantMessages.length > 0) {
      console.log(`   Response Preview: "${assistantMessages[0].substring(0, 100)}..."`);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'final-validation-result.png', fullPage: true });
    console.log('\n📸 Screenshot saved: final-validation-result.png');
    
    console.log('\n🎯 FINAL VERDICT:');
    const allWorking = chatApiCalled && chatApiSuccess && assistantMessages.length > 0;
    console.log(allWorking ? '✅ CHAT FUNCTIONALITY IS WORKING!' : '❌ Issues still remain');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  }
  
  console.log('\n⏰ Keeping browser open for 15 seconds for manual inspection...');
  setTimeout(() => {
    browser.close();
    console.log('🔒 Browser closed. Test complete!');
  }, 15000);
}

testFinalValidation().catch(console.error);