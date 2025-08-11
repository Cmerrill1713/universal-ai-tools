import SwiftUI

struct ViewModeSelector: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        Picker("View Mode", selection: $appState.viewMode) {
            Image(systemName: "globe")
                .tag(ViewMode.webView)
                .help("Web")

            Image(systemName: "app")
                .tag(ViewMode.native)
                .help("Native")

            Image(systemName: "rectangle.split.2x1")
                .tag(ViewMode.hybrid)
                .help("Hybrid")
        }
        .pickerStyle(SegmentedPickerStyle())
        .labelsHidden()
        .frame(width: 150)
        .fixedSize()
    }
}

#Preview {
    ViewModeSelector()
        .environmentObject(AppState())
}
