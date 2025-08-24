#!/usr/bin/env python3
"""
Simple, reliable calendar event creation
"""

import subprocess
import sys
from datetime import datetime, timedelta
import re

def create_simple_event(title, when="today at 9am"):
    """Create a calendar event with simple parsing"""
    
    # Clean the title - remove all command words
    clean_title = title
    remove_words = ['add', 'create', 'schedule', 'to calendar', 'to my calendar', 
                    'meeting', 'appointment', 'event', 'at', 'for', 'on']
    
    # Parse the when
    hour = 9
    date = datetime.now()
    
    # Check for time
    time_match = re.search(r'(\d{1,2})\s*(am|pm)', when.lower())
    if time_match:
        hour = int(time_match.group(1))
        if time_match.group(2) == 'pm' and hour < 12:
            hour += 12
    
    # Check for tomorrow
    if 'tomorrow' in when.lower():
        date = date + timedelta(days=1)
    
    # Format for AppleScript
    date_str = date.strftime("%m/%d/%Y")
    
    # Simple AppleScript that just creates one event with both start and end date
    applescript = f'''
    tell application "Calendar"
        tell calendar 1
            set eventStart to date "{date_str} {hour}:00"
            set eventEnd to eventStart + (60 * minutes)
            set newEvent to make new event at end with properties {{summary:"{clean_title}", start date:eventStart, end date:eventEnd}}
        end tell
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
            print(f"✅ Created event: {clean_title} on {date_str} at {hour}:00")
            return True
        else:
            print(f"❌ Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 simple-calendar.py 'meeting at 3pm tomorrow'")
        return
    
    command = ' '.join(sys.argv[1:])
    
    # Extract just the key words for the title
    words = command.lower().split()
    
    # Find the main noun (meeting, lunch, dentist, etc.)
    title_words = []
    skip_words = ['add', 'to', 'calendar', 'at', 'pm', 'am', 'tomorrow', 'today', 'create', 'schedule']
    
    for word in words:
        if word not in skip_words and not word.isdigit() and not re.match(r'\d+[ap]m', word):
            title_words.append(word)
    
    title = ' '.join(title_words) if title_words else "Event"
    
    # Get the time part
    when = command
    
    create_simple_event(title, when)

if __name__ == "__main__":
    main()