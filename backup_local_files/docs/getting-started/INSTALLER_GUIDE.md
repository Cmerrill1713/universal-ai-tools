# Universal AI Tools - Installer Guide
## 📦 Professional Installer Package
The Universal AI Tools installer provides a seamless installation experience for end users on macOS systems.
### 🎯 What's Included
**Main Application:**

- Universal AI Tools.app in `/Applications`

- Complete app bundle with icon integration

- Production-ready server with all dependencies
**Service Management:**

- Automatic service startup via LaunchAgent

- Service manager tools in `/Users/Shared/Universal AI Tools`

- Desktop shortcuts for easy access
**Documentation:**

- Quick reference guides

- Supabase dashboard interface

- Setup instructions
### 🚀 Installation Process
**For End Users:**

1. Download `Universal AI Tools Installer.pkg`

2. Double-click to run the installer

3. Follow the installation wizard

4. Service starts automatically

5. Access at http://localhost:9999
**What Happens During Installation:**

1. **Pre-installation:** Stops any existing services

2. **Installation:** Copies app bundle and tools

3. **Post-installation:** 

   - Sets up LaunchAgent for auto-start

   - Creates desktop shortcuts

   - Starts the service

   - Opens welcome page
### 📋 Installation Components
```

/Applications/

└── Universal AI Tools.app/           # Main application

    ├── Contents/

    │   ├── Info.plist               # App bundle metadata

    │   ├── MacOS/

    │   │   └── Universal AI Tools   # Executable launcher

    │   └── Resources/

    │       ├── AppIcon.icns         # Application icon

    │       ├── dist/server.js       # Node.js server

    │       ├── package.json         # Dependencies

    │       └── public/              # Web interface
/Users/Shared/Universal AI Tools/     # Shared tools

├── service-manager.sh               # Service management

├── supabase_dashboard.html          # Dashboard interface

└── docs/                           # Documentation
~/Library/LaunchAgents/              # Auto-start

└── com.universal.ai-tools.plist     # Service configuration
~/Desktop/                           # User shortcuts

├── Universal AI Tools Manager.command

└── Start Universal AI Tools.command

```
### 🔧 Technical Details
**Package Structure:**

- **Size:** ~21.5 MB

- **Format:** macOS .pkg installer

- **Compatibility:** macOS 10.14+

- **Architecture:** Universal (Intel/Apple Silicon)
**Installation Scripts:**

- **Preinstall:** Cleans up existing installations

- **Postinstall:** Configures services and creates shortcuts
**Service Configuration:**

- **Port:** 9999 (configurable)

- **Auto-start:** Yes, via LaunchAgent

- **Logs:** `/tmp/universal-ai-tools.log`

- **Working Directory:** App bundle resources
### 🎯 Access Points After Installation
**Web Interface:**

- Primary: http://localhost:9999

- API Docs: http://localhost:9999/api/docs

- Health Check: http://localhost:9999/health
**Desktop Shortcuts:**

- `Universal AI Tools Manager.command` - Service management

- `Start Universal AI Tools.command` - Quick launch
**Application Bundle:**

- `/Applications/Universal AI Tools.app`

- Can be launched directly from Applications folder
### 🛠️ Service Management
**Using Desktop Shortcut:**

```bash
# Double-click: Universal AI Tools Manager.command

```
**Using Command Line:**

```bash

cd "/Users/Shared/Universal AI Tools"

./service-manager.sh status    # Check status

./service-manager.sh start     # Start service

./service-manager.sh stop      # Stop service

./service-manager.sh restart   # Restart service

```
**Using LaunchAgent:**

```bash

launchctl load ~/Library/LaunchAgents/com.universal.ai-tools.plist

launchctl unload ~/Library/LaunchAgents/com.universal.ai-tools.plist

```
### 🔍 Troubleshooting
**Service Won't Start:**

1. Check logs: `tail -f /tmp/universal-ai-tools.log`

2. Verify Node.js: `node --version`

3. Check port availability: `lsof -i :9999`

4. Restart LaunchAgent: `launchctl unload && launchctl load`
**Installation Issues:**

1. Ensure macOS 10.14+ compatibility

2. Check installer integrity

3. Run with admin privileges if needed

4. Clear previous installations
**Permission Problems:**

1. Check app bundle permissions: `ls -la /Applications/Universal\ AI\ Tools.app/`

2. Verify executable: `chmod +x /Applications/Universal\ AI\ Tools.app/Contents/MacOS/Universal\ AI\ Tools`

3. Check LaunchAgent permissions
### 📊 System Requirements
**Minimum Requirements:**

- macOS 10.14 (Mojave) or later

- 100 MB free disk space

- Node.js 16+ (included in app bundle)

- Network access for Supabase integration
**Recommended:**

- macOS 12.0+ for best performance

- 8 GB RAM for optimal memory operations

- SSD storage for faster database operations
### 🚀 Distribution
**For Developers:**

```bash
# Create installer

python3 create_installer.py

# Test installer

python3 test_installer.py

# Distribute
# Upload Universal AI Tools Installer.pkg

```
**For End Users:**

1. Download installer from official source

2. Double-click to install

3. Follow installation wizard

4. Service starts automatically
---
*The installer package provides a professional, user-friendly installation experience that handles all configuration automatically.*