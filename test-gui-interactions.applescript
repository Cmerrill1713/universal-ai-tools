#!/usr/bin/osascript

-- Test GUI interactions for Universal AI Tools

tell application "System Events"
    tell process "UniversalAITools"
        -- Find the command palette window
        set windowFound to false
        
        try
            set frontWindow to window 1
            set windowFound to true
            log "Found window: " & (name of frontWindow as string)
        on error
            log "No window found, trying popover..."
        end try
        
        -- Try to interact with the search field
        try
            -- Type in search field
            keystroke "spawn agent"
            delay 0.5
            
            -- Check for UI elements
            set allElements to entire contents of window 1
            repeat with element in allElements
                try
                    log "Element: " & (class of element as string) & " - " & (description of element as string)
                end try
            end repeat
            
        on error errMsg
            log "Error interacting with UI: " & errMsg
        end try
        
        -- Try clicking on a command
        try
            -- Look for "Spawn AI Agent" button
            set buttons to buttons of window 1
            repeat with btn in buttons
                try
                    if (title of btn as string) contains "Agent" then
                        log "Found agent button: " & (title of btn as string)
                        click btn
                        exit repeat
                    end if
                end try
            end repeat
        on error
            log "Could not find or click agent button"
        end try
    end tell
end tell

"GUI interaction test complete"