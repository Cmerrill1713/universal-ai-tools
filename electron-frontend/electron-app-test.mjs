import { spawn, exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🖥️ REAL ELECTRON APP AUTOMATION TEST');
console.log('====================================');

async function takeScreenshot(filename) {
  try {
    await execAsync(`screencapture -T0 /tmp/${filename}`);
    console.log(`📸 Screenshot saved: /tmp/${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Screenshot failed:`, error.message);
    return false;
  }
}

async function findElectronWindow() {
  try {
    // Use AppleScript to find Universal AI Tools window
    const script = `
      tell application "System Events"
        set appList to name of every application process whose background only is false
        repeat with appName in appList
          if appName contains "Electron" or appName contains "Universal" then
            return appName as string
          end if
        end repeat
        return "not found"
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    const appName = stdout.trim();
    
    if (appName !== "not found") {
      console.log(`✅ Found Electron app: ${appName}`);
      return appName;
    } else {
      console.log('⚠️ Electron app window not found in foreground');
      return null;
    }
  } catch (error) {
    console.error('❌ Error finding Electron window:', error.message);
    return null;
  }
}

async function activateElectronApp(appName) {
  try {
    const script = `
      tell application "System Events"
        tell application process "${appName}"
          set frontmost to true
        end tell
      end tell
    `;
    
    await execAsync(`osascript -e '${script}'`);
    console.log(`✅ Activated ${appName}`);
    return true;
  } catch (error) {
    console.error('❌ Error activating app:', error.message);
    return false;
  }
}

async function checkElectronAppContents(appName) {
  try {
    // Get window information using AppleScript
    const script = `
      tell application "System Events"
        tell application process "${appName}"
          set windowCount to count of windows
          if windowCount > 0 then
            set windowTitle to title of front window
            return "Windows: " & windowCount & ", Title: " & windowTitle
          else
            return "No windows found"
          end if
        end tell
      end tell
    `;
    
    const { stdout } = await execAsync(`osascript -e '${script}'`);
    console.log(`🔍 App info: ${stdout.trim()}`);
    return stdout.trim();
  } catch (error) {
    console.error('❌ Error checking app contents:', error.message);
    return null;
  }
}

async function main() {
  try {
    // Step 1: Take initial screenshot
    console.log('\n📸 Taking initial screenshot...');
    await takeScreenshot('electron-initial.png');
    
    // Step 2: Find the Electron app
    console.log('\n🔍 Searching for Electron app...');
    let appName = await findElectronWindow();
    
    if (!appName) {
      // Try alternative search methods
      console.log('Trying alternative search...');
      try {
        const { stdout } = await execAsync('ps aux | grep -i electron | grep -v grep');
        console.log('Running Electron processes:');
        console.log(stdout);
        
        // Look for the app in running processes
        if (stdout.includes('universal-ai-tools')) {
          appName = 'Electron';
          console.log('✅ Found Universal AI Tools Electron process');
        }
      } catch (e) {
        console.log('❌ Could not find Electron process');
      }
    }
    
    if (appName) {
      // Step 3: Activate the app
      console.log(`\n🎯 Activating ${appName}...`);
      await activateElectronApp(appName);
      
      // Wait a moment for activation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 4: Check app contents
      console.log('\n🔍 Checking app window contents...');
      await checkElectronAppContents(appName);
      
      // Step 5: Take screenshot of active app
      console.log('\n📸 Taking screenshot of active app...');
      await takeScreenshot('electron-active.png');
      
      // Step 6: Try to interact with the app (if possible)
      console.log('\n🖱️ Attempting to interact with app...');
      
      // Try to take a focused screenshot using window capture
      try {
        const windowScript = `
          tell application "System Events"
            tell application process "${appName}"
              set frontmost to true
              delay 1
              key code 53 -- Escape key to ensure no dialogs
            end tell
          end tell
        `;
        await execAsync(`osascript -e '${windowScript}'`);
        
        // Take another screenshot after interaction
        await takeScreenshot('electron-after-interaction.png');
        
      } catch (error) {
        console.log('⚠️ Could not interact with app UI');
      }
      
      console.log('\n✅ Electron app automation test completed');
      
      // Show screenshot locations
      const screenshots = ['electron-initial.png', 'electron-active.png', 'electron-after-interaction.png'];
      screenshots.forEach(file => {
        if (existsSync(`/tmp/${file}`)) {
          console.log(`📁 Screenshot available: /tmp/${file}`);
        }
      });
      
    } else {
      console.log('❌ Could not find or interact with Electron app');
      console.log('💡 Make sure the Universal AI Tools Electron app is running and visible');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

main();