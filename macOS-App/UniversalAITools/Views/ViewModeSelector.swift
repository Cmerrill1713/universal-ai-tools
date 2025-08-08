import SwiftUI

struct ViewModeSelector: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Picker("View Mode", selection: $appState.viewMode) {
            HStack {
                Image(systemName: "globe")
                Text("Web")
            }
            .tag(ViewMode.webView)

            HStack {
                Image(systemName: "app")
                Text("Native")
            }
            .tag(ViewMode.native)

            HStack {
                Image(systemName: "rectangle.split.2x1")
                Text("Hybrid")
            }
            .tag(ViewMode.hybrid)
        }
        .pickerStyle(SegmentedPickerStyle())
        .frame(width: 200)
    }
}

#Preview {
    ViewModeSelector()
        .environmentObject(AppState())
}
