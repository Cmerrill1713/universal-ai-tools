import SwiftUI

public struct ContentView: View {
  @StateObject private var vm: StatusViewModel

  public init(baseURL: URL = URL(string: "http://127.0.0.1:9999")!, apiKey: String? = nil, bearerToken: String? = nil) {
    let api = APIClient(baseURL: baseURL, apiKey: apiKey, bearerToken: bearerToken)
    _vm = StateObject(wrappedValue: StatusViewModel(api: api))
  }

  public var body: some View {
    VStack(spacing: 12) {
      Text(vm.statusText).font(.headline)
      if let err = vm.errorText {
        Text(err).foregroundColor(.red).font(.caption)
      }
      Button("Refresh") {
        Task { await vm.load() }
      }
      .buttonStyle(.borderedProminent)
    }
    .padding()
    .task { await vm.load() }
  }
}

#if DEBUG
struct ContentView_Previews: PreviewProvider {
  static var previews: some View {
    ContentView()
  }
}
#endif


