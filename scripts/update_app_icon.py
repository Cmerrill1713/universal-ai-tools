#!/usr/bin/env python3
"""
Update the AI Setup Assistant app icon
"""

import os
import shutil
import subprocess


def update_app_icon():
    """Update the icon for AI Setup Assistant.app"""

    app_path = "/Users/christianmerrill/Desktop/AI Setup Assistant.app"
    icon_source = "AppIcon.icns"

    if not os.path.exists(app_path):
        print("❌ AI Setup Assistant.app not found on Desktop")
        return False

    if not os.path.exists(icon_source):
        print("❌ AppIcon.icns not found. Run create_simple_icon.py first")
        return False

    # Path to the app's icon
    app_icon_path = os.path.join(app_path, "Contents", "Resources", "AppIcon.icns")

    try:
        # Backup original icon if it exists
        if os.path.exists(app_icon_path):
            backup_path = app_icon_path + ".backup"
            if not os.path.exists(backup_path):
                shutil.copy2(app_icon_path, backup_path)
                print(f"✅ Backed up original icon to {backup_path}")

        # Copy new icon
        os.makedirs(os.path.dirname(app_icon_path), exist_ok=True)
        shutil.copy2(icon_source, app_icon_path)
        print(f"✅ Copied new icon to {app_icon_path}")

        # Update the app's Info.plist to ensure it uses our icon
        info_plist_path = os.path.join(app_path, "Contents", "Info.plist")
        if os.path.exists(info_plist_path):
            # Use plutil to set the icon
            subprocess.run(
                ["plutil", "-replace", "CFBundleIconFile", "-string", "AppIcon", info_plist_path],
                check=True,
            )
            print("✅ Updated Info.plist")

        # Touch the app to refresh Finder's cache
        subprocess.run(["touch", app_path], check=True)

        # Clear icon cache (may require restart)
        subprocess.run(
            ["rm", "-rf", os.path.expanduser("~/Library/Caches/com.apple.iconservices.store")],
            capture_output=True,
        )

        # Restart Finder to refresh icons
        print("🔄 Restarting Finder to refresh icons...")
        subprocess.run(["killall", "Finder"], check=True)

        print("\n✨ Icon update complete!")
        print("The AI Setup Assistant app should now have the new AI-themed icon.")
        print("\nIf the icon doesn't update immediately:")
        print("1. Try logging out and back in")
        print("2. Or restart your Mac")

        return True

    except Exception as e:
        print(f"❌ Error updating icon: {e}")
        return False


if __name__ == "__main__":
    update_app_icon()
