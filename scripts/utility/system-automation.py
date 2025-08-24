#!/usr/bin/env python3
"""
System Automation Assistant
Can interact with macOS applications and execute real-world tasks
"""

import subprocess
import json
import os
import sys
from datetime import datetime, timedelta
import re
from typing import Dict, Any, List, Optional

class SystemAutomation:
    def __init__(self):
        self.supported_apps = ['Calendar', 'Reminders', 'Notes', 'Mail', 'Messages']
        
    def parse_natural_language(self, command: str) -> Dict[str, Any]:
        """Parse natural language commands into structured actions"""
        command_lower = command.lower()
        
        # Calendar patterns
        if any(word in command_lower for word in ['calendar', 'schedule', 'meeting', 'appointment', 'event']):
            return self.parse_calendar_command(command)
        
        # Todo/Reminders patterns
        elif any(word in command_lower for word in ['todo', 'task', 'reminder', 'remind']):
            return self.parse_reminder_command(command)
        
        # Notes patterns
        elif any(word in command_lower for word in ['note', 'write down', 'document']):
            return self.parse_note_command(command)
        
        # System actions
        elif any(word in command_lower for word in ['open', 'launch', 'start']):
            return self.parse_app_command(command)
        
        return {"action": "unknown", "command": command}
    
    def parse_calendar_command(self, command: str) -> Dict[str, Any]:
        """Parse calendar-related commands"""
        # Extract time information
        time_match = re.search(r'(\d{1,2})(:\d{2})?\s*(am|pm)?', command.lower())
        date_match = re.search(r'(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)', command.lower())
        
        # Default to today at 4pm if mentioned in command
        if '4' in command and 'yard' in command.lower():
            hour = 16  # 4 PM
        elif time_match:
            hour = int(time_match.group(1))
            if time_match.group(3) == 'pm' and hour < 12:
                hour += 12
            elif time_match.group(3) == 'am' and hour == 12:
                hour = 0
        else:
            hour = 9  # Default to 9 AM
        
        # Determine date
        if date_match:
            date_str = date_match.group(1)
            if date_str == 'today':
                event_date = datetime.now()
            elif date_str == 'tomorrow':
                event_date = datetime.now() + timedelta(days=1)
            else:
                # Find next occurrence of the weekday
                days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
                target_day = days.index(date_str)
                today = datetime.now()
                days_ahead = target_day - today.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                event_date = today + timedelta(days=days_ahead)
        else:
            event_date = datetime.now()  # Default to today
        
        # Extract title - remove command words and time/date references
        title = command
        
        # Remove time patterns first
        title = re.sub(r'\bat\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b', '', title, flags=re.IGNORECASE)
        title = re.sub(r'\b\d{1,2}(:\d{2})?\s*(am|pm)\b', '', title, flags=re.IGNORECASE)
        
        # Remove command words
        command_words = ['add', 'create', 'schedule', 'to calendar', 'to my calendar', 
                        'for today', 'for tomorrow', 'today', 'tomorrow', 'at']
        for word in command_words:
            title = re.sub(r'\b' + word + r'\b', '', title, flags=re.IGNORECASE)
        
        # Clean up extra spaces
        title = ' '.join(title.split()).strip()
        
        return {
            "action": "create_calendar_event",
            "title": title or "New Event",
            "date": event_date.strftime("%Y-%m-%d"),
            "time": f"{hour:02d}:00",
            "duration": 60  # Default 1 hour
        }
    
    def parse_reminder_command(self, command: str) -> Dict[str, Any]:
        """Parse reminder/todo commands"""
        # Remove command words
        task = command
        command_words = ['add', 'create', 'todo', 'task', 'reminder', 'remind me to', 'to']
        for word in command_words:
            task = re.sub(r'\b' + word + r'\b', '', task, flags=re.IGNORECASE)
        task = ' '.join(task.split()).strip()
        
        return {
            "action": "create_reminder",
            "task": task or "New Task",
            "list": "Tasks"
        }
    
    def parse_note_command(self, command: str) -> Dict[str, Any]:
        """Parse note commands"""
        content = command
        for remove in ['create note', 'add note', 'write down', 'note']:
            content = content.replace(remove, '')
        content = ' '.join(content.split()).strip()
        
        return {
            "action": "create_note",
            "content": content or "New Note",
            "title": f"Note - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        }
    
    def parse_app_command(self, command: str) -> Dict[str, Any]:
        """Parse app launch commands"""
        # Extract app name
        words = command.split()
        if 'open' in words:
            idx = words.index('open')
            if idx + 1 < len(words):
                app_name = ' '.join(words[idx + 1:])
                return {
                    "action": "open_app",
                    "app": app_name
                }
        return {"action": "unknown", "command": command}
    
    def create_calendar_event(self, title: str, date: str, time: str, duration: int = 60) -> Dict[str, Any]:
        """Create a calendar event using simple, reliable AppleScript"""
        
        # Parse hour from time string (e.g., "14:00" -> 14)
        try:
            hour = int(time.split(':')[0])
        except:
            hour = 9  # Default to 9am
        
        # Format date for AppleScript (needs MM/DD/YYYY format)
        from datetime import datetime
        try:
            date_obj = datetime.strptime(date, "%Y-%m-%d")
            date_str = date_obj.strftime("%m/%d/%Y")
        except:
            date_str = datetime.now().strftime("%m/%d/%Y")
        
        # Create simple, reliable AppleScript
        applescript = f'''
        tell application "Calendar"
            tell calendar 1
                set eventStart to date "{date_str} {hour}:00"
                set eventEnd to eventStart + ({duration} * minutes)
                set newEvent to make new event at end with properties {{summary:"{title}", start date:eventStart, end date:eventEnd}}
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
                return {
                    "success": True,
                    "message": f"✅ Created calendar event: '{title}' on {date} at {time}",
                    "details": {
                        "title": title,
                        "date": date,
                        "time": time,
                        "duration": duration
                    }
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create event: {result.stderr}"
                }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Operation timed out"}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def create_reminder(self, task: str, list_name: str = "Tasks") -> Dict[str, Any]:
        """Create a reminder using AppleScript"""
        
        applescript = f'''
        tell application "Reminders"
            activate
            tell list "{list_name}"
                make new reminder with properties {{name:"{task}", body:""}}
            end tell
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
                return {
                    "success": True,
                    "message": f"✅ Created reminder: '{task}' in list '{list_name}'"
                }
            else:
                # Try creating in default list
                applescript_default = f'''
                tell application "Reminders"
                    activate
                    make new reminder with properties {{name:"{task}", body:""}}
                end tell
                '''
                
                result = subprocess.run(
                    ['osascript', '-e', applescript_default],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                
                if result.returncode == 0:
                    return {
                        "success": True,
                        "message": f"✅ Created reminder: '{task}'"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to create reminder: {result.stderr}"
                    }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def create_note(self, content: str, title: str = None) -> Dict[str, Any]:
        """Create a note using AppleScript"""
        
        if not title:
            title = f"Note - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        applescript = f'''
        tell application "Notes"
            activate
            make new note with properties {{name:"{title}", body:"{content}"}}
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
                return {
                    "success": True,
                    "message": f"✅ Created note: '{title}'"
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create note: {result.stderr}"
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def open_app(self, app_name: str) -> Dict[str, Any]:
        """Open an application"""
        
        try:
            result = subprocess.run(
                ['open', '-a', app_name],
                capture_output=True,
                text=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return {
                    "success": True,
                    "message": f"✅ Opened {app_name}"
                }
            else:
                return {
                    "success": False,
                    "error": f"Could not open {app_name}: {result.stderr}"
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def execute_command(self, command: str) -> Dict[str, Any]:
        """Main execution method"""
        
        # Parse the command
        parsed = self.parse_natural_language(command)
        
        # Execute based on action type
        if parsed["action"] == "create_calendar_event":
            return self.create_calendar_event(
                parsed["title"],
                parsed["date"],
                parsed["time"],
                parsed.get("duration", 60)
            )
        
        elif parsed["action"] == "create_reminder":
            return self.create_reminder(
                parsed["task"],
                parsed.get("list", "Tasks")
            )
        
        elif parsed["action"] == "create_note":
            return self.create_note(
                parsed["content"],
                parsed.get("title")
            )
        
        elif parsed["action"] == "open_app":
            return self.open_app(parsed["app"])
        
        else:
            return {
                "success": False,
                "error": f"Could not understand command: {command}",
                "parsed": parsed
            }


def main():
    automation = SystemAutomation()
    
    if len(sys.argv) > 1:
        # Command line mode
        command = ' '.join(sys.argv[1:])
        result = automation.execute_command(command)
        
        if result["success"]:
            print(result["message"])
            if "details" in result:
                print(json.dumps(result["details"], indent=2))
        else:
            print(f"❌ Error: {result.get('error', 'Unknown error')}")
    else:
        # Interactive mode
        print("🤖 System Automation Assistant")
        print("================================")
        print("Examples:")
        print('  "Add yard work to calendar for 4pm today"')
        print('  "Create reminder to buy groceries"')
        print('  "Open Safari"')
        print('  "Create note about project ideas"')
        print("Type 'exit' to quit")
        print("")
        
        while True:
            command = input("Command: ")
            
            if command.lower() in ['exit', 'quit']:
                print("Goodbye!")
                break
            
            result = automation.execute_command(command)
            
            if result["success"]:
                print(result["message"])
                if "details" in result:
                    print(json.dumps(result["details"], indent=2))
            else:
                print(f"❌ Error: {result.get('error', 'Unknown error')}")
            print("")


if __name__ == "__main__":
    main()