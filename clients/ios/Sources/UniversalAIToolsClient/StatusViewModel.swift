import Foundation

@MainActor
public final class StatusViewModel: ObservableObject {
  @Published public var statusText: String = "Loading…"
  @Published public var errorText: String?

  private let api: APIClient

  public init(api: APIClient) {
    self.api = api
  }

  public func load() async {
    do {
      let status = try await api.getStatus()
      statusText = "Backend: \(status.status) • Env: \(status.environment)"
      errorText = nil
    } catch {
      errorText = "Failed: \(error.localizedDescription)"
      statusText = "Error"
    }
  }
}


