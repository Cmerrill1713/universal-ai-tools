import puppeteer from 'puppeteer';

async function testApiMethodFix() {
  console.log('🔧 Testing API Method Fix');
  console.log('=========================\n');
  
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  const page = await browser.newPage();
  
  // Track for the specific error
  let apiChatError = false;
  let chatApiCalled = false;
  let chatSuccess = false;
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('api.chat is not a function')) {
      apiChatError = true;
      console.log('❌ FOUND THE ERROR: api.chat is not a function');
    } else if (text.includes('API request')) {
      console.log('📡 API Request:', text);
    }
  });
  
  page.on('response', async response => {
    if (response.url().includes('/api/v1/chat')) {
      chatApiCalled = true;
      chatSuccess = response.ok();
      console.log(`📡 Chat API: ${response.status()} ${response.ok() ? '✅' : '❌'}`);
    }
  });

  try {
    console.log('1️⃣ Loading chat page...');
    await page.goto('http://localhost:5173/chat', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    console.log('✅ Chat page loaded\n');
    
    console.log('2️⃣ Sending test message...');
    
    // Wait for input and type
    await page.waitForSelector('input[type="text"]', { timeout: 10000 });
    await page.type('input[type="text"]', 'Test API method fix');
    
    // Click send
    await page.click('button[type="submit"]');
    console.log('✅ Message sent\n');
    
    // Wait for response
    console.log('3️⃣ Waiting for response...');
    await page.waitForTimeout(8000);
    
    console.log('\n🎯 RESULTS:');
    console.log(`   api.chat error: ${apiChatError ? '❌ Still present' : '✅ Fixed'}`);
    console.log(`   Chat API called: ${chatApiCalled ? '✅ Yes' : '❌ No'}`);
    console.log(`   API successful: ${chatSuccess ? '✅ Yes' : '❌ No'}`);
    
    // Check for actual response in UI
    const responses = await page.$$eval('.bg-gray-800', elements => 
      elements.map(el => el.textContent).filter(text => text && text.length > 20)
    );
    
    console.log(`   UI responses found: ${responses.length}`);
    if (responses.length > 0) {
      console.log(`   Sample response: "${responses[0].substring(0, 80)}..."`);
    }
    
    const overallSuccess = !apiChatError && chatApiCalled && chatSuccess && responses.length > 0;
    console.log(`\n🏆 OVERALL: ${overallSuccess ? '✅ SUCCESS!' : '❌ Still has issues'}`);
    
    // Screenshot
    await page.screenshot({ path: 'api-method-fix-test.png', fullPage: true });
    console.log('📸 Screenshot: api-method-fix-test.png');
    
  } catch (error) {
    console.log(`❌ Test error: ${error.message}`);
  }
  
  console.log('\n⏰ Keeping browser open for 10 seconds...');
  setTimeout(() => {
    browser.close();
    console.log('🔒 Test complete!');
  }, 10000);
}

testApiMethodFix().catch(console.error);