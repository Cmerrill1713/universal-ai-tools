import Foundation

public struct APIError: Error, Decodable, LocalizedError {
  public let code: String?
  public let message: String?

  public var errorDescription: String? {
    message ?? code ?? "Unknown error"
  }
}

public struct StatusEnvelope: Decodable {
  public let success: Bool
  public let data: StatusData?
  public let error: APIError?
}

public struct StatusData: Decodable {
  public let status: String
  public let timestamp: String
  public let version: String
  public let environment: String
  public let endpoints: Endpoints

  public struct Endpoints: Decodable {
    public let health: String
    public let api: String
    public let websocket: String
  }
}

public struct AgentExecuteResponseEnvelope<T: Decodable>: Decodable {
  public let success: Bool
  public let data: T?
  public let error: APIError?
}

public enum EncodableValue: Encodable {
  case string(String)
  case number(Double)
  case bool(Bool)
  case object([String: EncodableValue])
  case array([EncodableValue])
  case null

  public func encode(to encoder: Encoder) throws {
    var container = encoder.singleValueContainer()
    switch self {
    case .string(let s): try container.encode(s)
    case .number(let n): try container.encode(n)
    case .bool(let b): try container.encode(b)
    case .object(let o): try container.encode(o)
    case .array(let a): try container.encode(a)
    case .null: try container.encodeNil()
    }
  }
}

public struct AgentExecuteRequest: Encodable {
  public let agentName: String
  public let userRequest: EncodableValue
  public let context: [String: EncodableValue]?
  public let enqueue: Bool?

  public init(
    agentName: String,
    userRequest: EncodableValue,
    context: [String: EncodableValue]? = nil,
    enqueue: Bool? = nil
  ) {
    self.agentName = agentName
    self.userRequest = userRequest
    self.context = context
    self.enqueue = enqueue
  }
}

public final class APIClient {
  public let baseURL: URL
  public var apiKey: String?
  public var bearerToken: String?

  public init(baseURL: URL, apiKey: String? = nil, bearerToken: String? = nil) {
    self.baseURL = baseURL
    self.apiKey = apiKey
    self.bearerToken = bearerToken
  }

  private func makeRequest(path: String, method: String = "GET", body: Data? = nil) throws -> URLRequest {
    guard let url = URL(string: path, relativeTo: baseURL) else { throw URLError(.badURL) }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(UUID().uuidString, forHTTPHeaderField: "X-Request-Id")
    if let apiKey { request.setValue(apiKey, forHTTPHeaderField: "X-API-Key") }
    if let bearerToken { request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "Authorization") }
    request.httpBody = body
    return request
  }

  private func decode<T: Decodable>(_ data: Data, as type: T.Type) throws -> T {
    let decoder = JSONDecoder()
    return try decoder.decode(T.self, from: data)
  }

  // Public: GET /api/v1/status
  public func getStatus() async throws -> StatusData {
    let request = try makeRequest(path: "/api/v1/status", method: "GET")
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
      if let env = try? decode(data, as: StatusEnvelope.self), let err = env.error {
        throw err
      }
      throw URLError(.badServerResponse)
    }
    let env = try decode(data, as: StatusEnvelope.self)
    if env.success, let data = env.data { return data }
    throw env.error ?? APIError(code: "UNKNOWN", message: "Unknown error")
  }

  // Protected: POST /api/v1/agents/execute
  public func executeAgent<T: Decodable>(
    agentName: String,
    userRequest: EncodableValue,
    context: [String: EncodableValue]? = nil,
    enqueue: Bool? = nil,
    expecting: T.Type
  ) async throws -> T {
    let payload = AgentExecuteRequest(agentName: agentName, userRequest: userRequest, context: context, enqueue: enqueue)
    let body = try JSONEncoder().encode(payload)
    let request = try makeRequest(path: "/api/v1/agents/execute", method: "POST", body: body)
    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, 200..<300 ~= http.statusCode else {
      if let env = try? decode(data, as: AgentExecuteResponseEnvelope<T>.self), let err = env.error {
        throw err
      }
      throw URLError(.badServerResponse)
    }
    let env = try decode(data, as: AgentExecuteResponseEnvelope<T>.self)
    if env.success, let data = env.data { return data }
    throw env.error ?? APIError(code: "UNKNOWN", message: "Unknown error")
  }
}


