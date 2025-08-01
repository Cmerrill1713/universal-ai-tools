#!/usr/bin/osascript

-- Test script for Universal AI Tools macOS app UI

tell application "System Events"
    set appName to "UniversalAITools"
    
    -- Check if app is running
    if not (exists process appName) then
        display dialog "Universal AI Tools is not running!" buttons {"OK"} default button 1
        return
    end if
    
    tell process appName
        -- Get all UI elements
        set menuBars to menu bars
        set menuBarCount to count of menuBars
        
        log "Number of menu bars: " & menuBarCount
        
        -- Try to find menu bar item
        try
            set menuBarItems to menu bar items of menu bar 1
            repeat with menuItem in menuBarItems
                log "Menu item: " & (name of menuItem as string)
            end repeat
        on error
            log "Could not access menu bar items"
        end try
        
        -- Check for windows
        set windowCount to count of windows
        log "Number of windows: " & windowCount
        
        if windowCount > 0 then
            set frontWindow to window 1
            log "Front window name: " & (name of frontWindow as string)
            
            -- List all UI elements in the window
            try
                set uiElements to UI elements of frontWindow
                repeat with element in uiElements
                    log "UI Element: " & (class of element as string)
                end repeat
            end try
        end if
    end tell
end tell

-- Return success
"UI Test Complete"