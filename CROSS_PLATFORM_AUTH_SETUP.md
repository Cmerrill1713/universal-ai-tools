# Cross-Platform Authentication Setup

## **Overview** 🌐

The Swift auth consolidation is designed to work on both **macOS** and **iOS**, but with different deployment approaches:

| Platform  | Deployment Method  | Service Manager   | Auth Bridge       |
| --------- | ------------------ | ----------------- | ----------------- |
| **macOS** | Go Service Manager | ✅ Integrated     | ✅ HTTP Bridge    |
| **iOS**   | Standalone App     | ❌ Not Applicable | ✅ Internal Start |

## **macOS Setup** 🖥️

### **Current Configuration** ✅

```go
// In main.go - Service Manager
sm.addService(&Service{
    Name:         "swift-auth",
    Type:         "swift",
    Port:         8016,
    Command:      []string{"open", "UniversalAICompanion.xcodeproj"},
    WorkingDir:   "swift-companion-app",
    Priority:     2,
    Required:     true,
    HealthCheck:  "http://localhost:8016/health",
})
```

### **How It Works**

1. **Service Manager** starts Xcode project
2. **Swift App** launches and starts AuthBridgeService
3. **API Gateway** routes auth requests to Swift auth
4. **Fallback** to Go auth if Swift auth unavailable

### **Testing macOS**

```bash
# Start the service manager
go run main.go

# Test auth routing
curl http://localhost:8080/api/auth/status
```

## **iOS Setup** 📱

### **Configuration** ✅

```swift
// In UniversalAICompanionApp.swift - iOS App
@main
struct UniversalAICompanionApp: App {
    @State private var authBridgeService = AuthBridgeService.shared

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear {
                    // Start auth bridge automatically
                    Task {
                        try await authBridgeService.startServer(port: 8016)
                    }
                }
        }
    }
}
```

### **How It Works**

1. **iOS App** launches normally
2. **AuthBridgeService** starts automatically on port 8016
3. **Local services** can connect to iOS auth bridge
4. **No service manager** needed (iOS limitation)

### **Testing iOS**

```bash
# On iOS device/simulator, the auth bridge starts automatically
# Test from another device on the same network:
curl http://[iOS_DEVICE_IP]:8016/health
```

## **Cross-Platform Architecture** 🏗️

### **Shared Components** ✅

- **AuthBridgeService**: Cross-platform HTTP bridge
- **AuthenticationService**: Native auth with Touch ID/Face ID
- **BiometricAuthService**: Platform-specific biometrics
- **KeychainService**: Secure credential storage

### **Platform Differences** 📋

| Component           | macOS             | iOS                 |
| ------------------- | ----------------- | ------------------- |
| **Service Manager** | ✅ Go-based       | ❌ Not applicable   |
| **HTTP Bridge**     | ✅ Port 8016      | ✅ Port 8016        |
| **Biometric Auth**  | ✅ Touch ID       | ✅ Touch ID/Face ID |
| **Keychain**        | ✅ macOS Keychain | ✅ iOS Keychain     |
| **Network Access**  | ✅ Local + Remote | ✅ Local + Remote   |

## **Deployment Options** 🚀

### **Option 1: macOS-Only** (Current)

```bash
# Start everything via service manager
go run main.go

# Swift auth starts via Xcode
# API Gateway routes to Swift auth
```

### **Option 2: iOS-Only**

```bash
# Build and run iOS app
# Auth bridge starts automatically
# Connect other services to iOS auth bridge
```

### **Option 3: Hybrid** (Recommended)

```bash
# macOS: Service manager handles Swift auth
go run main.go

# iOS: Standalone app with auth bridge
# Both can serve auth requests
```

## **Network Configuration** 🌐

### **macOS Setup**

```bash
# Service Manager manages everything
curl http://localhost:8080/api/auth/status  # Via API Gateway
curl http://localhost:8016/health           # Direct to Swift auth
```

### **iOS Setup**

```bash
# Direct connection to iOS device
curl http://192.168.1.100:8016/health      # Replace with iOS IP
curl http://192.168.1.100:8016/auth/status
```

## **Testing Both Platforms** 🧪

### **Test Script for macOS**

```bash
#!/bin/bash
echo "Testing macOS Auth..."
curl -s http://localhost:8080/api/auth/status | jq .
curl -s http://localhost:8016/health | jq .
```

### **Test Script for iOS**

```bash
#!/bin/bash
IOS_IP="192.168.1.100"  # Replace with actual iOS device IP
echo "Testing iOS Auth..."
curl -s http://$IOS_IP:8016/health | jq .
curl -s http://$IOS_IP:8016/auth/status | jq .
```

## **Production Deployment** 🏭

### **macOS Production**

1. **Build Swift app** for macOS
2. **Configure service manager** to start app
3. **Set up API Gateway** routing
4. **Monitor health endpoints**

### **iOS Production**

1. **Build iOS app** with auth bridge
2. **Deploy to App Store** or enterprise
3. **Configure network access** for auth bridge
4. **Set up monitoring** for iOS auth service

## **Troubleshooting** 🔧

### **macOS Issues**

```bash
# Check if Swift auth is running
curl http://localhost:8016/health

# Check service manager logs
go run main.go 2>&1 | grep swift-auth

# Check Xcode project
open swift-companion-app/UniversalAICompanion.xcodeproj
```

### **iOS Issues**

```bash
# Check iOS device IP
ifconfig | grep "inet "

# Test direct connection
curl http://[iOS_IP]:8016/health

# Check iOS app logs in Xcode
```

## **Summary** ✅

| Platform  | Status      | Auth Bridge  | Service Manager | Ready  |
| --------- | ----------- | ------------ | --------------- | ------ |
| **macOS** | ✅ Complete | ✅ Port 8016 | ✅ Integrated   | ✅ Yes |
| **iOS**   | ✅ Complete | ✅ Port 8016 | ❌ N/A          | ✅ Yes |

**Both platforms are now fully configured for Swift authentication!** 🎉

The key difference is:

- **macOS**: Managed by Go service manager
- **iOS**: Standalone app with internal auth bridge

Both provide the same authentication capabilities with native biometric support.
