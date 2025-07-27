#!/usr/bin/env python3
"""
Universal AI Tools Menu Bar App
Provides system tray integration for easy access
"""

import subprocess
import threading
import time

import requests
import rumps


class UniversalAIToolsApp(rumps.App):
    def __init__(self):
        super().__init__("🤖", quit_button=None)
        self.service_url = "http://localhost:9999"
        self.supabase_url = "http://localhost:54321"
        self.status_timer = rumps.Timer(self.check_status, 30)  # Check every 30 seconds
        self.status_timer.start()

        # Initial status check
        self.check_status(None)

    def check_status(self, sender):
        """Check service status and update menu"""
        try:
            # Check main service
            response = requests.get(f"{self.service_url}/health", timeout=2)
            service_running = response.status_code == 200
        except:
            service_running = False

        try:
            # Check Supabase
            response = requests.get(f"{self.supabase_url}/health", timeout=2)
            supabase_running = response.status_code == 200
        except:
            supabase_running = False

        # Update icon based on status
        if service_running and supabase_running:
            self.title = "🟢"
        elif service_running or supabase_running:
            self.title = "🟡"
        else:
            self.title = "🔴"

        # Update menu
        self.menu.clear()

        # Status items
        if service_running:
            self.menu.add(rumps.MenuItem("✅ Service: Running", callback=None))
        else:
            self.menu.add(rumps.MenuItem("❌ Service: Stopped", callback=None))

        if supabase_running:
            self.menu.add(rumps.MenuItem("✅ Supabase: Running", callback=None))
        else:
            self.menu.add(rumps.MenuItem("❌ Supabase: Stopped", callback=None))

        self.menu.add(rumps.separator)

        # Action items
        if service_running:
            self.menu.add(rumps.MenuItem("🌐 Open Interface", callback=self.open_interface))
            self.menu.add(rumps.MenuItem("📊 Open Dashboard", callback=self.open_dashboard))
            self.menu.add(rumps.MenuItem("🛑 Stop Service", callback=self.stop_service))
        else:
            self.menu.add(rumps.MenuItem("🚀 Start Service", callback=self.start_service))

        self.menu.add(rumps.separator)
        self.menu.add(rumps.MenuItem("📋 Show Logs", callback=self.show_logs))
        self.menu.add(rumps.MenuItem("🔄 Restart", callback=self.restart_service))
        self.menu.add(rumps.separator)
        self.menu.add(rumps.MenuItem("❌ Quit", callback=rumps.quit_application))

    def run_command(self, command):
        """Run service manager command"""
        try:
            subprocess.run(
                ["/Users/christianmerrill/Desktop/universal-ai-tools/service-manager.sh", command],
                check=True,
                capture_output=True,
            )
            return True
        except subprocess.CalledProcessError:
            return False

    def start_service(self, sender):
        """Start the service"""
        threading.Thread(target=lambda: self.run_command("start")).start()
        time.sleep(1)
        self.check_status(None)

    def stop_service(self, sender):
        """Stop the service"""
        threading.Thread(target=lambda: self.run_command("stop")).start()
        time.sleep(1)
        self.check_status(None)

    def restart_service(self, sender):
        """Restart the service"""
        threading.Thread(target=lambda: self.run_command("restart")).start()
        time.sleep(2)
        self.check_status(None)

    def open_interface(self, sender):
        """Open the web interface"""
        subprocess.run(["open", self.service_url])

    def open_dashboard(self, sender):
        """Open the Supabase dashboard"""
        subprocess.run(
            [
                "open",
                "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/supabase_dashboard.html",
            ]
        )

    def show_logs(self, sender):
        """Show service logs in Terminal"""
        subprocess.run(
            [
                "open",
                "-a",
                "Terminal",
                "/Users/christianmerrill/Desktop/universal-ai-tools/service-manager.sh",
                "logs",
            ]
        )


if __name__ == "__main__":
    try:
        app = UniversalAIToolsApp()
        app.run()
    except ImportError:
        print("rumps not installed. Install with: pip3 install rumps")
        print("Alternatively, use the command line service manager.")
