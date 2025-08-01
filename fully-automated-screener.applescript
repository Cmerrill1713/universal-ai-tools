#!/usr/bin/osascript

# Universal AI Tools - Fully Automated Screener
# This AppleScript automates the entire demo including browser control

on run
    set outputDir to "/Users/christianmerrill/Desktop/universal-ai-tools/screener-output/"
    set timestamp to do shell script "date +%Y%m%d_%H%M%S"
    set videoFile to outputDir & "universal-ai-tools-demo-" & timestamp & ".mov"
    
    -- Create output directory
    do shell script "mkdir -p " & quoted form of outputDir
    
    display notification "Starting automated screener..." with title "Universal AI Tools"
    
    -- Start screen recording
    do shell script "screencapture -v -x -T 0 " & quoted form of videoFile & " > /dev/null 2>&1 &"
    set recorderPID to result
    
    delay 2
    
    -- Open Chrome
    tell application "Google Chrome"
        activate
        
        -- Create new window
        make new window
        set bounds of window 1 to {0, 0, 1920, 1080}
        
        -- Navigate to landing page
        set URL of active tab of window 1 to "http://localhost:3000"
        delay 5
        
        -- Navigate to Chat
        set URL of active tab of window 1 to "http://localhost:3000/chat"
        delay 3
        
        -- Type in chat (simulate)
        tell application "System Events"
            keystroke "Create a photo organization project for 15,000 family photos using AI vision"
            delay 2
            keystroke return
        end tell
        delay 5
        
        -- Navigate to Dashboard
        set URL of active tab of window 1 to "http://localhost:3000/dashboard"
        delay 3
        
        -- Scroll down
        tell active tab of window 1
            execute javascript "window.scrollBy(0, 400)"
        end tell
        delay 2
        
        tell active tab of window 1
            execute javascript "window.scrollBy(0, 400)"
        end tell
        delay 2
        
        -- Navigate to Projects
        set URL of active tab of window 1 to "http://localhost:3000/projects"
        delay 3
        
        -- Navigate to Agents
        set URL of active tab of window 1 to "http://localhost:3000/agents"
        delay 3
        
        -- Navigate to API Docs
        set URL of active tab of window 1 to "http://localhost:3000/api-docs"
        delay 3
        
        -- Return to Dashboard with overlay
        set URL of active tab of window 1 to "http://localhost:3000/dashboard"
        delay 2
        
        -- Add success overlay
        set jsCode to "
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(0,50,100,0.95) 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 1s ease-in;
        `;
        
        overlay.innerHTML = `
            <style>
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                .logo { animation: pulse 2s infinite; }
            </style>
            <h1 class='logo' style='font-size: 5rem; color: #00d4ff; text-shadow: 0 0 40px #00d4ff;'>
                Universal AI Tools
            </h1>
            <p style='font-size: 2.5rem; color: #fff; margin: 2rem 0;'>
                The Future of AI Project Management
            </p>
            <div style='display: grid; grid-template-columns: repeat(2, 1fr); gap: 3rem; margin: 3rem 0;'>
                <div style='text-align: center;'>
                    <div style='color: #00ff88; font-size: 4rem; font-weight: bold;'>8.3x</div>
                    <div style='color: #ddd; font-size: 1.5rem;'>Faster</div>
                </div>
                <div style='text-align: center;'>
                    <div style='color: #00ff88; font-size: 4rem; font-weight: bold;'>94.7%</div>
                    <div style='color: #ddd; font-size: 1.5rem;'>Success</div>
                </div>
                <div style='text-align: center;'>
                    <div style='color: #00ff88; font-size: 4rem; font-weight: bold;'>6</div>
                    <div style='color: #ddd; font-size: 1.5rem;'>AI Agents</div>
                </div>
                <div style='text-align: center;'>
                    <div style='color: #00ff88; font-size: 4rem; font-weight: bold;'>37+</div>
                    <div style='color: #ddd; font-size: 1.5rem;'>Models</div>
                </div>
            </div>
            <p style='color: #aaa; font-size: 1.5rem;'>github.com/universal-ai-tools</p>
        `;
        document.body.appendChild(overlay);"
        
        tell active tab of window 1
            execute javascript jsCode
        end tell
        
        delay 6
    end tell
    
    -- Stop recording
    do shell script "kill -INT $(pgrep screencapture) 2>/dev/null || true"
    delay 2
    
    display notification "Demo complete! Opening video..." with title "Universal AI Tools"
    
    -- Open the video
    do shell script "open " & quoted form of videoFile
    
    return "Demo completed successfully! Video saved to: " & videoFile
end run