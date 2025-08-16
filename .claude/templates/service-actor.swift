//
//  ___FILENAME___
//  UniversalAITools
//
//  Created on ___DATE___.
//

import Foundation

/// Thread-safe service using Swift actors
actor ___SERVICENAME___ {
    // MARK: - Singleton
    static let shared = ___SERVICENAME___()
    
    // MARK: - Properties
    private var cache: [String: ___DATATYPE___] = [:]
    private let apiClient = APIService.shared
    private let baseURL = "http://localhost:9999/api/v1"
    
    // Configuration
    private let maxRetries = 3
    private let timeoutInterval: TimeInterval = 30
    
    // MARK: - Initialization
    private init() {
        // Private init for singleton
    }
    
    // MARK: - Public Methods
    
    /// Fetch items from the API
    func fetchItems() async throws -> [___DATATYPE___] {
        let endpoint = "\(baseURL)/___ENDPOINT___"
        
        do {
            let data = try await performRequest(
                endpoint: endpoint,
                method: .get
            )
            
            let items = try JSONDecoder().decode([___DATATYPE___].self, from: data)
            
            // Update cache
            for item in items {
                cache[item.id] = item
            }
            
            return items
        } catch {
            print("[___SERVICENAME___] Failed to fetch items: \(error)")
            throw ServiceError.fetchFailed(error)
        }
    }
    
    /// Get a single item by ID
    func getItem(id: String) async throws -> ___DATATYPE___ {
        // Check cache first
        if let cached = cache[id] {
            return cached
        }
        
        let endpoint = "\(baseURL)/___ENDPOINT___/\(id)"
        
        do {
            let data = try await performRequest(
                endpoint: endpoint,
                method: .get
            )
            
            let item = try JSONDecoder().decode(___DATATYPE___.self, from: data)
            cache[id] = item
            
            return item
        } catch {
            print("[___SERVICENAME___] Failed to get item \(id): \(error)")
            throw ServiceError.itemNotFound(id)
        }
    }
    
    /// Create a new item
    func createItem(_ item: ___DATATYPE___) async throws -> ___DATATYPE___ {
        let endpoint = "\(baseURL)/___ENDPOINT___"
        let body = try JSONEncoder().encode(item)
        
        do {
            let data = try await performRequest(
                endpoint: endpoint,
                method: .post,
                body: body
            )
            
            let newItem = try JSONDecoder().decode(___DATATYPE___.self, from: data)
            cache[newItem.id] = newItem
            
            return newItem
        } catch {
            print("[___SERVICENAME___] Failed to create item: \(error)")
            throw ServiceError.createFailed(error)
        }
    }
    
    /// Update an existing item
    func updateItem(_ item: ___DATATYPE___) async throws -> ___DATATYPE___ {
        let endpoint = "\(baseURL)/___ENDPOINT___/\(item.id)"
        let body = try JSONEncoder().encode(item)
        
        do {
            let data = try await performRequest(
                endpoint: endpoint,
                method: .put,
                body: body
            )
            
            let updatedItem = try JSONDecoder().decode(___DATATYPE___.self, from: data)
            cache[updatedItem.id] = updatedItem
            
            return updatedItem
        } catch {
            print("[___SERVICENAME___] Failed to update item \(item.id): \(error)")
            throw ServiceError.updateFailed(error)
        }
    }
    
    /// Delete an item
    func deleteItem(_ id: String) async throws {
        let endpoint = "\(baseURL)/___ENDPOINT___/\(id)"
        
        do {
            _ = try await performRequest(
                endpoint: endpoint,
                method: .delete
            )
            
            cache.removeValue(forKey: id)
        } catch {
            print("[___SERVICENAME___] Failed to delete item \(id): \(error)")
            throw ServiceError.deleteFailed(error)
        }
    }
    
    /// Clear the cache
    func clearCache() {
        cache.removeAll()
    }
    
    // MARK: - Private Methods
    
    private func performRequest(
        endpoint: String,
        method: HTTPMethod,
        body: Data? = nil,
        retryCount: Int = 0
    ) async throws -> Data {
        guard let url = URL(string: endpoint) else {
            throw ServiceError.invalidURL(endpoint)
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.timeoutInterval = timeoutInterval
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw ServiceError.invalidResponse
            }
            
            guard (200...299).contains(httpResponse.statusCode) else {
                if httpResponse.statusCode == 401 {
                    throw ServiceError.unauthorized
                }
                throw ServiceError.httpError(httpResponse.statusCode)
            }
            
            return data
        } catch {
            // Retry logic
            if retryCount < maxRetries {
                let delay = pow(2.0, Double(retryCount)) // Exponential backoff
                try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                return try await performRequest(
                    endpoint: endpoint,
                    method: method,
                    body: body,
                    retryCount: retryCount + 1
                )
            }
            throw error
        }
    }
}

// MARK: - Supporting Types

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case put = "PUT"
    case delete = "DELETE"
    case patch = "PATCH"
}

enum ServiceError: LocalizedError {
    case invalidURL(String)
    case invalidResponse
    case httpError(Int)
    case unauthorized
    case itemNotFound(String)
    case fetchFailed(Error)
    case createFailed(Error)
    case updateFailed(Error)
    case deleteFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let code):
            return "HTTP error: \(code)"
        case .unauthorized:
            return "Unauthorized access"
        case .itemNotFound(let id):
            return "Item not found: \(id)"
        case .fetchFailed(let error):
            return "Failed to fetch items: \(error.localizedDescription)"
        case .createFailed(let error):
            return "Failed to create item: \(error.localizedDescription)"
        case .updateFailed(let error):
            return "Failed to update item: \(error.localizedDescription)"
        case .deleteFailed(let error):
            return "Failed to delete item: \(error.localizedDescription)"
        }
    }
}