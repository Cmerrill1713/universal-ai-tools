import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Listen for console messages
  page.on('console', msg => {
    console.log(`CONSOLE: ${msg.type()}: ${msg.text()}`);
  });
  
  // Listen for page errors
  page.on('pageerror', error => {
    console.log(`PAGE ERROR: ${error.message}`);
  });
  
  // Listen for failed requests
  page.on('requestfailed', request => {
    console.log(`REQUEST FAILED: ${request.url()} - ${request.failure().errorText}`);
  });
  
  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 10000 });
    
    // Wait a moment for React to render
    await page.waitForTimeout(3000);
    
    // Check what's in the root div
    const rootContent = await page.locator('#root').innerHTML();
    console.log('Root div content:', rootContent);
    
    // Check if any Material-UI components are present
    const muiComponents = await page.locator('[class*="Mui"]').count();
    console.log('Material-UI components found:', muiComponents);
    
    // Check for buttons
    const buttons = await page.locator('button').count();
    console.log('Buttons found:', buttons);
    
    // Take a screenshot
    await page.screenshot({ path: 'debug-screenshot.png' });
    console.log('Screenshot saved as debug-screenshot.png');
    
    // Check for any text content
    const bodyText = await page.textContent('body');
    console.log('Body text length:', bodyText?.length || 0);
    console.log('Body text preview:', bodyText?.substring(0, 200) || 'No text');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await browser.close();
})();