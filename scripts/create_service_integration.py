#!/usr/bin/env python3
"""
Create service integration for Universal AI Tools
Sets up LaunchAgent for auto-start and system integration
"""

import os


def create_launch_agent():
    """Create a LaunchAgent plist for auto-starting the service"""

    launch_agents_dir = os.path.expanduser("~/Library/LaunchAgents")
    plist_path = os.path.join(launch_agents_dir, "com.universal.ai-tools.plist")
    app_path = "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources"

    print("🔧 Creating LaunchAgent for Universal AI Tools...")

    # Ensure LaunchAgents directory exists
    os.makedirs(launch_agents_dir, exist_ok=True)

    # Create the plist content
    plist_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.universal.ai-tools</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>{app_path}/dist/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>{app_path}</string>
    <key>RunAtLoad</key>
    <false/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>/tmp/universal-ai-tools.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/universal-ai-tools-error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>AI_TOOLS_PORT</key>
        <string>9999</string>
        <key>PATH</key>
        <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
    </dict>
</dict>
</plist>
"""

    with open(plist_path, "w") as f:
        f.write(plist_content)

    print(f"   ✅ Created LaunchAgent: {plist_path}")

    return plist_path


def create_service_manager():
    """Create a service management script"""

    manager_path = "/Users/christianmerrill/Desktop/universal-ai-tools/service-manager.sh"
    app_path = "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources"

    manager_content = f"""#!/bin/bash
# Universal AI Tools Service Manager

PLIST_PATH="$HOME/Library/LaunchAgents/com.universal.ai-tools.plist"
APP_PATH="{app_path}"
SERVICE_URL="http://localhost:9999"
SUPABASE_URL="http://localhost:54321"

show_usage() {{
    echo "Universal AI Tools Service Manager"
    echo "================================="
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start      Start the service"
    echo "  stop       Stop the service"
    echo "  restart    Restart the service"
    echo "  status     Check service status"
    echo "  install    Install auto-start (login)"
    echo "  uninstall  Remove auto-start"
    echo "  logs       Show service logs"
    echo "  open       Open the web interface"
    echo "  dashboard  Open Supabase dashboard"
    echo ""
}}

check_dependencies() {{
    echo "🔍 Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found. Please install from https://nodejs.org"
        exit 1
    fi
    echo "   ✅ Node.js: $(node --version)"
    
    # Check if Supabase is running
    if ! curl -s "$SUPABASE_URL/health" &> /dev/null; then
        echo "⚠️  Supabase not running. Starting..."
        cd "$APP_PATH" && supabase start
        if [ $? -ne 0 ]; then
            echo "❌ Failed to start Supabase. Please run 'supabase start' manually"
            exit 1
        fi
    fi
    echo "   ✅ Supabase running"
    
    # Check if app files exist
    if [ ! -f "$APP_PATH/dist/server.js" ]; then
        echo "⚠️  Application not built. Building..."
        cd "$APP_PATH" && npm run build
        if [ $? -ne 0 ]; then
            echo "❌ Build failed"
            exit 1
        fi
    fi
    echo "   ✅ Application built"
}}

start_service() {{
    echo "🚀 Starting Universal AI Tools service..."
    check_dependencies
    
    cd "$APP_PATH"
    
    # Check if already running
    if curl -s "$SERVICE_URL/health" &> /dev/null; then
        echo "   ⚠️  Service already running at $SERVICE_URL"
        return 0
    fi
    
    # Start the service
    nohup node dist/server.js > /tmp/universal-ai-tools.log 2>&1 &
    echo $! > /tmp/universal-ai-tools.pid
    
    # Wait a moment and check if it started
    sleep 3
    if curl -s "$SERVICE_URL/health" &> /dev/null; then
        echo "   ✅ Service started successfully"
        echo "   🌐 Web interface: $SERVICE_URL"
        echo "   📊 Dashboard: Open supabase_dashboard.html"
    else
        echo "   ❌ Service failed to start. Check logs: tail -f /tmp/universal-ai-tools.log"
        exit 1
    fi
}}

stop_service() {{
    echo "🛑 Stopping Universal AI Tools service..."
    
    # Kill by PID file
    if [ -f /tmp/universal-ai-tools.pid ]; then
        PID=$(cat /tmp/universal-ai-tools.pid)
        if ps -p $PID > /dev/null; then
            kill $PID
            echo "   ✅ Service stopped (PID: $PID)"
        fi
        rm -f /tmp/universal-ai-tools.pid
    fi
    
    # Kill any remaining processes
    pkill -f "node.*server.js" 2>/dev/null || true
    echo "   ✅ Service stopped"
}}

service_status() {{
    echo "📊 Universal AI Tools Service Status"
    echo "===================================="
    
    # Check service
    if curl -s "$SERVICE_URL/health" &> /dev/null; then
        echo "🟢 Service: Running at $SERVICE_URL"
    else
        echo "🔴 Service: Not running"
    fi
    
    # Check Supabase
    if curl -s "$SUPABASE_URL/health" &> /dev/null; then
        echo "🟢 Supabase: Running at $SUPABASE_URL"
    else
        echo "🔴 Supabase: Not running"
    fi
    
    # Check LaunchAgent
    if [ -f "$PLIST_PATH" ]; then
        if launchctl list | grep -q "com.universal.ai-tools"; then
            echo "🟢 Auto-start: Enabled and loaded"
        else
            echo "🟡 Auto-start: Enabled but not loaded"
        fi
    else
        echo "🔴 Auto-start: Disabled"
    fi
    
    echo ""
    echo "💾 Disk Usage:"
    du -sh "$APP_PATH" 2>/dev/null | sed 's/^/   /'
    
    echo ""
    echo "📈 Memory Usage:"
    ps aux | grep -E "(node|supabase)" | grep -v grep | awk '{{print "   " $11 ": " $4"% CPU, " $6/1024"MB RAM"}}'
}}

install_autostart() {{
    echo "⚙️  Installing auto-start service..."
    
    if [ ! -f "$PLIST_PATH" ]; then
        echo "❌ LaunchAgent plist not found. Run create_service_integration.py first"
        exit 1
    fi
    
    # Load the service
    launchctl load "$PLIST_PATH"
    echo "   ✅ Auto-start enabled"
    echo "   ℹ️  Service will start automatically on login"
}}

uninstall_autostart() {{
    echo "🗑️  Uninstalling auto-start service..."
    
    if [ -f "$PLIST_PATH" ]; then
        launchctl unload "$PLIST_PATH" 2>/dev/null || true
        rm -f "$PLIST_PATH"
        echo "   ✅ Auto-start disabled and removed"
    else
        echo "   ⚠️  Auto-start was not installed"
    fi
}}

show_logs() {{
    echo "📋 Service Logs (press Ctrl+C to stop)"
    echo "======================================"
    
    if [ -f /tmp/universal-ai-tools.log ]; then
        tail -f /tmp/universal-ai-tools.log
    else
        echo "No logs found. Service may not be running."
    fi
}}

open_interface() {{
    echo "🌐 Opening Universal AI Tools interface..."
    open "$SERVICE_URL"
}}

open_dashboard() {{
    echo "📊 Opening Supabase dashboard..."
    open "$APP_PATH/supabase_dashboard.html"
}}

# Main command handling
case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service
        sleep 2
        start_service
        ;;
    status)
        service_status
        ;;
    install)
        install_autostart
        ;;
    uninstall)
        uninstall_autostart
        ;;
    logs)
        show_logs
        ;;
    open)
        open_interface
        ;;
    dashboard)
        open_dashboard
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
"""

    with open(manager_path, "w") as f:
        f.write(manager_content)

    # Make executable
    os.chmod(manager_path, 0o755)
    print(f"   ✅ Created service manager: {manager_path}")

    return manager_path


def create_menu_bar_app():
    """Create a simple menu bar application for system tray integration"""

    menu_app_path = "/Users/christianmerrill/Desktop/universal-ai-tools/menu-bar-app.py"

    menu_app_content = '''#!/usr/bin/env python3
"""
Universal AI Tools Menu Bar App
Provides system tray integration for easy access
"""

import rumps
import subprocess
import requests
import threading
import time

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
            subprocess.run(["/Users/christianmerrill/Desktop/universal-ai-tools/service-manager.sh", command], 
                         check=True, capture_output=True)
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
        subprocess.run(["open", "/Users/christianmerrill/Desktop/Universal AI Tools.app/Contents/Resources/supabase_dashboard.html"])
    
    def show_logs(self, sender):
        """Show service logs in Terminal"""
        subprocess.run(["open", "-a", "Terminal", "/Users/christianmerrill/Desktop/universal-ai-tools/service-manager.sh", "logs"])

if __name__ == "__main__":
    try:
        app = UniversalAIToolsApp()
        app.run()
    except ImportError:
        print("rumps not installed. Install with: pip3 install rumps")
        print("Alternatively, use the command line service manager.")
'''

    with open(menu_app_path, "w") as f:
        f.write(menu_app_content)

    os.chmod(menu_app_path, 0o755)
    print(f"   ✅ Created menu bar app: {menu_app_path}")

    return menu_app_path


def main():
    """Main service integration setup"""
    print("🔧 Setting up Universal AI Tools Service Integration")
    print("=" * 55)

    # Create LaunchAgent
    plist_path = create_launch_agent()

    # Create service manager
    manager_path = create_service_manager()

    # Create menu bar app
    menu_app_path = create_menu_bar_app()

    # Create desktop shortcuts
    print("\n📱 Creating desktop shortcuts...")

    # Service manager shortcut
    manager_shortcut = "/Users/christianmerrill/Desktop/Universal AI Tools Manager.command"
    with open(manager_shortcut, "w") as f:
        f.write(f'#!/bin/bash\n"{manager_path}" "$@"\n')
    os.chmod(manager_shortcut, 0o755)
    print("   ✅ Created: Universal AI Tools Manager.command")

    # Quick start shortcut
    quick_start = "/Users/christianmerrill/Desktop/Start Universal AI Tools.command"
    with open(quick_start, "w") as f:
        f.write(f'#!/bin/bash\n"{manager_path}" start\n')
    os.chmod(quick_start, 0o755)
    print("   ✅ Created: Start Universal AI Tools.command")

    print("\n🎉 Service integration complete!")
    print("\n📋 Available Commands:")
    print(f"   • Service Manager: {manager_path}")
    print(f"   • Menu Bar App: {menu_app_path} (requires: pip3 install rumps)")
    print("   • Desktop shortcuts created on Desktop")

    print("\n🚀 Quick Start:")
    print("   1. Run: ./service-manager.sh start")
    print("   2. Or double-click 'Start Universal AI Tools.command'")
    print("   3. Access at: http://localhost:9999")

    print("\n⚙️  Auto-start (optional):")
    print("   • Enable: ./service-manager.sh install")
    print("   • Disable: ./service-manager.sh uninstall")

    return True


if __name__ == "__main__":
    main()
