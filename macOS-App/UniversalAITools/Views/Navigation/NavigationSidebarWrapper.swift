import SwiftUI

/// Wrapper that provides enhanced navigation while maintaining compatibility with existing ModernSidebar interface
struct NavigationSidebarWrapper: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    @StateObject private var navigationService = EnhancedNavigationService()
    @AppStorage("useEnhancedNavigation") private var useEnhancedNavigation = true
    
    var body: some View {
        Group {
            if useEnhancedNavigation {
                EnhancedNavigationSidebar()
                    .environmentObject(appState)
                    .onAppear {
                        setupNavigationService()
                    }
                    .onChange(of: appState.selectedSidebarItem) { newItem in
                        updateNavigationContext(for: newItem)
                    }
            } else {
                ModernSidebar(selection: $selection)
                    .environmentObject(appState)
                    .environmentObject(apiService)
            }
        }
        .overlay(
            // Settings toggle button (hidden in enhanced mode)
            VStack {
                HStack {
                    Spacer()
                    Button(action: {
                        useEnhancedNavigation.toggle()
                    }) {
                        Image(systemName: useEnhancedNavigation ? "sidebar.leading" : "sparkles")
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(AppTheme.tertiaryText)
                            .opacity(0.5)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .help(useEnhancedNavigation ? "Switch to classic navigation" : "Switch to enhanced navigation")
                    .padding(.trailing, 8)
                    .padding(.top, 8)
                }
                Spacer()
            }
            .allowsHitTesting(true)
        )
    }
    
    private func setupNavigationService() {
        // Store reference in app state for global access
        appState.enhancedNavigationService = navigationService
        
        // Migrate existing data
        NavigationIntegration.migrateExistingUserData()
        
        // Update initial context
        updateNavigationContext(for: appState.selectedSidebarItem)
    }
    
    private func updateNavigationContext(for sidebarItem: SidebarItem?) {
        guard useEnhancedNavigation else { return }
        
        // Update breadcrumbs
        let breadcrumbs = NavigationIntegration.generateBreadcrumbs(for: appState)
        navigationService.updateBreadcrumbs(breadcrumbs)
        
        // Generate contextual suggestions
        let suggestions = NavigationIntegration.generateContextualSuggestions(
            for: appState,
            navigationService: navigationService
        )
        navigationService.smartSuggestions = suggestions
    }
}

/// Extension to provide backward compatibility for existing views that expect ModernSidebar
extension NavigationSidebarWrapper {
    
    /// Creates a wrapper that behaves exactly like ModernSidebar
    static func createCompatibleSidebar(selection: Binding<SidebarItem?>) -> some View {
        NavigationSidebarWrapper(selection: selection)
    }
}

/// Drop-in replacement for ModernSidebar that provides enhanced navigation
struct EnhancedModernSidebar: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    var body: some View {
        NavigationSidebarWrapper(selection: $selection)
            .environmentObject(appState)
            .environmentObject(apiService)
    }
}

// MARK: - Preview Support
#if DEBUG
struct NavigationSidebarWrapper_Previews: PreviewProvider {
    static var previews: some View {
        NavigationSidebarWrapper(selection: .constant(.chat))
            .environmentObject(AppState())
            .environmentObject(APIService())
            .frame(width: 300, height: 600)
            .background(AppTheme.primaryBackground)
    }
}
#endif