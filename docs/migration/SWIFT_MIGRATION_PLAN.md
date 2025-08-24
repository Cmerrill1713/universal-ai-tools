# Swift Migration Facilitation Plan

**Based on**: PRD v3.0, PRP v2.0, Roadmap (August 21, 2025)  
**Timeline**: Phase 1 (1 week) → Phase 2 (1-2 weeks) → Advanced Features  
**Status**: Ready to execute - all prerequisites completed ✅

---

## 📋 Migration Overview

### Current Achievement Status
- ✅ **Backend Infrastructure**: Rust LLM Router + Go WebSocket + TypeScript Business Logic
- ✅ **Swift macOS App**: Three complete feature interfaces (Image Gen, Libraries, Hardware Auth)
- ✅ **Performance**: 37% improvement, 85% memory reduction validated
- ✅ **Monitoring**: Distributed tracing with OpenTelemetry stack operational
- ✅ **Local AI**: Ollama integration working offline

### Integration Target
Connect the existing Swift macOS app to the hybrid backend services, implementing authentication, real-time features, and API integration according to the PRD/PRP specifications.

---

## 🚀 PHASE 1A: Swift App Backend Connection (2-3 days)

### Priority 1: Image Generation → Rust LLM Router
**File**: `macOS-App/UniversalAITools/Views/ImageGenerationView.swift`  
**Target**: Connect to Rust service at `http://localhost:8003`

#### Current Implementation (358 lines - completed)
- ✅ SwiftUI interface with prompt input, style selection, size options
- ✅ Generation history with thumbnail grid
- ✅ Download and save functionality
- ✅ Error handling and loading states

#### Integration Tasks
1. **Update SimpleAPIService.swift** to support image generation endpoint
2. **Modify ImageGenerationView.swift** to use real Rust API instead of mock data
3. **Test Rust LLM Router connection** from Swift app
4. **Implement proper error handling** for service connectivity

```swift
// SimpleAPIService.swift additions needed
func generateImage(prompt: String, style: String = "realistic", size: String = "1024x1024") async throws -> ImageResponse {
    let payload: [String: Any] = [
        "prompt": prompt,
        "style": style,
        "size": size,
        "model": "image-generation"
    ]
    
    let response = try await makeRequest(
        endpoint: "/api/image/generate",  // New Rust endpoint
        method: .POST,
        body: payload,
        timeout: 60.0  // Long timeout for image generation
    )
    
    // Parse Rust service response
    // Return properly formatted ImageResponse
}
```

### Priority 2: Libraries View → TypeScript APIs  
**File**: `macOS-App/UniversalAITools/Views/LibrariesView.swift`  
**Target**: Connect to TypeScript service at `http://localhost:9999`

#### Current Implementation (670 lines - completed)
- ✅ Comprehensive library database with search/filter
- ✅ Installation guides and code examples
- ✅ GitHub integration with NSWorkspace
- ✅ Category organization and status indicators

#### Integration Tasks
1. **Create library management API** in TypeScript service
2. **Update LibrariesView** to fetch dynamic library data
3. **Implement search/filter backend** for better performance  
4. **Add usage analytics** tracking

```swift
// New API methods for LibrariesView
func getSwiftLibraries() async throws -> [SwiftLibrary] {
    let response = try await makeRequest(endpoint: "/api/libraries/swift", method: .GET)
    // Parse and return library data from TypeScript service
}

func searchLibraries(query: String, category: String?) async throws -> [SwiftLibrary] {
    var endpoint = "/api/libraries/search?q=\(query)"
    if let category = category {
        endpoint += "&category=\(category)"
    }
    let response = try await makeRequest(endpoint: endpoint, method: .GET)
    // Return filtered results
}
```

### Priority 3: Hardware Authentication → WebSocket Service
**File**: `macOS-App/UniversalAITools/Views/HardwareAuthenticationView.swift`  
**Target**: Connect to Go WebSocket at `ws://localhost:8002`

#### Current Implementation (1000+ lines - completed)  
- ✅ Multi-tab interface (Devices, Activity, Security)
- ✅ Bluetooth device monitoring and pairing
- ✅ Activity logs and security configuration
- ✅ Real-time device status tracking

#### Integration Tasks
1. **Implement WebSocket connection** in SimpleAPIService
2. **Add real-time device status** updates via WebSocket
3. **Connect Bluetooth scanning** to backend device registry
4. **Implement activity logging** to backend storage

```swift
// WebSocket integration for HardwareAuthenticationView
import Foundation
import Network

class WebSocketService: ObservableObject {
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    
    func connect(to endpoint: String) async {
        guard let url = URL(string: "ws://localhost:8002/ws/hardware-auth") else { return }
        
        let request = URLRequest(url: url)
        webSocketTask = URLSession.shared.webSocketTask(with: request)
        webSocketTask?.resume()
        
        await startListening()
    }
    
    private func startListening() async {
        // Handle incoming device status updates
        // Process real-time authentication events
        // Update UI with live device information
    }
}
```

---

## 🚀 PHASE 1B: Authentication Integration (2-3 days)

### JWT Implementation Across All Platforms

According to your PRP document, this requires JWT authentication across **all four platforms**:
- **Swift macOS app** (client)
- **Rust service** (port 8003) 
- **Go service** (port 8002)
- **TypeScript service** (port 9999)

### Priority 1: Swift App JWT Handling
**File**: `macOS-App/UniversalAITools/Services/KeychainService.swift` (already exists)

#### Implementation Tasks
1. **Extend KeychainService** to handle JWT tokens specifically
2. **Add login/logout flows** to the macOS app
3. **Implement token refresh logic** with automatic renewal
4. **Add authentication UI** (login screen/modal)

```swift
// KeychainService.swift extensions for JWT
extension KeychainService {
    func storeJWTToken(_ token: String) throws {
        try storeAuthToken(token, type: .jwt)
    }
    
    func retrieveJWTToken() -> String? {
        return retrieveAuthToken(type: .jwt)
    }
    
    func isTokenValid() async -> Bool {
        guard let token = retrieveJWTToken() else { return false }
        
        // Verify token hasn't expired
        // Optionally validate with backend
        return !isTokenExpired(token)
    }
}
```

### Priority 2: Rust Service JWT Middleware
**File**: `rust-services/llm-router/src/auth.rs` (needs creation)

#### Implementation per PRP Requirements
```rust
// JWT authentication middleware for Rust service
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use axum::{
    extract::State,
    headers::{authorization::Bearer, Authorization},
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    TypedHeader,
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub user_id: String,
    pub exp: usize,
    pub iat: usize,
}

pub async fn auth_middleware<B>(
    TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
    mut request: Request<B>,
    next: Next<B>,
) -> Result<Response, StatusCode> {
    let token = auth.token();
    
    // Validate JWT token
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret("your_shared_secret".as_ref()),
        &Validation::default(),
    ).map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    // Add user context to request
    request.extensions_mut().insert(token_data.claims);
    
    Ok(next.run(request).await)
}
```

### Priority 3: Cross-Service Authentication Standards
**Target**: Unified authentication across all four platforms per PRP requirements

#### Shared Configuration
```typescript
// Shared authentication configuration (all services)
interface AuthenticationStandard {
  jwt_secret: "unified_secret_key_across_all_services";
  token_expiry: 86400; // 24 hours
  refresh_threshold: 3600; // 1 hour before expiry
  issuer: "universal-ai-tools";
  audience: ["swift-app", "rust-service", "go-service", "typescript-service"];
}
```

---

## 🚀 PHASE 1C: Real-time Features (1-2 days)

### WebSocket Integration Implementation

#### Priority 1: Swift App WebSocket Connection
**File**: `macOS-App/UniversalAITools/Services/WebSocketService.swift` (needs creation)

```swift
import Foundation
import Network

@MainActor
@Observable
class WebSocketService {
    private var webSocketTask: URLSessionWebSocketTask?
    private var isConnected = false
    
    // Real-time updates for different features
    private(set) var deviceStatusUpdates: [DeviceStatus] = []
    private(set) var imageGenerationProgress: GenerationProgress?
    private(set) var libraryUpdateNotifications: [LibraryUpdate] = []
    
    func connect() async throws {
        let url = URL(string: "ws://localhost:8002/ws")!
        webSocketTask = URLSession.shared.webSocketTask(with: URLRequest(url: url))
        
        webSocketTask?.resume()
        await startListening()
        isConnected = true
    }
    
    private func startListening() async {
        guard let webSocketTask = webSocketTask else { return }
        
        do {
            let message = try await webSocketTask.receive()
            await handleMessage(message)
            await startListening() // Continue listening
        } catch {
            print("WebSocket error: \(error)")
            isConnected = false
        }
    }
    
    private func handleMessage(_ message: URLSessionWebSocketTask.Message) async {
        switch message {
        case .string(let text):
            await processTextMessage(text)
        case .data(let data):
            await processDataMessage(data)
        @unknown default:
            break
        }
    }
}
```

#### Priority 2: Go WebSocket Service Updates  
**File**: `rust-services/go-websocket/main.go`

Add support for Swift app specific channels:
- Device status broadcasting
- Image generation progress updates  
- Library update notifications
- Authentication state changes

#### Priority 3: Real-time UI Updates
Update each Swift view to handle real-time data:

1. **HardwareAuthenticationView**: Live device status updates
2. **ImageGenerationView**: Progress tracking and completion notifications
3. **LibrariesView**: New library additions and update notifications

---

## 📊 Success Criteria (Per PRD/PRP)

### Phase 1A Success Metrics
- ✅ Image generation requests successfully processed by Rust LLM Router
- ✅ Libraries view populated with data from TypeScript service
- ✅ Hardware authentication connected to WebSocket service
- ✅ Error handling working across all connections
- ✅ Response times under 200ms for non-AI operations

### Phase 1B Success Metrics  
- ✅ JWT tokens issued and validated across all four platforms
- ✅ Swift app can login/logout with backend authentication
- ✅ Token refresh working automatically
- ✅ Cross-service authentication state synchronized

### Phase 1C Success Metrics
- ✅ WebSocket connections established from Swift app
- ✅ Real-time updates working in Hardware Authentication
- ✅ Live progress tracking for image generation
- ✅ Push notifications for background operations

---

## 🛠️ Implementation Execution Plan

### Day 1-2: Backend API Integration
1. **Morning**: Update SimpleAPIService.swift with new endpoints
2. **Afternoon**: Test connections to all three backend services
3. **Evening**: Fix connectivity issues, validate data flow

### Day 3-4: Authentication Implementation  
1. **Morning**: Implement JWT handling in Swift app
2. **Afternoon**: Add authentication middleware to Rust service
3. **Evening**: Test cross-service authentication flow

### Day 5-6: Real-time Features
1. **Morning**: Create WebSocket service in Swift app
2. **Afternoon**: Connect real-time updates to UI components
3. **Evening**: Test and validate live update functionality

### Day 7: Integration Testing & Documentation
1. **Morning**: End-to-end testing of all integrated features
2. **Afternoon**: Performance validation and optimization
3. **Evening**: Update documentation and prepare for Phase 2

---

## 🎯 **Ready to Execute**

All prerequisites from your PRD, PRP, and Roadmap are complete:
- ✅ Backend services operational and validated
- ✅ Swift app interfaces implemented and ready
- ✅ Performance targets achieved (37% improvement)
- ✅ Monitoring infrastructure in place
- ✅ Local AI integration working

**Let's connect your Swift macOS app to the hybrid backend and complete the integration! 🚀**

### Next Steps
1. **Confirm execution start** - Ready to begin Phase 1A implementation
2. **Select starting priority** - Image Generation, Libraries, or Hardware Auth first
3. **Set up development environment** - Ensure all services are running
4. **Begin systematic integration** - Following the documented plan

The Swift migration is ready to execute according to your specifications!