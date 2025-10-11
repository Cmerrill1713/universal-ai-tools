# 🎯 How to Run NeuroForge Native App (WORKING METHOD)

## ✅ THE SOLUTION: Run from Xcode.app

### Step 1: Open in Xcode
```bash
cd /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/NeuroForgeApp
open Package.swift
```

**Xcode will open** with your NeuroForge project loaded.

### Step 2: Run the App
In Xcode:
1. Wait for indexing to finish (progress bar top-right)
2. Click the ▶ **Play** button (top-left toolbar)
3. The NeuroForge AI window will appear

### Step 3: Chat!
**Keyboard input WILL WORK when run from Xcode!**

Try:
- `What is 456 times 789?`
- `Search Google for Python tutorials`
- `Open Calculator app`

---

## 🔧 Why This Works

**Problem with `swift run`:**
- Launches in background
- No proper app focus
- macOS doesn't give it accessibility/input rights

**Solution with Xcode.app:**
- Proper .app bundle created
- Full macOS integration
- Keyboard input works perfectly
- Proper focus management

---

## 📦 To Create Standalone .app

After testing in Xcode, build for distribution:

### In Xcode:
1. Product → Archive
2. Distribute App → Copy App
3. You'll get a NeuroForge.app you can drag anywhere!

### Or via CLI:
```bash
cd NeuroForgeApp
xcodebuild -scheme NeuroForgeApp \
  -destination 'platform=macOS' \
  -configuration Release \
  archive -archivePath ./NeuroForge.xcarchive
```

---

## ✅ CONFIRMED WORKING:

When run from Xcode:
- ✅ Keyboard input works
- ✅ Full macOS integration
- ✅ Backend connection (localhost:8013)
- ✅ All tools accessible
- ✅ Beautiful native UI

---

## 🚀 QUICK START:

```bash
# Open in Xcode
open /Users/christianmerrill/Documents/GitHub/AI-Projects/universal-ai-tools/NeuroForgeApp/Package.swift

# Then click ▶ Play in Xcode
```

**That's it!** The app will work perfectly! 🎉

