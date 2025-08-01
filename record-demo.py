#!/usr/bin/env python3

"""
Universal AI Tools - Automated Screen Recording Demo
Uses subprocess to control screen recording and browser automation
"""

import subprocess
import time
import os
import signal
import sys
from datetime import datetime

class ScreenRecorder:
    def __init__(self):
        self.recorder_process = None
        self.output_dir = "screener-output"
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.video_file = f"{self.output_dir}/universal-ai-tools-demo-{self.timestamp}.mov"
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
    
    def start_recording(self):
        """Start screen recording using screencapture"""
        print("🔴 Starting screen recording...")
        
        # Use screencapture with a fixed duration
        cmd = [
            'screencapture',
            '-v',  # Video mode
            '-x',  # No sounds
            '-T', '0',  # No countdown
            self.video_file
        ]
        
        self.recorder_process = subprocess.Popen(cmd)
        time.sleep(2)  # Give it time to start
        print("✅ Recording started!")
        
    def stop_recording(self):
        """Stop the screen recording"""
        if self.recorder_process:
            print("\n⏹️  Stopping recording...")
            # Send CTRL+C to screencapture
            self.recorder_process.send_signal(signal.SIGINT)
            time.sleep(2)
            print("✅ Recording stopped!")
    
    def navigate_ui(self):
        """Navigate through the UI using Chrome"""
        print("\n🌐 Opening Chrome and navigating UI...")
        
        # Open Chrome
        subprocess.run([
            'open', '-na', 'Google Chrome',
            '--args',
            '--new-window',
            '--window-size=1920,1080',
            '--window-position=0,0',
            'http://localhost:3000'
        ])
        
        time.sleep(5)  # Wait for initial load
        
        # Navigation sequence
        pages = [
            ("Chat", "http://localhost:3000/chat", 4),
            ("Dashboard", "http://localhost:3000/dashboard", 4),
            ("Projects", "http://localhost:3000/projects", 4),
            ("Agents", "http://localhost:3000/agents", 4),
            ("API Docs", "http://localhost:3000/api-docs", 4),
            ("Dashboard (Finale)", "http://localhost:3000/dashboard", 3)
        ]
        
        for name, url, delay in pages:
            print(f"📍 Navigating to {name}...")
            subprocess.run([
                'osascript', '-e',
                f'tell application "Google Chrome" to set URL of active tab of window 1 to "{url}"'
            ])
            time.sleep(delay)
        
        print("✅ Navigation complete!")
    
    def create_demo_video(self):
        """Main function to create the demo video"""
        print("🎥 UNIVERSAL AI TOOLS - AUTOMATED SCREEN RECORDING")
        print("━" * 50)
        print()
        
        try:
            # Start recording
            self.start_recording()
            
            # Navigate through UI
            self.navigate_ui()
            
            # Stop recording
            self.stop_recording()
            
            # Check if video was created
            time.sleep(2)
            if os.path.exists(self.video_file):
                print(f"\n✅ Video saved successfully!")
                print(f"📹 Location: {self.video_file}")
                print("\n🎬 Opening video...")
                subprocess.run(['open', self.video_file])
            else:
                print("\n❌ Video file not found.")
                
        except KeyboardInterrupt:
            print("\n\n⚠️  Recording interrupted by user")
            self.stop_recording()
        except Exception as e:
            print(f"\n❌ Error: {e}")
            self.stop_recording()

def main():
    # Alternative approach using QuickTime
    print("🎥 UNIVERSAL AI TOOLS - SCREEN RECORDING DEMO")
    print("━" * 50)
    print("\nThis will use QuickTime Player for recording.")
    print("The recording will start automatically.\n")
    
    input("Press ENTER to start...")
    
    # Start QuickTime recording
    apple_script = '''
    tell application "QuickTime Player"
        activate
        new screen recording
        delay 2
        tell application "System Events"
            tell process "QuickTime Player"
                key code 49 -- spacebar to start
            end tell
        end tell
    end tell
    '''
    
    subprocess.run(['osascript', '-e', apple_script])
    time.sleep(3)
    
    print("✅ Recording started with QuickTime!")
    print("\n🌐 Now navigating through the UI...\n")
    
    # Open Chrome
    subprocess.run([
        'open', '-na', 'Google Chrome',
        '--args',
        '--new-window',
        '--window-size=1920,1080',
        '--window-position=0,0',
        'http://localhost:3000'
    ])
    
    time.sleep(5)
    
    # Navigate through pages
    pages = [
        ("Landing Page", "http://localhost:3000", 4),
        ("Chat Interface", "http://localhost:3000/chat", 5),
        ("Dashboard", "http://localhost:3000/dashboard", 5),
        ("Projects", "http://localhost:3000/projects", 4),
        ("AI Agents", "http://localhost:3000/agents", 4),
        ("API Documentation", "http://localhost:3000/api-docs", 4),
        ("Dashboard (Finale)", "http://localhost:3000/dashboard", 4)
    ]
    
    for name, url, delay in pages:
        print(f"📍 Showing {name}...")
        subprocess.run([
            'osascript', '-e',
            f'tell application "Google Chrome" to set URL of active tab of window 1 to "{url}"'
        ])
        time.sleep(delay)
    
    print("\n✅ Demo complete!")
    print("\n⏹️  To stop recording:")
    print("   1. Click on QuickTime Player")
    print("   2. Click Stop in the menu bar or press Cmd+Ctrl+Esc")
    print("   3. Save the video")
    print("\n━" * 50)

if __name__ == "__main__":
    main()