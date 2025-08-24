#!/usr/bin/env python3
"""
Delete calendar events for today and tomorrow
"""

import subprocess
from datetime import datetime, timedelta

def delete_events_for_date(date_str):
    """Delete all events for a specific date"""
    
    applescript = f'''
    tell application "Calendar"
        set targetDate to date "{date_str}"
        set endOfDay to targetDate + (1 * days) - 1
        
        repeat with cal in calendars
            set eventsToDelete to (every event of cal whose start date ≥ targetDate and start date ≤ endOfDay)
            repeat with evt in eventsToDelete
                delete evt
            end repeat
        end repeat
        
        return "Deleted events for " & (targetDate as string)
    end tell
    '''
    
    try:
        result = subprocess.run(
            ['osascript', '-e', applescript],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            print(f"✅ Deleted events for {date_str}")
            return True
        else:
            print(f"❌ Error deleting events: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def main():
    print("🗑️ Deleting calendar events for today and tomorrow...")
    print("")
    
    # Get today and tomorrow dates
    today = datetime.now()
    tomorrow = today + timedelta(days=1)
    
    # Format dates for AppleScript
    today_str = today.strftime("%m/%d/%Y")
    tomorrow_str = tomorrow.strftime("%m/%d/%Y")
    
    print(f"Today: {today_str}")
    print(f"Tomorrow: {tomorrow_str}")
    print("")
    
    # Delete events
    delete_events_for_date(today_str)
    delete_events_for_date(tomorrow_str)
    
    print("")
    print("✅ Cleanup complete!")

if __name__ == "__main__":
    main()