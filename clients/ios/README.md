# Universal AI Tools iOS Client (Swift Package)

This Swift Package provides a minimal client for the Universal AI Tools backend, including:

* APIClient for REST calls
* StatusViewModel for loading /api/v1/status
* ContentView as a simple SwiftUI demo

## Usage

1. In Xcode, add package dependency from local path: `clients/ios`.
2. Import `UniversalAIToolsClient` in your SwiftUI target.
3. Use `ContentView()` or construct `APIClient` directly:

```swift
import UniversalAIToolsClient

let api = APIClient(baseURL: URL(string: "http://127.0.0.1:9999")!, apiKey: nil, bearerToken: nil)
Task {
  let status = try await api.getStatus()
  print(status)
}
```

## ATS for Local HTTP (Development)

If targeting iOS and calling `http://127.0.0.1:9999` during development, add to your `Info.plist`:

```xml
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <true/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>localhost</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
    <key>127.0.0.1</key>
    <dict>
      <key>NSIncludesSubdomains</key>
      <true/>
      <key>NSTemporaryExceptionAllowsInsecureHTTPLoads</key>
      <true/>
    </dict>
  </dict>
  </dict>
```

## Protected Endpoints

For `POST /api/v1/agents/execute` you must provide either `X-API-Key` or `Authorization: Bearer <JWT>`.

Example:

```swift
struct AgentResult: Decodable { let result: String? }
let api = APIClient(baseURL: URL(string: "http://127.0.0.1:9999")!, apiKey: "<YOUR_API_KEY>")
Task {
  let result: AgentResult = try await api.executeAgent(
    agentName: "personal_assistant",
    userRequest: .string("Hello from iOS"),
    context: ["source": .string("ios")],
    expecting: AgentResult.self
  )
  print(result)
}
```

## Notes

* Simulator can use `http://127.0.0.1:9999`.
* Physical device should use your Mac's LAN IP, e.g. `http://192.168.x.x:9999`.
* CORS does not affect native apps.
