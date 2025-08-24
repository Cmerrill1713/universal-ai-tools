#!/usr/bin/env python3
"""
Delete specific test calendar events
"""

import subprocess

def delete_events_by_title(titles):
    """Delete events with specific titles"""
    
    for title in titles:
        applescript = f'''
        tell application "Calendar"
            repeat with cal in calendars
                try
                    delete (every event of cal whose summary contains "{title}")
                end try
            end repeat
        end tell
        '''
        
        try:
            result = subprocess.run(
                ['osascript', '-e', applescript],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                print(f"✅ Deleted events containing: {title}")
            else:
                print(f"⚠️ No events found with: {title}")
        except Exception as e:
            print(f"❌ Error deleting {title}: {str(e)}")

def main():
    print("🗑️ Deleting test calendar events...")
    print("")
    
    # List of test event titles to delete
    test_titles = [
        "add meeting to calendar",
        "add yard work to calendar", 
        "meeting to calendar",
        "dentist appointment",
        "lunch meeting",
        "team standup",
        "meeting"
    ]
    
    delete_events_by_title(test_titles)
    
    print("")
    print("✅ Cleanup complete!")
    print("📝 Note: Only deleted events with test titles listed above")

if __name__ == "__main__":
    main()