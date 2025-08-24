const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console logs
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warn') {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${type.toUpperCase()}: ${msg.text()}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error) => {
    console.log('PAGE ERROR:', error.message);
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully');

    // Wait a bit for any async errors
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if main app element exists
    const appExists = await page.$('#root');
    console.log('App root exists:', !!appExists);
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('Error loading page:', error.message);
  } finally {
    await browser.close();
  }
})();
