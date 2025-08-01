import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function testFrontendUI() {
    console.log('🚀 Starting Universal AI Tools Frontend UI Test');
    console.log('================================================');
    
    let browser;
    let page;
    const screenshots = [];
    const errors = [];
    const consoleMessages = [];
    
    try {
        // Launch browser with debugging capabilities
        browser = await puppeteer.launch({
            headless: false, // Set to true for CI/CD environments
            devtools: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-extensions',
                '--disable-gpu',
                '--no-first-run'
            ]
        });
        
        page = await browser.newPage();
        
        // Set viewport for consistent screenshots
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Capture console messages and errors
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            consoleMessages.push({ type, text, timestamp: new Date().toISOString() });
            console.log(`📝 Console ${type.toUpperCase()}: ${text}`);
        });
        
        page.on('pageerror', error => {
            errors.push({
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            });
            console.error('❌ Page Error:', error.message);
        });
        
        page.on('requestfailed', request => {
            errors.push({
                type: 'request_failed',
                url: request.url(),
                failure: request.failure().errorText,
                timestamp: new Date().toISOString()
            });
            console.error('🌐 Request Failed:', request.url(), request.failure().errorText);
        });
        
        // Test 1: Initial Page Load
        console.log('\n🔍 Test 1: Loading http://localhost:5173');
        console.log('----------------------------------------');
        
        try {
            const response = await page.goto('http://localhost:5173', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            
            console.log(`✅ Page loaded with status: ${response.status()}`);
            
            // Take initial screenshot
            const initialScreenshot = 'frontend-initial-load.png';
            await page.screenshot({ 
                path: initialScreenshot, 
                fullPage: true 
            });
            screenshots.push(initialScreenshot);
            console.log(`📸 Screenshot saved: ${initialScreenshot}`);
            
        } catch (error) {
            console.error('❌ Failed to load initial page:', error.message);
            errors.push({
                test: 'initial_load',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return;
        }
        
        // Test 2: Check Page Content and Structure
        console.log('\n🔍 Test 2: Analyzing Page Content');
        console.log('----------------------------------');
        
        try {
            // Wait for React to render
            await page.waitForTimeout(3000);
            
            // Check if the page has content
            const bodyContent = await page.evaluate(() => document.body.innerHTML);
            const hasContent = bodyContent && bodyContent.trim().length > 100;
            
            console.log(`📄 Page has content: ${hasContent}`);
            console.log(`📄 Body content length: ${bodyContent.length} characters`);
            
            // Check for React root element
            const reactRoot = await page.$('#root');
            console.log(`⚛️  React root element found: ${!!reactRoot}`);
            
            // Check for common UI elements
            const title = await page.title();
            console.log(`📝 Page title: "${title}"`);
            
            // Look for key UI components
            const uiElements = await page.evaluate(() => {
                const selectors = [
                    'header', 'nav', 'main', 'footer',
                    '.app', '.container', '.chat',
                    'button', 'input', 'textarea',
                    '[data-testid]', '[class*="chat"]', '[class*="message"]'
                ];
                
                const found = {};
                selectors.forEach(sel => {
                    const elements = document.querySelectorAll(sel);
                    found[sel] = elements.length;
                });
                
                return found;
            });
            
            console.log('🧩 UI Elements found:');
            Object.entries(uiElements).forEach(([selector, count]) => {
                if (count > 0) {
                    console.log(`   ${selector}: ${count} element(s)`);
                }
            });
            
        } catch (error) {
            console.error('❌ Error analyzing page content:', error.message);
            errors.push({
                test: 'content_analysis',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        // Test 3: Check for Chat Interface
        console.log('\n🔍 Test 3: Looking for Chat Interface');
        console.log('------------------------------------');
        
        try {
            // Look for chat-related elements with various selectors
            const chatSelectors = [
                'input[type="text"]',
                'textarea',
                'button[type="submit"]',
                '[placeholder*="message"]',
                '[placeholder*="chat"]',
                '[class*="chat"]',
                '[class*="input"]',
                '[class*="message"]',
                '[data-testid*="chat"]',
                '[data-testid*="input"]'
            ];
            
            let chatInput = null;
            let sendButton = null;
            
            for (const selector of chatSelectors) {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    console.log(`🎯 Found ${elements.length} element(s) with selector: ${selector}`);
                    
                    // Try to identify chat input and send button
                    for (const element of elements) {
                        const placeholder = await element.evaluate(el => el.placeholder || '');
                        const type = await element.evaluate(el => el.type || el.tagName.toLowerCase());
                        const text = await element.evaluate(el => el.textContent || '');
                        
                        console.log(`   - Element: ${type}, placeholder: "${placeholder}", text: "${text}"`);
                        
                        if (!chatInput && (type === 'text' || type === 'textarea' || placeholder.toLowerCase().includes('message'))) {
                            chatInput = element;
                            console.log('💬 Identified as chat input');
                        }
                        
                        if (!sendButton && (type === 'submit' || text.toLowerCase().includes('send') || text.toLowerCase().includes('submit'))) {
                            sendButton = element;
                            console.log('📤 Identified as send button');
                        }
                    }
                }
            }
            
            // Test 4: Try Chat Functionality
            if (chatInput && sendButton) {
                console.log('\n🔍 Test 4: Testing Chat Functionality');
                console.log('-----------------------------------');
                
                try {
                    // Type a test message
                    const testMessage = 'Hello, this is a test message from Puppeteer';
                    await chatInput.type(testMessage);
                    console.log(`✅ Typed test message: "${testMessage}"`);
                    
                    // Take screenshot before sending
                    const beforeSendScreenshot = 'frontend-before-send.png';
                    await page.screenshot({
                        path: beforeSendScreenshot,
                        fullPage: true
                    });
                    screenshots.push(beforeSendScreenshot);
                    console.log(`📸 Screenshot saved: ${beforeSendScreenshot}`);
                    
                    // Click send button
                    await sendButton.click();
                    console.log('✅ Clicked send button');
                    
                    // Wait for response
                    await page.waitForTimeout(5000);
                    
                    // Take screenshot after sending
                    const afterSendScreenshot = 'frontend-after-send.png';
                    await page.screenshot({
                        path: afterSendScreenshot,
                        fullPage: true
                    });
                    screenshots.push(afterSendScreenshot);
                    console.log(`📸 Screenshot saved: ${afterSendScreenshot}`);
                    
                    // Check for new messages
                    const messages = await page.evaluate(() => {
                        const messageSelectors = [
                            '[class*="message"]',
                            '[class*="chat"]',
                            '.message',
                            '.chat-message',
                            '[data-testid*="message"]'
                        ];
                        
                        let allMessages = [];
                        messageSelectors.forEach(sel => {
                            const elements = document.querySelectorAll(sel);
                            elements.forEach(el => {
                                allMessages.push({
                                    selector: sel,
                                    text: el.textContent.trim(),
                                    html: el.innerHTML
                                });
                            });
                        });
                        
                        return allMessages;
                    });
                    
                    if (messages.length > 0) {
                        console.log(`💬 Found ${messages.length} message(s) on page:`);
                        messages.forEach((msg, i) => {
                            console.log(`   ${i + 1}. [${msg.selector}] "${msg.text.substring(0, 100)}..."`);
                        });
                    } else {
                        console.log('⚠️  No messages found after sending');
                    }
                    
                } catch (error) {
                    console.error('❌ Error testing chat functionality:', error.message);
                    errors.push({
                        test: 'chat_functionality',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    });
                }
            } else {
                console.log('⚠️  Chat interface not found or incomplete');
                console.log(`   Chat input found: ${!!chatInput}`);
                console.log(`   Send button found: ${!!sendButton}`);
            }
            
        } catch (error) {
            console.error('❌ Error looking for chat interface:', error.message);
            errors.push({
                test: 'chat_interface',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        // Test 5: Check API Connectivity
        console.log('\n🔍 Test 5: Testing API Connectivity');
        console.log('-----------------------------------');
        
        try {
            // Monitor network requests
            const networkRequests = [];
            
            page.on('request', request => {
                if (request.url().includes('localhost:9999') || request.url().includes('/api/')) {
                    networkRequests.push({
                        url: request.url(),
                        method: request.method(),
                        timestamp: new Date().toISOString()
                    });
                    console.log(`🌐 API Request: ${request.method()} ${request.url()}`);
                }
            });
            
            page.on('response', response => {
                if (response.url().includes('localhost:9999') || response.url().includes('/api/')) {
                    console.log(`📡 API Response: ${response.status()} ${response.url()}`);
                }
            });
            
            // Try to trigger an API call by interacting with the page
            await page.evaluate(() => {
                // Try to find and trigger any API calls
                const buttons = document.querySelectorAll('button');
                buttons.forEach(btn => {
                    if (btn.textContent.toLowerCase().includes('test') || 
                        btn.textContent.toLowerCase().includes('send') ||
                        btn.textContent.toLowerCase().includes('submit')) {
                        btn.click();
                    }
                });
            });
            
            await page.waitForTimeout(3000);
            
            console.log(`📊 Total API requests monitored: ${networkRequests.length}`);
            
        } catch (error) {
            console.error('❌ Error testing API connectivity:', error.message);
            errors.push({
                test: 'api_connectivity',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
        // Test 6: Check for JavaScript Errors and Performance
        console.log('\n🔍 Test 6: Performance and Error Analysis');
        console.log('----------------------------------------');
        
        try {
            // Get performance metrics
            const metrics = await page.metrics();
            console.log('⚡ Performance Metrics:');
            console.log(`   Timestamp: ${metrics.Timestamp}`);
            console.log(`   Documents: ${metrics.Documents}`);
            console.log(`   Frames: ${metrics.Frames}`);
            console.log(`   JSEventListeners: ${metrics.JSEventListeners}`);
            console.log(`   Nodes: ${metrics.Nodes}`);
            console.log(`   LayoutCount: ${metrics.LayoutCount}`);
            console.log(`   RecalcStyleCount: ${metrics.RecalcStyleCount}`);
            console.log(`   LayoutDuration: ${metrics.LayoutDuration}`);
            console.log(`   RecalcStyleDuration: ${metrics.RecalcStyleDuration}`);
            console.log(`   ScriptDuration: ${metrics.ScriptDuration}`);
            console.log(`   TaskDuration: ${metrics.TaskDuration}`);
            console.log(`   JSHeapUsedSize: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)} MB`);
            console.log(`   JSHeapTotalSize: ${Math.round(metrics.JSHeapTotalSize / 1024 / 1024)} MB`);
            
            // Check for accessibility issues
            const accessibilityIssues = await page.evaluate(() => {
                const issues = [];
                
                // Check for images without alt text
                const imagesWithoutAlt = document.querySelectorAll('img:not([alt])');
                if (imagesWithoutAlt.length > 0) {
                    issues.push(`${imagesWithoutAlt.length} images without alt text`);
                }
                
                // Check for buttons without accessible names
                const buttonsWithoutLabels = document.querySelectorAll('button:not([aria-label]):not([title])');
                const unlabeledButtons = Array.from(buttonsWithoutLabels).filter(btn => !btn.textContent.trim());
                if (unlabeledButtons.length > 0) {
                    issues.push(`${unlabeledButtons.length} buttons without accessible names`);
                }
                
                // Check for form inputs without labels
                const inputsWithoutLabels = document.querySelectorAll('input:not([aria-label]):not([placeholder]):not([title])');
                if (inputsWithoutLabels.length > 0) {
                    issues.push(`${inputsWithoutLabels.length} inputs without labels`);
                }
                
                return issues;
            });
            
            if (accessibilityIssues.length > 0) {
                console.log('♿ Accessibility Issues:');
                accessibilityIssues.forEach(issue => console.log(`   - ${issue}`));
            } else {
                console.log('♿ No major accessibility issues found');
            }
            
        } catch (error) {
            console.error('❌ Error in performance analysis:', error.message);
            errors.push({
                test: 'performance_analysis',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
        
    } catch (error) {
        console.error('❌ Critical error in test execution:', error.message);
        errors.push({
            test: 'critical_error',
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
    
    // Generate comprehensive report
    console.log('\n📋 COMPREHENSIVE TEST REPORT');
    console.log('============================');
    
    console.log(`\n📸 Screenshots taken: ${screenshots.length}`);
    screenshots.forEach(screenshot => {
        console.log(`   - ${screenshot}`);
    });
    
    console.log(`\n📝 Console messages: ${consoleMessages.length}`);
    const errorMessages = consoleMessages.filter(msg => msg.type === 'error');
    const warningMessages = consoleMessages.filter(msg => msg.type === 'warn' || msg.type === 'warning');
    
    if (errorMessages.length > 0) {
        console.log(`❌ Console errors (${errorMessages.length}):`);
        errorMessages.forEach(msg => {
            console.log(`   - ${msg.text}`);
        });
    }
    
    if (warningMessages.length > 0) {
        console.log(`⚠️  Console warnings (${warningMessages.length}):`);
        warningMessages.forEach(msg => {
            console.log(`   - ${msg.text}`);
        });
    }
    
    console.log(`\n🐛 Test errors: ${errors.length}`);
    if (errors.length > 0) {
        errors.forEach((error, i) => {
            console.log(`   ${i + 1}. [${error.test || error.type || 'unknown'}] ${error.error || error.message || error.failure}`);
        });
    }
    
    // Save detailed report to file
    const report = {
        timestamp: new Date().toISOString(),
        testResults: {
            screenshots,
            errors,
            consoleMessages,
            summary: {
                totalScreenshots: screenshots.length,
                totalErrors: errors.length,
                totalConsoleMessages: consoleMessages.length,
                consoleErrors: errorMessages.length,
                consoleWarnings: warningMessages.length
            }
        }
    };
    
    fs.writeFileSync('frontend-test-report.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Detailed report saved to: frontend-test-report.json');
    
    // Final assessment
    console.log('\n🎯 FINAL ASSESSMENT');
    console.log('==================');
    
    if (errors.length === 0 && errorMessages.length === 0) {
        console.log('✅ Frontend appears to be working correctly!');
    } else if (errors.length > 0) {
        console.log('❌ Frontend has significant issues that need attention');
        console.log('🔧 Recommended actions:');
        console.log('   1. Check if the development server is running on port 5173');
        console.log('   2. Verify React/Vite configuration');
        console.log('   3. Check for build errors in the frontend code');
        console.log('   4. Ensure API endpoints are correctly configured');
    } else if (errorMessages.length > 0) {
        console.log('⚠️  Frontend is running but has console errors');
        console.log('🔧 Review console errors and fix JavaScript issues');
    }
    
    console.log('\n🏁 Test completed!');
}

// Run the test
testFrontendUI().catch(console.error);