import puppeteer from 'puppeteer';

async function testChatFix() {
    console.log('🚀 Testing Chat Fix on http://localhost:5174');
    console.log('==============================================');
    
    let browser;
    let page;
    
    try {
        browser = await puppeteer.launch({
            headless: false,
            devtools: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Capture all console messages and network requests
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.text().includes('API')) {
                console.log(`📝 [${msg.type().toUpperCase()}] ${msg.text()}`);
            }
        });
        
        page.on('response', response => {
            if (response.url().includes('localhost:9999/api/v1/chat')) {
                console.log(`📡 Chat API Response: ${response.status()} ${response.url()}`);
            }
        });
        
        // Navigate to the frontend
        console.log('\n🔍 Loading http://localhost:5174');
        await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });
        console.log('✅ Page loaded successfully');
        
        // Wait for chat input
        await page.waitForSelector('input[placeholder*="Ask me anything"]', { timeout: 10000 });
        console.log('✅ Chat input found');
        
        // Type a test message
        const testMessage = 'Hello! This is a test of the fixed API call.';
        await page.type('input[placeholder*="Ask me anything"]', testMessage);
        console.log(`✅ Typed message: "${testMessage}"`);
        
        // Take screenshot before sending
        await page.screenshot({ path: 'chat-fix-before.png', fullPage: true });
        console.log('📸 Screenshot taken before sending');
        
        // Find and click send button
        const sendButton = await page.$('button');
        if (sendButton) {
            console.log('🚀 Clicking send button...');
            await sendButton.click();
            
            // Wait for response
            await new Promise(resolve => setTimeout(resolve, 8000));
            
            // Take screenshot after sending
            await page.screenshot({ path: 'chat-fix-after.png', fullPage: true });
            console.log('📸 Screenshot taken after sending');
            
            // Check for messages
            const messages = await page.$$eval('[class*="message"], .message', elements => 
                elements.map(el => ({
                    text: el.textContent?.trim(),
                    className: el.className
                })).filter(m => m.text && m.text.length > 0)
            );
            
            console.log(`💬 Found ${messages.length} messages:`);
            messages.forEach((msg, i) => {
                console.log(`   ${i + 1}. "${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}"`);
            });
            
            if (messages.length >= 2) {
                console.log('✅ SUCCESS: Chat messages are appearing correctly!');
            } else if (messages.length === 1) {
                console.log('⚠️  PARTIAL: Only user message visible, checking for API response...');
            } else {
                console.log('❌ ISSUE: No messages found in chat interface');
            }
        } else {
            console.log('❌ Send button not found');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (page) {
            await page.screenshot({ path: 'chat-fix-error.png', fullPage: true });
            console.log('📸 Error screenshot saved');
        }
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

testChatFix().catch(console.error);