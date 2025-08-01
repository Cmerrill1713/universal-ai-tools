#!/usr/bin/osascript

# Universal AI Tools - Complete Recording and Demo Script
# This handles QuickTime recording and browser navigation

on run
    display dialog "Universal AI Tools - Automated Demo Recording" & return & return & "This will:" & return & "1. Start QuickTime screen recording" & return & "2. Navigate through the UI automatically" & return & "3. Create a professional demo video" & return & return & "Click OK to start!" buttons {"Cancel", "Start Demo"} default button "Start Demo"
    
    if button returned of result is "Start Demo" then
        -- Start QuickTime recording
        tell application "QuickTime Player"
            activate
            new screen recording
            delay 2
            tell application "System Events"
                tell process "QuickTime Player"
                    click button 1 of window "Screen Recording"
                end tell
            end tell
        end tell
        
        delay 3
        
        -- Open Chrome with the app
        tell application "Google Chrome"
            activate
            make new window
            set bounds of window 1 to {0, 0, 1920, 1080}
            set URL of active tab of window 1 to "http://localhost:3000"
        end tell
        
        delay 5
        
        -- Navigate through the UI
        tell application "Google Chrome"
            -- Chat page
            set URL of active tab of window 1 to "http://localhost:3000/chat"
            delay 5
            
            -- Dashboard
            set URL of active tab of window 1 to "http://localhost:3000/dashboard"
            delay 5
            
            -- Projects
            set URL of active tab of window 1 to "http://localhost:3000/projects"
            delay 4
            
            -- Agents
            set URL of active tab of window 1 to "http://localhost:3000/agents"
            delay 4
            
            -- API Docs
            set URL of active tab of window 1 to "http://localhost:3000/api-docs"
            delay 4
            
            -- Back to Dashboard
            set URL of active tab of window 1 to "http://localhost:3000/dashboard"
            delay 3
        end tell
        
        -- Show completion dialog
        display dialog "Demo recording complete!" & return & return & "To finish:" & return & "1. Click QuickTime Player" & return & "2. Press Stop button (or Cmd+Ctrl+Esc)" & return & "3. Save your video" buttons {"OK"} default button "OK"
        
        -- Bring QuickTime to front
        tell application "QuickTime Player" to activate
    end if
end run