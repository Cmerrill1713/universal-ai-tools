# Device Authentication API Documentation

## Overview

The Universal AI Tools Device Authentication API enables secure authentication using Apple devices (iPhone, iPad, Apple Watch, Mac) through Bluetooth proximity and biometric verification. This documentation covers all endpoints and WebSocket events for Swift app integration.

## Base URLs

- **Production**: `https://api.universal-ai-tools.com`
- **WebSocket**: `wss://api.universal-ai-tools.com/ws/device-auth`
- **Development**: `http://localhost:9999` (HTTP) / `ws://localhost:8080/ws/device-auth` (WebSocket)

## Authentication Methods

### 1. JWT Bearer Token
```
Authorization: Bearer <jwt_token>
```

### 2. API Key (for initial registration)
```
X-API-Key: <api_key>
```

## REST API Endpoints

### 1. Initial Device Registration

Register a new device without authentication (first-time setup).

**Endpoint**: `POST /api/v1/device-auth/register-initial`

**Request Body**:
```json
{
  "deviceId": "iPhone-UNIQUE-ID-123",
  "deviceName": "John's iPhone 15 Pro",
  "deviceType": "iPhone",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqh...",
  "userId": "user-123",
  "metadata": {
    "osVersion": "17.0",
    "appVersion": "1.0.0",
    "capabilities": ["bluetooth", "biometric", "proximity", "face_id"]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "message": "Device registered successfully",
    "authToken": "eyJhbGciOiJIUzI1NiIs...",
    "requiresTrust": false
  },
  "metadata": {
    "timestamp": "2024-08-01T10:30:00Z",
    "requestId": "req-123"
  }
}
```

**Rate Limit**: 5 requests per 15 minutes per IP

### 2. Device Registration (Authenticated)

Register a device for an authenticated user.

**Endpoint**: `POST /api/v1/device-auth/register`

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request Body**: Same as initial registration, but without `userId`

**Response**: Same as initial registration

**Rate Limit**: 5 requests per 15 minutes per user

### 3. List Registered Devices

Get all devices registered for the authenticated user.

**Endpoint**: `GET /api/v1/device-auth/devices`

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "devices": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "deviceName": "John's iPhone 15 Pro",
        "deviceType": "iPhone",
        "trusted": true,
        "lastSeen": "2024-08-01T10:30:00Z",
        "createdAt": "2024-07-01T10:30:00Z"
      }
    ],
    "total": 1
  },
  "metadata": {
    "timestamp": "2024-08-01T10:30:00Z",
    "requestId": "req-123"
  }
}
```

### 4. Request Authentication Challenge

Request a challenge for device authentication.

**Endpoint**: `POST /api/v1/device-auth/challenge`

**Request Body**:
```json
{
  "deviceId": "iPhone-UNIQUE-ID-123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "challengeId": "challenge-550e8400",
    "challenge": "a3f2d4e6b8c9d1e3f5a7b9c1d3e5f7a9",
    "expiresAt": 1704114600000
  },
  "metadata": {
    "timestamp": "2024-08-01T10:30:00Z",
    "requestId": "req-123"
  }
}
```

**Rate Limit**: 20 requests per 5 minutes per device

### 5. Verify Challenge

Verify the challenge response to authenticate the device.

**Endpoint**: `POST /api/v1/device-auth/verify`

**Request Body**:
```json
{
  "challengeId": "challenge-550e8400",
  "signature": "base64-encoded-signature",
  "proximity": {
    "rssi": -50
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 86400,
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-123"
  },
  "metadata": {
    "timestamp": "2024-08-01T10:30:00Z",
    "requestId": "req-123"
  }
}
```

**Rate Limit**: 10 requests per 5 minutes per challenge

### 6. Update Proximity

Update device proximity for auto-lock/unlock functionality.

**Endpoint**: `POST /api/v1/device-auth/proximity`

**Headers**:
```
Authorization: Bearer <jwt_token>
```

**Request Body**:
```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "rssi": -60
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sessionId": "session-123",
    "proximity": "near",
    "locked": false
  },
  "metadata": {
    "timestamp": "2024-08-01T10:30:00Z",
    "requestId": "req-123"
  }
}
```

**Proximity Values**:
- `immediate`: < 1 meter (RSSI >= -50)
- `near`: 1-3 meters (RSSI >= -70)
- `far`: 3-10 meters (RSSI >= -90)
- `unknown`: > 10 meters or no signal

**Rate Limit**: 60 requests per minute per device

## WebSocket API

### Connection

Connect to the WebSocket endpoint with JWT authentication:

```javascript
const ws = new WebSocket('wss://api.universal-ai-tools.com/ws/device-auth', {
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
});
```

### Message Types

#### 1. Welcome Message (Server → Client)
Sent immediately after successful connection.

```json
{
  "type": "welcome",
  "data": {
    "clientId": "client-550e8400",
    "userId": "user-123",
    "deviceId": "device-123",
    "timestamp": "2024-08-01T10:30:00Z"
  }
}
```

#### 2. Subscribe to Channels (Client → Server)
Subscribe to receive specific events.

```json
{
  "type": "subscribe",
  "channels": ["user:user-123", "device:device-123"]
}
```

#### 3. Proximity Update (Client → Server)
Send proximity updates from the device.

```json
{
  "type": "proximity_update",
  "data": {
    "rssi": -50,
    "proximity": "immediate",
    "locked": false
  }
}
```

#### 4. Authentication Events (Server → Client)
Real-time authentication state changes.

```json
{
  "type": "auth_event",
  "event": {
    "type": "proximity_changed",
    "deviceId": "device-123",
    "userId": "user-123",
    "timestamp": "2024-08-01T10:30:00Z",
    "data": {
      "rssi": -50,
      "proximity": "immediate",
      "locked": false
    }
  }
}
```

**Event Types**:
- `device_registered`: New device registered
- `device_removed`: Device removed/disconnected
- `auth_state_changed`: Authentication state changed
- `proximity_changed`: Device proximity updated
- `screen_locked`: Screen auto-locked due to proximity
- `screen_unlocked`: Screen auto-unlocked due to proximity

#### 5. Heartbeat (Client ↔ Server)
Keep connection alive.

**Client → Server**:
```json
{
  "type": "ping",
  "timestamp": 1704114600000
}
```

**Server → Client**:
```json
{
  "type": "pong",
  "timestamp": 1704114600000
}
```

### WebSocket Error Codes

- `1000`: Normal closure
- `1001`: Going away (server shutdown)
- `1002`: Protocol error
- `1003`: Unsupported data
- `1006`: Abnormal closure
- `1008`: Policy violation (authentication failed)
- `1011`: Server error

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `AUTHENTICATION_ERROR`: Invalid or missing authentication
- `VALIDATION_ERROR`: Invalid request parameters
- `DEVICE_NOT_FOUND`: Device not registered
- `CHALLENGE_NOT_FOUND`: Invalid or expired challenge
- `CHALLENGE_EXPIRED`: Challenge has expired
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `DEVICE_REGISTRATION_ERROR`: Failed to register device
- `VERIFICATION_ERROR`: Failed to verify device

## Security Considerations

### 1. Challenge-Response Authentication
- Challenges expire after 5 minutes
- Each challenge can only be used once
- Signatures must be verified using the device's public key

### 2. Rate Limiting
- All endpoints have rate limits to prevent abuse
- Limits are per-IP for unauthenticated endpoints
- Limits are per-user/device for authenticated endpoints

### 3. Proximity-Based Security
- Auto-lock when device proximity is "far" or "unknown"
- Auto-unlock only when proximity is "immediate"
- Proximity updates are validated for reasonable RSSI values

### 4. Audit Logging
- All authentication attempts are logged
- Failed attempts trigger security alerts
- Suspicious patterns result in temporary lockouts

## Swift Integration Example

```swift
import Foundation
import CryptoKit

class DeviceAuthService {
    let baseURL = "https://api.universal-ai-tools.com"
    let wsURL = "wss://api.universal-ai-tools.com/ws/device-auth"
    
    // Register device
    func registerDevice(deviceId: String, publicKey: String) async throws -> DeviceRegistration {
        let url = URL(string: "\(baseURL)/api/v1/device-auth/register-initial")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = [
            "deviceId": deviceId,
            "deviceName": UIDevice.current.name,
            "deviceType": "iPhone",
            "publicKey": publicKey,
            "metadata": [
                "osVersion": UIDevice.current.systemVersion,
                "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0",
                "capabilities": ["bluetooth", "biometric", "proximity", "face_id"]
            ]
        ] as [String : Any]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await URLSession.shared.data(for: request)
        return try JSONDecoder().decode(DeviceRegistration.self, from: data)
    }
    
    // Request and verify challenge
    func authenticate(deviceId: String, privateKey: SecKey) async throws -> AuthToken {
        // 1. Request challenge
        let challenge = try await requestChallenge(deviceId: deviceId)
        
        // 2. Sign challenge
        let signature = try signChallenge(challenge.challenge, with: privateKey)
        
        // 3. Verify with proximity
        let rssi = getCurrentRSSI() // Get from Bluetooth
        return try await verifyChallenge(
            challengeId: challenge.challengeId,
            signature: signature,
            rssi: rssi
        )
    }
    
    // WebSocket connection for real-time updates
    func connectWebSocket(token: String) {
        let url = URL(string: wsURL)!
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        
        let session = URLSession(configuration: .default)
        let webSocketTask = session.webSocketTask(with: request)
        
        webSocketTask.resume()
        receiveMessage(from: webSocketTask)
    }
}
```

## Testing

### cURL Examples

**Register Device**:
```bash
curl -X POST https://api.universal-ai-tools.com/api/v1/device-auth/register-initial \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "test-device-123",
    "deviceName": "Test iPhone",
    "deviceType": "iPhone",
    "publicKey": "test-public-key"
  }'
```

**Request Challenge**:
```bash
curl -X POST https://api.universal-ai-tools.com/api/v1/device-auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "test-device-123"}'
```

**WebSocket Connection**:
```bash
wscat -c wss://api.universal-ai-tools.com/ws/device-auth \
  -H "Authorization: Bearer <jwt_token>"
```

## Support

For technical support or questions about the Device Authentication API:
- GitHub Issues: https://github.com/universal-ai-tools/issues
- Email: support@universal-ai-tools.com
- Documentation: https://docs.universal-ai-tools.com/device-auth