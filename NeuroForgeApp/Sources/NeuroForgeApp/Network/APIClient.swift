import Foundation

/// Production-grade API client with proper error handling and diagnostics
public struct APIClient {
    private let baseURL: URL
    private let session: URLSession
    
    public init(baseURL: URL? = nil, session: URLSession? = nil) {
        self.baseURL = baseURL ?? apiBaseURL()
        self.session = session ?? URLSession.shared
    }
    
    /// Map HTTP status code to APIError
    private func mapError(statusCode: Int, data: Data?) -> APIError? {
        switch statusCode {
        case 200..<400:
            return nil
        case 422:
            // Try to extract validation message from response
            var message: String? = nil
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let detail = json["detail"] as? String {
                message = detail
            }
            return .validation422(message: message)
        case 503:
            return .service503
        case 500..<600:
            return .server5xx(code: statusCode)
        default:
            return .server5xx(code: statusCode)
        }
    }
    
    /// GET request with type-safe decoding
    public func get<T: Decodable>(_ path: String) async throws -> T {
        let url = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            
            if let error = mapError(statusCode: httpResponse.statusCode, data: data) {
                throw error
            }
            
            do {
                let decoded = try JSONDecoder().decode(T.self, from: data)
                return decoded
            } catch {
                throw APIError.decoding(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error)
        }
    }
    
    /// POST request with type-safe encoding/decoding
    public func post<T: Encodable, U: Decodable>(_ path: String, body: T) async throws -> U {
        let url = baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        do {
            request.httpBody = try JSONEncoder().encode(body)
        } catch {
            throw APIError.transport(error)
        }
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            
            if let error = mapError(statusCode: httpResponse.statusCode, data: data) {
                throw error
            }
            
            do {
                let decoded = try JSONDecoder().decode(U.self, from: data)
                return decoded
            } catch {
                throw APIError.decoding(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error)
        }
    }
}

