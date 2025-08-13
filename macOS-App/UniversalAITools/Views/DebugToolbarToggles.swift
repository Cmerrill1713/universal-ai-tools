import SwiftUI

struct DebugToolbarToggles: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 8) {
            Toggle(isOn: $appState.showLayoutDebug) {
                Image(systemName: "rectangle.dashed")
            }
            .toggleStyle(.button)
            .help("Toggle layout debug overlays")
        }
    }
}

#Preview {
    DebugToolbarToggles().environmentObject(AppState())
}
