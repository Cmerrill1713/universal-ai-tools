#!/usr/bin/env python3
"""
Universal AI Tools - macOS Installer Package Creator
Creates a professional .pkg installer for easy distribution and installation
"""

import os
import shutil
import subprocess
import tempfile
import json
from pathlib import Path

class InstallerCreator:
    def __init__(self):
        self.project_root = Path("/Users/christianmerrill/Desktop/universal-ai-tools")
        self.app_bundle = Path("/Users/christianmerrill/Desktop/Universal AI Tools.app")
        self.installer_dir = self.project_root / "installer"
        self.temp_dir = None
        
    def create_installer(self):
        """Create complete installer package"""
        print("🚀 Universal AI Tools - Installer Package Creator")
        print("=" * 60)
        
        # Setup
        self.setup_directories()
        
        # Create installer components
        self.create_payload()
        self.create_scripts()
        self.create_distribution_xml()
        self.create_resources()
        
        # Build the installer
        self.build_package()
        
        print("\n🎉 Installer package created successfully!")
        print(f"📦 Location: {self.installer_dir / 'Universal AI Tools Installer.pkg'}")
        
    def setup_directories(self):
        """Setup installer directory structure"""
        print("\n📁 Setting up installer directories...")
        
        # Clean and recreate installer directory
        if self.installer_dir.exists():
            shutil.rmtree(self.installer_dir)
        self.installer_dir.mkdir(exist_ok=True)
        
        # Create subdirectories
        (self.installer_dir / "payload").mkdir()
        (self.installer_dir / "scripts").mkdir()
        (self.installer_dir / "resources").mkdir()
        (self.installer_dir / "build").mkdir()
        
        print("   ✅ Directory structure created")
        
    def create_payload(self):
        """Create installer payload with app bundle and dependencies"""
        print("\n📦 Creating installer payload...")
        
        payload_dir = self.installer_dir / "payload"
        applications_dir = payload_dir / "Applications"
        applications_dir.mkdir()
        
        # Copy app bundle
        if self.app_bundle.exists():
            shutil.copytree(self.app_bundle, applications_dir / "Universal AI Tools.app")
            print("   ✅ App bundle copied")
        else:
            raise FileNotFoundError("App bundle not found")
            
        # Create ~/Applications shortcut directory structure
        user_apps_dir = payload_dir / "Users" / "Shared" / "Universal AI Tools"
        user_apps_dir.mkdir(parents=True)
        
        # Copy service manager and desktop shortcuts
        if (self.project_root / "service-manager.sh").exists():
            shutil.copy2(self.project_root / "service-manager.sh", user_apps_dir)
            
        # Copy documentation and dashboard files
        docs_to_copy = [
            "supabase_dashboard.html",
            "docs/QUICK_REFERENCE.md",
            "docs/SETUP_GUIDE.md"
        ]
        
        for doc in docs_to_copy:
            src_path = self.project_root / doc
            if src_path.exists():
                if src_path.is_file():
                    shutil.copy2(src_path, user_apps_dir)
                else:
                    shutil.copytree(src_path, user_apps_dir / doc)
                    
        print("   ✅ Documentation and tools copied")
        
    def create_scripts(self):
        """Create pre/post installation scripts"""
        print("\n📝 Creating installation scripts...")
        
        # Pre-installation script
        preinstall_script = '''#!/bin/bash
# Universal AI Tools - Pre-installation Script

echo "🔧 Preparing system for Universal AI Tools installation..."

# Stop any running services
if pgrep -f "Universal AI Tools" > /dev/null; then
    echo "   • Stopping existing Universal AI Tools service..."
    pkill -f "Universal AI Tools"
fi

# Remove old LaunchAgent if exists
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.universal.ai-tools.plist"
if [ -f "$LAUNCH_AGENT" ]; then
    echo "   • Removing existing LaunchAgent..."
    launchctl unload "$LAUNCH_AGENT" 2>/dev/null || true
    rm -f "$LAUNCH_AGENT"
fi

echo "   ✅ System prepared"
exit 0
'''

        # Post-installation script
        postinstall_script = '''#!/bin/bash
# Universal AI Tools - Post-installation Script

echo "🚀 Configuring Universal AI Tools..."

# Set up LaunchAgent for auto-start
LAUNCH_AGENT="$HOME/Library/LaunchAgents/com.universal.ai-tools.plist"
LAUNCH_AGENT_DIR="$(dirname "$LAUNCH_AGENT")"

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENT_DIR"

# Create LaunchAgent plist
cat > "$LAUNCH_AGENT" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.universal.ai-tools</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/Universal AI Tools.app/Contents/MacOS/Universal AI Tools</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/universal-ai-tools.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/universal-ai-tools-error.log</string>
    <key>WorkingDirectory</key>
    <string>/Applications/Universal AI Tools.app/Contents/Resources</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
EOF

echo "   ✅ LaunchAgent created"

# Set correct permissions
chmod 644 "$LAUNCH_AGENT"
chmod +x "/Applications/Universal AI Tools.app/Contents/MacOS/Universal AI Tools"

# Create desktop shortcuts
DESKTOP="$HOME/Desktop"
if [ -d "$DESKTOP" ]; then
    # Universal AI Tools Manager shortcut
    cat > "$DESKTOP/Universal AI Tools Manager.command" << 'EOF'
#!/bin/bash
cd "/Users/Shared/Universal AI Tools"
./service-manager.sh menu
EOF
    chmod +x "$DESKTOP/Universal AI Tools Manager.command"
    
    # Quick Start shortcut
    cat > "$DESKTOP/Start Universal AI Tools.command" << 'EOF'
#!/bin/bash
open "http://localhost:9999"
EOF
    chmod +x "$DESKTOP/Start Universal AI Tools.command"
    
    echo "   ✅ Desktop shortcuts created"
fi

# Load and start the service
launchctl load "$LAUNCH_AGENT"
sleep 2

# Verify service is running
if curl -f http://localhost:9999/health > /dev/null 2>&1; then
    echo "   ✅ Service started successfully"
    
    # Open welcome page
    sleep 1
    open "http://localhost:9999" > /dev/null 2>&1 || true
else
    echo "   ⚠️  Service may need manual start"
fi

echo ""
echo "🎉 Universal AI Tools installation complete!"
echo ""
echo "📋 Access Points:"
echo "   • Web Interface: http://localhost:9999"
echo "   • App: /Applications/Universal AI Tools.app"
echo "   • Manager: ~/Desktop/Universal AI Tools Manager.command"
echo ""
echo "📚 Documentation:"
echo "   • Quick Reference: /Users/Shared/Universal AI Tools/"
echo "   • Dashboard: Open supabase_dashboard.html"

exit 0
'''

        # Write scripts
        scripts_dir = self.installer_dir / "scripts"
        
        with open(scripts_dir / "preinstall", 'w') as f:
            f.write(preinstall_script)
        os.chmod(scripts_dir / "preinstall", 0o755)
        
        with open(scripts_dir / "postinstall", 'w') as f:
            f.write(postinstall_script)
        os.chmod(scripts_dir / "postinstall", 0o755)
        
        print("   ✅ Installation scripts created")
        
    def create_distribution_xml(self):
        """Create distribution XML for installer"""
        print("\n📄 Creating distribution configuration...")
        
        distribution_xml = '''<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">
    <title>Universal AI Tools</title>
    <organization>universal.ai.tools</organization>
    <domains enable_anywhere="true"/>
    <options customize="never" require-scripts="true" rootVolumeOnly="true"/>
    
    <!-- Welcome -->
    <welcome mime-type="text/html" file="welcome.html"/>
    
    <!-- License -->
    <license mime-type="text/html" file="license.html"/>
    
    <!-- Background -->
    <background file="background.png" mime-type="image/png" alignment="bottomleft"/>
    
    <!-- Installation choices -->
    <choices-outline>
        <line choice="default">
            <line choice="universal-ai-tools"/>
        </line>
    </choices-outline>
    
    <choice id="default"/>
    <choice id="universal-ai-tools" visible="false">
        <pkg-ref id="com.universal.ai-tools"/>
    </choice>
    
    <pkg-ref id="com.universal.ai-tools" version="1.0.0" onConclusion="none">universal-ai-tools.pkg</pkg-ref>
    
</installer-gui-script>'''
        
        with open(self.installer_dir / "distribution.xml", 'w') as f:
            f.write(distribution_xml)
            
        print("   ✅ Distribution XML created")
        
    def create_resources(self):
        """Create installer resources (welcome, license, background)"""
        print("\n🎨 Creating installer resources...")
        
        resources_dir = self.installer_dir / "resources"
        
        # Welcome HTML
        welcome_html = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to Universal AI Tools</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
        h1 { color: #2563eb; }
        .feature { margin: 10px 0; }
        .icon { color: #059669; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🚀 Welcome to Universal AI Tools</h1>
    <p>Universal AI Tools provides advanced AI memory and document processing capabilities with Supabase integration.</p>
    
    <h3>🎯 Key Features:</h3>
    <div class="feature"><span class="icon">✅</span> AI Memory System with Vector Search</div>
    <div class="feature"><span class="icon">✅</span> Local Supabase Integration</div>
    <div class="feature"><span class="icon">✅</span> RESTful API with Multiple Endpoints</div>
    <div class="feature"><span class="icon">✅</span> Web-based Dashboard Interface</div>
    <div class="feature"><span class="icon">✅</span> Automatic Service Management</div>
    <div class="feature"><span class="icon">✅</span> Production-ready Performance</div>
    
    <h3>📋 What will be installed:</h3>
    <ul>
        <li>Universal AI Tools.app in /Applications</li>
        <li>Service management tools</li>
        <li>Desktop shortcuts for easy access</li>
        <li>Auto-start configuration</li>
        <li>Documentation and quick reference</li>
    </ul>
    
    <p><strong>The service will start automatically after installation at:</strong><br>
    <a href="http://localhost:9999">http://localhost:9999</a></p>
</body>
</html>'''

        # License HTML
        license_html = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>License Agreement</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; }
        .license { background: #f5f5f5; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>Software License Agreement</h1>
    <div class="license">
        <h3>Universal AI Tools</h3>
        <p><strong>Copyright © 2024 Universal AI Tools</strong></p>
        
        <p>This software is provided "as is", without warranty of any kind, express or implied, 
        including but not limited to the warranties of merchantability, fitness for a particular 
        purpose and noninfringement.</p>
        
        <p>Permission is hereby granted to use this software for personal and commercial purposes, 
        subject to the following conditions:</p>
        
        <ul>
            <li>The software may be used on any number of devices</li>
            <li>Redistribution requires permission from the copyright holder</li>
            <li>Commercial use is permitted</li>
            <li>No warranty is provided</li>
        </ul>
        
        <p>By installing this software, you agree to these terms.</p>
    </div>
</body>
</html>'''

        # Write HTML files
        with open(resources_dir / "welcome.html", 'w') as f:
            f.write(welcome_html)
            
        with open(resources_dir / "license.html", 'w') as f:
            f.write(license_html)
            
        # Create simple background (placeholder - would normally be a PNG)
        with open(resources_dir / "background.png", 'w') as f:
            f.write("# Placeholder for background image")
            
        print("   ✅ Installer resources created")
        
    def build_package(self):
        """Build the final installer package"""
        print("\n🔨 Building installer package...")
        
        payload_dir = self.installer_dir / "payload"
        scripts_dir = self.installer_dir / "scripts"
        resources_dir = self.installer_dir / "resources"
        build_dir = self.installer_dir / "build"
        
        # Build component package
        component_pkg = build_dir / "universal-ai-tools.pkg"
        
        pkgbuild_cmd = [
            "pkgbuild",
            "--root", str(payload_dir),
            "--scripts", str(scripts_dir),
            "--identifier", "com.universal.ai-tools",
            "--version", "1.0.0",
            "--install-location", "/",
            str(component_pkg)
        ]
        
        try:
            subprocess.run(pkgbuild_cmd, check=True, capture_output=True, text=True)
            print("   ✅ Component package built")
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Component package build failed: {e.stderr}")
            return False
            
        # Build final installer
        final_installer = self.installer_dir / "Universal AI Tools Installer.pkg"
        
        productbuild_cmd = [
            "productbuild",
            "--distribution", str(self.installer_dir / "distribution.xml"),
            "--resources", str(resources_dir),
            "--package-path", str(build_dir),
            str(final_installer)
        ]
        
        try:
            subprocess.run(productbuild_cmd, check=True, capture_output=True, text=True)
            print("   ✅ Final installer package built")
            
            # Get package size
            size = final_installer.stat().st_size / (1024 * 1024)
            print(f"   📦 Package size: {size:.1f} MB")
            
            return True
        except subprocess.CalledProcessError as e:
            print(f"   ❌ Final installer build failed: {e.stderr}")
            return False

def main():
    creator = InstallerCreator()
    creator.create_installer()

if __name__ == "__main__":
    main()