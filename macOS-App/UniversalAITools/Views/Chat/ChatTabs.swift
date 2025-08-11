import SwiftUI

struct ChatTabsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 14) {
            Button(action: { appState.selectedSidebarItem = .chat }, label: {
                Image(systemName: "text.bubble").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .agents }, label: {
                Image(systemName: "brain.head.profile").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .tools }, label: {
                Image(systemName: "wrench.and.screwdriver").font(.subheadline)
            })
            Button(action: { appState.selectedSidebarItem = .monitoring }, label: {
                Image(systemName: "chart.line.uptrend.xyaxis").font(.subheadline)
            })
            Spacer()
        }
        .buttonStyle(BorderlessButtonStyle())
        .frame(maxWidth: 720)
        .frame(maxWidth: .infinity)
    }
}


