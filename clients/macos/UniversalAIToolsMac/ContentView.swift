import SwiftUI
import UniversalAIToolsClient

struct ContentView: View {
  @StateObject private var vm: StatusViewModel

  init() {
    let api = APIClient(baseURL: URL(string: "http://127.0.0.1:9999")!)
    _vm = StateObject(wrappedValue: StatusViewModel(api: api))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Universal AI Tools (macOS)")
        .font(.title2)
      Text(vm.statusText)
        .font(.headline)
      if let err = vm.errorText {
        Text(err).foregroundColor(.red).font(.caption)
      }
      HStack {
        Button("Refresh") { Task { await vm.load() } }
          .keyboardShortcut(.init("r"), modifiers: [.command])
        Spacer()
      }
    }
    .padding(20)
    .frame(minWidth: 420, minHeight: 220)
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


