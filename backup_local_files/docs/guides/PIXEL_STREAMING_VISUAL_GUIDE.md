# 🎯 Visual Guide: Finding Pixel Streaming in UE5.6
## Step 1: Open Plugins Window

From the top menu bar:

```

Edit → Plugins

```

(NOT Editor Preferences, NOT Project Settings)
## Step 2: In the Plugins Window
### Left Side - Categories:

Look for these categories:

- Audio

- Built-in

- **Graphics** ← LOOK HERE!

- Input Devices

- Media

- etc.
### Step 3: Under Graphics Category

Click on **Graphics** and look for:

- ✅ **Pixel Streaming**

- ✅ **Pixel Streaming 2** (if available)
### Alternative: Use Search Box

At the top of Plugins window, there's a search box.

Type: **pixel**
You should see:

- Pixel Streaming

- Pixel Streaming 2 (possibly)
## What You Should See:

```

□ Pixel Streaming

  Graphics

  Stream rendered frames to web browsers over WebRTC

  

□ Pixel Streaming 2

  Graphics  

  Next generation pixel streaming

```
## If You Don't See It:

1. Make sure you clicked **Edit → Plugins** (not anything else)

2. Try searching for just "stream"

3. Check ALL categories, not just Graphics

4. It might not be installed with your UE5 version
## After Finding It:

1. Check the box ✅ to enable

2. Click "Restart Now" when prompted

3. After restart, look for "Pixel Streaming" in the toolbar
## Still Can't Find?

The plugin might need to be downloaded separately or your UE5 installation might not include it.