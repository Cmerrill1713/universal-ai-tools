export default {
  launch: {
    headless: false,
    devtools: true,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-features=VizDisplayCompositor',
      '--disable-ipc-flooding-protection',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--disable-features=TranslateUI',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-popup-blocking',
      '--disable-images',
      '--disable-javascript',
      '--disable-background-mode',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--disable-web-security',
      '--disable-features=site-per-process',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--ignore-certificate-errors-skip-list',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1920,1080'
    ]
  },
  
  testRunner: {
    timeout: 30000,
    retries: 3,
    concurrency: 6,
    slowMo: 50,
    waitForTimeout: 5000,
    waitForAction: 1000,
    screenshotOnFailure: true,
    videoOnFailure: true
  },
  
  servers: [
    {
      name: 'ui',
      url: 'http://localhost:5173',
      timeout: 30000
    },
    {
      name: 'api',
      url: 'http://localhost:9999',
      timeout: 30000
    }
  ],
  
  viewports: [
    { name: 'desktop-large', width: 1920, height: 1080 },
    { name: 'desktop-medium', width: 1366, height: 768 },
    { name: 'mobile-large', width: 414, height: 896 },
    { name: 'mobile-medium', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'tablet-landscape', width: 1024, height: 768 }
  ],
  
  browsers: [
    {
      name: 'chrome',
      product: 'chrome',
      headless: false,
      slowMo: 50
    },
    {
      name: 'chrome-headless',
      product: 'chrome',
      headless: true,
      slowMo: 0
    }
  ]
};