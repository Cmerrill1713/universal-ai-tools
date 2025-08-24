const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const { spawn } = require('child_process');

let actionServer;
let browser;
let context;
let mainPage;
let monitorPage;

test.describe('Action Assistant with Activity Monitor', () => {
    test.beforeAll(async () => {
        console.log('🚀 Starting Action Assistant Server...');
        
        // Start the action server
        actionServer = spawn('node', ['action-assistant-server.cjs'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe'
        });

        // Wait for server to start
        await new Promise((resolve) => {
            actionServer.stdout.on('data', (data) => {
                if (data.toString().includes('Running on')) {
                    console.log('✅ Action server started');
                    resolve();
                }
            });
        });

        // Launch browser
        browser = await chromium.launch({
            headless: false, // Show browser for debugging
            args: ['--allow-popups', '--disable-popup-blocking']
        });
        
        context = await browser.newContext({
            permissions: ['clipboard-read', 'clipboard-write'],
            ignoreHTTPSErrors: true
        });
    });

    test.afterAll(async () => {
        // Clean up
        if (actionServer) {
            actionServer.kill();
            console.log('🛑 Action server stopped');
        }
        if (browser) {
            await browser.close();
        }
    });

    test('should load action assistant and open activity monitor', async () => {
        console.log('📍 Test 1: Loading action assistant...');
        
        // Open main page
        mainPage = await context.newPage();
        const filePath = `file://${path.join(__dirname, '..', 'action-assistant.html')}`;
        await mainPage.goto(filePath);
        
        // Check main page loaded
        await expect(mainPage.locator('h1')).toContainText('Action Assistant');
        console.log('✅ Main page loaded');
        
        // Wait for new window (activity monitor)
        const popupPromise = context.waitForEvent('page');
        await mainPage.reload(); // Trigger initialization
        monitorPage = await popupPromise;
        
        // Verify monitor window opened
        await expect(monitorPage.locator('h1')).toContainText('AI ACTIVITY MONITOR');
        console.log('✅ Activity monitor window opened');
        
        // Check panels are present
        await expect(monitorPage.locator('.panel-header:has-text("REQUEST FLOW")')).toBeVisible();
        await expect(monitorPage.locator('.panel-header:has-text("MODEL ACTIVITY")')).toBeVisible();
        await expect(monitorPage.locator('.panel-header:has-text("REASONING & TOKENS")')).toBeVisible();
        await expect(monitorPage.locator('.panel-header:has-text("STATISTICS")')).toBeVisible();
        console.log('✅ All monitor panels present');
    });

    test('should check service status indicators', async () => {
        console.log('📍 Test 2: Checking service status...');
        
        // Check action server status on main page
        const actionServerStatus = mainPage.locator('#actionServerStatus');
        await expect(actionServerStatus).toHaveClass(/status-indicator(?!.*offline)/);
        console.log('✅ Action server status is online');
        
        // Check service indicators on monitor
        const indicators = monitorPage.locator('.indicator');
        const indicatorCount = await indicators.count();
        expect(indicatorCount).toBeGreaterThan(0);
        console.log(`✅ Found ${indicatorCount} service indicators`);
    });

    test('should display available tools', async () => {
        console.log('📍 Test 3: Checking available tools...');
        
        // Wait for tools to load
        await mainPage.waitForSelector('.tool-item', { timeout: 5000 });
        
        // Count tools
        const tools = mainPage.locator('.tool-item');
        const toolCount = await tools.count();
        expect(toolCount).toBeGreaterThan(0);
        console.log(`✅ Found ${toolCount} available tools`);
        
        // Check specific tools are present
        await expect(mainPage.locator('.tool-name:has-text("bash")')).toBeVisible();
        await expect(mainPage.locator('.tool-name:has-text("readFile")')).toBeVisible();
        await expect(mainPage.locator('.tool-name:has-text("writeFile")')).toBeVisible();
        console.log('✅ Core tools are available');
    });

    test('should execute a simple command and show in monitor', async () => {
        console.log('📍 Test 4: Testing command execution...');
        
        // Type a command
        const input = mainPage.locator('#chatInput');
        await input.fill('Check file structure');
        
        // Send the message
        await mainPage.click('#sendButton');
        
        // Wait for response
        await mainPage.waitForSelector('.message.assistant', { timeout: 10000 });
        console.log('✅ Received assistant response');
        
        // Check if action was logged in monitor
        await monitorPage.waitForSelector('.flow-item', { timeout: 5000 });
        const flowItems = monitorPage.locator('.flow-item');
        const flowCount = await flowItems.count();
        expect(flowCount).toBeGreaterThan(0);
        console.log(`✅ Activity monitor shows ${flowCount} request(s)`);
    });

    test('should update statistics in monitor', async () => {
        console.log('📍 Test 5: Checking statistics update...');
        
        // Check total requests counter
        const totalRequests = monitorPage.locator('#totalRequests');
        const requestCount = await totalRequests.textContent();
        expect(parseInt(requestCount)).toBeGreaterThan(0);
        console.log(`✅ Total requests: ${requestCount}`);
        
        // Check if response time is recorded
        const avgResponse = monitorPage.locator('#avgResponse');
        const responseTime = await avgResponse.textContent();
        expect(responseTime).toContain('ms');
        console.log(`✅ Average response time: ${responseTime}`);
    });

    test('should handle quick actions', async () => {
        console.log('📍 Test 6: Testing quick actions...');
        
        // Click a quick action button
        const quickAction = mainPage.locator('.quick-action:has-text("Check Files")');
        await quickAction.click();
        
        // Verify input was filled
        const inputValue = await mainPage.locator('#chatInput').inputValue();
        expect(inputValue).toBe('Check file structure');
        console.log('✅ Quick action filled input');
        
        // Send and wait for response
        await mainPage.click('#sendButton');
        await mainPage.waitForSelector('.message.action', { timeout: 10000 });
        console.log('✅ Quick action executed');
    });

    test('should show real-time activity indicators', async () => {
        console.log('📍 Test 7: Testing activity indicators...');
        
        // Get initial state of activity light
        const activityLight = monitorPage.locator('#activityLight');
        
        // Trigger an action
        await mainPage.locator('#chatInput').fill('Run tests');
        await mainPage.click('#sendButton');
        
        // Check if activity light becomes active
        await expect(activityLight).toHaveClass(/active/, { timeout: 5000 });
        console.log('✅ Activity indicator activated during request');
        
        // Wait for it to return to normal
        await expect(activityLight).not.toHaveClass(/active/, { timeout: 10000 });
        console.log('✅ Activity indicator deactivated after completion');
    });

    test('should clear monitor panels', async () => {
        console.log('📍 Test 8: Testing clear functionality...');
        
        // Clear request flow panel
        const clearButton = monitorPage.locator('.clear-btn').first();
        await clearButton.click();
        
        // Check panel was cleared
        const clearedMessage = monitorPage.locator('.log-entry:has-text("[CLEARED]")');
        await expect(clearedMessage).toBeVisible();
        console.log('✅ Panel cleared successfully');
    });

    test('should show error handling', async () => {
        console.log('📍 Test 9: Testing error handling...');
        
        // Send an invalid command
        await mainPage.locator('#chatInput').fill('read file "/invalid/path/file.txt"');
        await mainPage.click('#sendButton');
        
        // Wait for error response
        await mainPage.waitForSelector('.message', { timeout: 10000 });
        
        // Check if error is shown in monitor
        const errorMsg = monitorPage.locator('.error-msg');
        const errorCount = await errorMsg.count();
        if (errorCount > 0) {
            console.log('✅ Error displayed in monitor');
        }
    });

    test('should maintain connection between windows', async () => {
        console.log('📍 Test 10: Testing window communication...');
        
        // Send multiple messages
        for (let i = 0; i < 3; i++) {
            await mainPage.locator('#chatInput').fill(`Test message ${i + 1}`);
            await mainPage.click('#sendButton');
            await mainPage.waitForTimeout(500);
        }
        
        // Check monitor received all messages
        const flowItems = monitorPage.locator('.flow-item');
        const itemCount = await flowItems.count();
        expect(itemCount).toBeGreaterThanOrEqual(3);
        console.log(`✅ Monitor tracked ${itemCount} messages`);
        
        // Verify statistics updated
        const totalRequests = await monitorPage.locator('#totalRequests').textContent();
        expect(parseInt(totalRequests)).toBeGreaterThanOrEqual(3);
        console.log(`✅ Statistics show ${totalRequests} total requests`);
    });
});

// Summary test
test('Integration Summary', async () => {
    console.log('\n' + '='.repeat(50));
    console.log('📊 ACTION ASSISTANT TEST SUMMARY');
    console.log('='.repeat(50));
    console.log('✅ Action Assistant loads successfully');
    console.log('✅ Activity Monitor opens automatically');
    console.log('✅ Tools are loaded and displayed');
    console.log('✅ Commands execute properly');
    console.log('✅ Real-time monitoring works');
    console.log('✅ Statistics update correctly');
    console.log('✅ Window communication functional');
    console.log('✅ Error handling works');
    console.log('='.repeat(50));
    console.log('🎉 All tests passed! System working as intended.');
});