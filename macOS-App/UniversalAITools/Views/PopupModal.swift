import SwiftUI

// MARK: - Popup Modal System (ChatGPT-style)
struct PopupModal<Content: View>: View {
    @Binding var isPresented: Bool
    let title: String
    let content: () -> Content

    @State private var opacity: Double = 0
    @State private var scale: CGFloat = 0.9
    @State private var offset: CGFloat = 20

    var body: some View {
        ZStack {
            // Background overlay
            Color.black
                .opacity(opacity * 0.5)
                .ignoresSafeArea()
                .onTapGesture {
                    dismissModal()
                }

            // Modal content
            VStack(spacing: 0) {
                // Header
                modalHeader

                Divider()
                    .background(AppTheme.separator)

                // Scrollable content area with proper constraints
                ScrollView {
                    content()
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                }
                .frame(maxWidth: 800, maxHeight: 600) // Set maximum modal size
                .clipped() // Ensure content doesn't overflow
            }
            .frame(minWidth: 400, minHeight: 300) // Set minimum modal size
            .background(modalBackground)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(AppTheme.popupBorder, lineWidth: 1)
            )
            .shadow(color: AppTheme.heavyShadow, radius: 40, x: 0, y: 20)
            .scaleEffect(scale)
            .offset(y: offset)
            .opacity(opacity)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: opacity)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: scale)
            .animation(.spring(response: 0.3, dampingFraction: 0.8), value: offset)
        }
        .onAppear {
            showModal()
        }
    }

    // MARK: - Header
    private var modalHeader: some View {
        HStack {
            Text(title)
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(AppTheme.primaryText)

            Spacer()

            // Close button
            Button(action: dismissModal) {
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.1))
                        .frame(width: 28, height: 28)

                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
            .buttonStyle(PlainButtonStyle())
            .onHover { hovering in
                if hovering {
                    NSCursor.pointingHand.push()
                } else {
                    NSCursor.pop()
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(AppTheme.popupBackground)
    }

    // MARK: - Background
    private var modalBackground: some View {
        ZStack {
            AppTheme.popupBackground

            // Glass effect
            LinearGradient(
                gradient: Gradient(colors: [
                    Color.white.opacity(0.05),
                    Color.white.opacity(0.02)
                ]),
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    // MARK: - Actions
    private func showModal() {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            opacity = 1
            scale = 1
            offset = 0
        }
    }

    private func dismissModal() {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
            opacity = 0
            scale = 0.95
            offset = 10
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            isPresented = false
        }
    }
}

// MARK: - Popup Manager
class PopupManager: ObservableObject {
    static let shared = PopupManager()

    @Published var activePopup: PopupType?
    @Published var popupQueue: [PopupType] = []

    enum PopupType: Identifiable {
        case agentSelector
        case agentMonitor
        case mlxInterface
        case visionInterface
        case abmcts
        case maltSwarm
        case settings
        case agentActivity

        var id: String {
            switch self {
            case .agentSelector: return "agentSelector"
            case .agentMonitor: return "agentMonitor"
            case .mlxInterface: return "mlxInterface"
            case .visionInterface: return "visionInterface"
            case .abmcts: return "abmcts"
            case .maltSwarm: return "maltSwarm"
            case .settings: return "settings"
            case .agentActivity: return "agentActivity"
            }
        }

        var title: String {
            switch self {
            case .agentSelector: return "Select Agent"
            case .agentMonitor: return "Agent Monitor"
            case .mlxInterface: return "MLX Fine-Tuning"
            case .visionInterface: return "Vision Processing"
            case .abmcts: return "AB-MCTS Orchestration"
            case .maltSwarm: return "MALT Swarm Control"
            case .settings: return "Settings"
            case .agentActivity: return "Agent Activity"
            }
        }

        var size: CGSize {
            switch self {
            case .agentSelector: return CGSize(width: 600, height: 500)
            case .agentMonitor: return CGSize(width: 800, height: 600)
            case .mlxInterface: return CGSize(width: 900, height: 700)
            case .visionInterface: return CGSize(width: 900, height: 700)
            case .abmcts: return CGSize(width: 800, height: 600)
            case .maltSwarm: return CGSize(width: 800, height: 600)
            case .settings: return CGSize(width: 800, height: 600)
            case .agentActivity: return CGSize(width: 600, height: 500)
            }
        }
    }

    func show(_ popup: PopupType) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
            if activePopup != nil {
                popupQueue.append(popup)
            } else {
                activePopup = popup
            }
        }
    }

    func dismiss() {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
            activePopup = nil

            // Show next popup in queue if any
            if !popupQueue.isEmpty {
                let next = popupQueue.removeFirst()
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    self.show(next)
                }
            }
        }
    }

    func dismissAll() {
        withAnimation(.spring(response: 0.25, dampingFraction: 0.9)) {
            activePopup = nil
            popupQueue.removeAll()
        }
    }
}

// MARK: - Legacy Popup Container (Deprecated)
// This container is now deprecated as popup windows are opened as separate WindowGroups
// with proper macOS window chrome (red/yellow/green buttons)
struct PopupContainer: ViewModifier {
    func body(content: Content) -> some View {
        // Simply return the content without popup overlays
        // All popups are now proper windows with native controls
        content
    }
}

// Supporting views are defined in `Views/Placeholders.swift` to avoid duplication.

struct AgentActivityView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(appState.activeAgents) { agent in
                    AgentActivityCard(agent: agent)
                }

                if appState.activeAgents.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "person.3")
                            .font(.system(size: 48))
                            .foregroundColor(AppTheme.secondaryText)
                        Text("No Active Agents")
                            .font(.headline)
                            .foregroundColor(AppTheme.secondaryText)
                        Text("Agents will appear here when they're working on tasks")
                            .font(.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                            .multilineTextAlignment(.center)
                    }
                    .padding(.top, 40)
                }
            }
            .padding()
        }
        .background(AppTheme.primaryBackground)
    }
}

// MARK: - Extension for View
extension View {
    func withPopupContainer() -> some View {
        self.modifier(PopupContainer())
    }
}

// MARK: - Preview
struct PopupModal_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            AppTheme.primaryBackground
                .ignoresSafeArea()

            Text("Main Content")
                .foregroundColor(.white)
        }
        .withPopupContainer()
        .frame(width: 1200, height: 800)
        .environmentObject(AppState())
        .environmentObject(APIService())
    }
}
