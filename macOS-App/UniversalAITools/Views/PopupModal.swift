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
                
                // Content area
                content()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
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

// MARK: - Popup Container View
struct PopupContainer: ViewModifier {
    @StateObject private var popupManager = PopupManager.shared
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    func body(content: Content) -> some View {
        ZStack {
            content
            
            if let popup = popupManager.activePopup {
                PopupModal(
                    isPresented: Binding(
                        get: { popupManager.activePopup != nil },
                        set: { if !$0 { popupManager.dismiss() } }
                    ),
                    title: popup.title
                ) {
                    popupContent(for: popup)
                        .frame(
                            width: popup.size.width,
                            height: popup.size.height
                        )
                }
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 0.9)),
                    removal: .opacity.combined(with: .scale(scale: 0.95))
                ))
                .zIndex(1000)
            }
        }
    }
    
    @ViewBuilder
    private func popupContent(for popup: PopupManager.PopupType) -> some View {
        switch popup {
        case .agentSelector:
            AgentSelectorView()
                .environmentObject(appState)
                .environmentObject(apiService)
            
        case .agentMonitor:
            SystemMonitoringView()
                .environmentObject(appState)
            
        case .mlxInterface:
            MLXFineTuningView()
                .environmentObject(appState)
                .environmentObject(apiService)
            
        case .visionInterface:
            VisionProcessingView()
                .environmentObject(appState)
                .environmentObject(apiService)
            
        case .abmcts:
            ABMCTSOrchestrationView()
                .environmentObject(appState)
                .environmentObject(apiService)
            
        case .maltSwarm:
            MALTSwarmControlView()
                .environmentObject(appState)
                .environmentObject(apiService)
            
        case .settings:
            SettingsView()
                .environmentObject(appState)
                .environmentObject(apiService)
            
        case .agentActivity:
            AgentActivityView()
                .environmentObject(appState)
                .environmentObject(apiService)
        }
    }
}

// MARK: - Placeholder Views for Popup Content
struct ABMCTSOrchestrationView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    var body: some View {
        VStack {
            Text("AB-MCTS Orchestration Interface")
                .font(.title)
                .foregroundColor(AppTheme.secondaryText)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(AppTheme.primaryBackground)
    }
}

struct MALTSwarmControlView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    var body: some View {
        VStack {
            Text("MALT Swarm Control Interface")
                .font(.title)
                .foregroundColor(AppTheme.secondaryText)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(AppTheme.primaryBackground)
    }
}

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