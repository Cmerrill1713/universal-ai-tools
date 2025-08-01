# TestFlight Deployment Guide

## Prerequisites
- Apple Developer Account ($99/year)
- App Store Connect access

## Steps:

### 1. Configure for Release
```bash
# In Xcode:
1. Select your project in navigator
2. Select the app target
3. Go to "Signing & Capabilities"
4. Select your team
5. Let Xcode manage signing automatically
```

### 2. Archive the App
```
1. Select "Any iOS Device" as target
2. Product → Archive
3. Wait for build to complete
4. Organizer window will open
```

### 3. Upload to App Store Connect
```
1. In Organizer, click "Distribute App"
2. Select "App Store Connect"
3. Choose "Upload"
4. Follow the wizard
```

### 4. Configure TestFlight
```
1. Go to https://appstoreconnect.apple.com
2. Select your app
3. Go to TestFlight tab
4. Add internal testers (your email)
5. Submit for review (automatic for internal testing)
```

### 5. Install via TestFlight
```
1. Download TestFlight from App Store on iPhone
2. Accept the email invitation
3. Install the app through TestFlight
```