# Quick iOS App Setup - Universal AI Companion

## The Simplest Way to Get Started

### Step 1: Create a New iOS App in Xcode

1. Open Xcode
2. Click "Create New Project" 
3. Choose "App" under iOS
4. Configure:
   - Product Name: `UniversalAICompanion`
   - Team: Select your Apple ID
   - Interface: SwiftUI
   - Language: Swift
   - Click "Next" and save it anywhere

### Step 2: Replace ContentView.swift

In Xcode, double-click on `ContentView.swift` and replace ALL the code with this:

```swift
import SwiftUI

struct ContentView: View {
    @State private var serverStatus = "Not Connected"
    @State private var testResult = ""
    
    var body: some View {
        VStack(spacing: 30) {
            Text("AI Companion")
                .font(.largeTitle)
                .bold()
            
            Text(serverStatus)
                .foregroundColor(serverStatus == "Connected" ? .green : .red)
            
            Button("Connect to Server") {
                testConnection()
            }
            .buttonStyle(.borderedProminent)
            
            if !testResult.isEmpty {
                Text(testResult)
                    .padding()
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(8)
            }
            
            Spacer()
        }
        .padding()
    }
    
    func testConnection() {
        // IMPORTANT: Replace with your Mac's IP address
        // Find it with: ifconfig | grep "inet " | grep -v 127.0.0.1
        let url = URL(string: "http://192.168.1.XXX:9999/api/v1/health")!
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            DispatchQueue.main.async {
                if error != nil {
                    serverStatus = "Connection Failed"
                    testResult = "Make sure:\n1. Server is running (npm run dev)\n2. IP address is correct\n3. Both devices on same WiFi"
                } else if let data = data,
                          let result = String(data: data, encoding: .utf8) {
                    serverStatus = "Connected"
                    testResult = "Server Response:\n\(result)"
                }
            }
        }.resume()
    }
}
```

### Step 3: Update Info.plist

1. In Xcode, click on your project name in the navigator
2. Select your app target
3. Go to "Info" tab
4. Add a new row (click + button)
5. Add: `App Transport Security Settings`
6. Under it, add: `Allow Arbitrary Loads` = YES

This allows connection to your local server.

### Step 4: Find Your Mac's IP Address

Open Terminal and run:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Look for something like: `inet 192.168.1.123`

### Step 5: Update the IP in the App

In ContentView.swift, replace `192.168.1.XXX` with your actual IP address.

### Step 6: Start Your Server

```bash
cd /Users/christianmerrill/Desktop/universal-ai-tools
npm run dev
```

Wait for "Server started on port 9999"

### Step 7: Run the App

1. Connect your iPhone via USB
2. Select your iPhone from the device dropdown (next to the app name)
3. Click the Run button (▶️) or press Cmd+R
4. Trust the developer on your iPhone if prompted:
   - Settings → General → VPN & Device Management → Developer App → Trust

### Step 8: Test It

1. Open the app on your iPhone
2. Tap "Connect to Server"
3. You should see the server response

## Troubleshooting

**"Connection Failed"**
- Make sure server is running
- Check IP address is correct
- Ensure iPhone and Mac are on same WiFi
- Try disabling firewall temporarily

**"Untrusted Developer"**
- On iPhone: Settings → General → VPN & Device Management
- Tap your developer account
- Tap "Trust"

**Can't select iPhone in Xcode**
- Make sure iPhone is unlocked
- Trust the computer when prompted
- Try different USB cable/port

## Next: Add Personality Features

Once basic connection works, we can add:
- Personality analysis API calls
- Biometric authentication
- Real-time WebSocket connection
- Device optimization display