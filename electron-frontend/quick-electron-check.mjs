import { execSync } from 'child_process';

console.log('🔍 Quick Electron App Check');

try {
  // Check if Vite dev server is responding
  console.log('📡 Testing Vite dev server...');
  const response = await fetch('http://localhost:3007');
  const html = await response.text();
  console.log('✅ Vite dev server is responding');
  console.log('📄 HTML length:', html.length);
  console.log('📄 Title:', html.match(/<title>(.*?)<\/title>/)?.[1] || 'No title found');
  
  // Check if we can see the loading screen or main content
  const hasLoadingScreen = html.includes('loading');
  const hasReactRoot = html.includes('id="root"');
  const hasUniversalAI = html.includes('Universal AI Tools');
  
  console.log('🔍 Content analysis:');
  console.log('  Has loading screen:', hasLoadingScreen);
  console.log('  Has React root:', hasReactRoot);
  console.log('  Has Universal AI branding:', hasUniversalAI);
  
  // Check if Electron processes are running
  console.log('🔍 Checking for Electron processes...');
  const electronProcesses = execSync('ps aux | grep -i electron | grep -v grep || true').toString();
  const electronCount = electronProcesses.split('\n').filter(line => line.trim()).length;
  console.log(`🖥️ Found ${electronCount} Electron processes running`);
  
  if (electronCount > 0) {
    console.log('✅ Electron app appears to be running');
  } else {
    console.log('❌ No Electron processes found');
  }

} catch (error) {
  console.error('❌ Error during check:', error.message);
}