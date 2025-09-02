import SwiftUI

/// Main Content View - Apple-Inspired Modern Design
struct ContentView: View {
    @EnvironmentObject private var appState: AppState
    @State private var selectedTab = 0
    @State private var showVoiceInterface = false

    var body: some View {
        ZStack {
            // Dynamic Background
            backgroundView

            VStack(spacing: 0) {
                // Main Content Area
                mainContentArea

                // Bottom Navigation
                bottomNavigationBar
            }
        }
        .sheet(isPresented: $showVoiceInterface) {
            VoiceInterfaceView()
                #if os(iOS)
                .presentationDetents([.fraction(0.6)])
                .presentationBackground(.ultraThinMaterial)
                #endif
        }
        .overlay(alignment: .top) {
            if !appState.notifications.isEmpty {
                notificationBanner
            }
        }
    }

    // MARK: - Background View
    private var backgroundView: some View {
        ZStack {
            // Base gradient
            LinearGradient(
                colors: [
                    Color.blue.opacity(0.1),
                    Color.purple.opacity(0.05),
                    Color.clear
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            // Subtle pattern overlay
            GeometryReader { geometry in
                Path { path in
                    let width = geometry.size.width
                    let height = geometry.size.height

                    for i in 0..<20 {
                        let x = CGFloat(i) * (width / 20)
                        path.move(to: CGPoint(x: x, y: 0))
                        path.addLine(to: CGPoint(x: x, y: height))
                    }
                }
                .stroke(Color.white.opacity(0.02), lineWidth: 0.5)
            }
        }
    }

    // MARK: - Main Content Area
    private var mainContentArea: some View {
        TabView(selection: $selectedTab) {
            DashboardView()
                .tag(0)

            VoiceView(showVoiceInterface: $showVoiceInterface)
                .tag(1)
            
            VisionView()
                .tag(2)

            NotificationView()
                .tag(3)

            SettingsView()
                .tag(4)
        }
        #if os(iOS)
        .tabViewStyle(.page(indexDisplayMode: .never))
        #endif
        .ignoresSafeArea(edges: .bottom)
    }

    // MARK: - Bottom Navigation
    private var bottomNavigationBar: some View {
        VStack(spacing: 0) {
            Divider()
                .background(Color.white.opacity(0.1))

            HStack(spacing: 0) {
                ForEach(0..<5) { index in
                    TabBarItem(
                        icon: tabIcon(for: index),
                        title: tabTitle(for: index),
                        isSelected: selectedTab == index,
                        badgeCount: badgeCount(for: index)
                    )
                    .onTapGesture {
                        // Add haptic feedback
                        #if os(iOS)
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        #endif

                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            selectedTab = index
                        }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .overlay(
                RoundedRectangle(cornerRadius: 25)
                    .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
                    .padding(1)
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 8)
        }
    }

    // MARK: - Notification Banner
    private var notificationBanner: some View {
        VStack {
            if let notification = appState.notifications.first {
                NotificationBanner(notification: notification) {
                    appState.notifications.removeFirst()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
            }
            Spacer()
        }
        .padding(.top, 8)
    }

    // MARK: - Helper Methods
    private func tabIcon(for index: Int) -> String {
        switch index {
        case 0: return "house.fill"
        case 1: return "waveform"
        case 2: return "camera.fill"
        case 3: return "bell.fill"
        case 4: return "gear"
        default: return "circle"
        }
    }

    private func tabTitle(for index: Int) -> String {
        switch index {
        case 0: return "Dashboard"
        case 1: return "Voice"
        case 2: return "Vision"
        case 3: return "Notifications"
        case 4: return "Settings"
        default: return ""
        }
    }

    private func badgeCount(for index: Int) -> Int {
        switch index {
        case 3: return appState.notifications.count
        default: return 0
        }
    }
}

// MARK: - Tab Bar Item Component
struct TabBarItem: View {
    let icon: String
    let title: String
    let isSelected: Bool
    let badgeCount: Int

    init(icon: String, title: String, isSelected: Bool, badgeCount: Int = 0) {
        self.icon = icon
        self.title = title
        self.isSelected = isSelected
        self.badgeCount = badgeCount
    }

    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                if isSelected {
                    Circle()
                        .fill(Color.blue.opacity(0.2))
                        .frame(width: 32, height: 32)
                }

                Image(systemName: icon)
                    .font(.system(size: 18, weight: isSelected ? .semibold : .regular))
                    .foregroundStyle(isSelected ? Color.blue : Color.gray)
                    .scaleEffect(isSelected ? 1.1 : 1.0)
                    .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isSelected)

                // Badge
                if badgeCount > 0 {
                    ZStack {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 18, height: 18)

                        Text("\(min(badgeCount, 99))")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                    }
                    .offset(x: 12, y: -8)
                    .transition(.scale.combined(with: .opacity))
                }
            }

            Text(title)
                .font(.system(size: 10, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Color.blue : Color.gray)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}

// MARK: - Notification Banner
struct NotificationBanner: View {
    let notification: AppState.AppNotification
    let onDismiss: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: notificationIcon)
                .foregroundStyle(notificationColor)

            VStack(alignment: .leading, spacing: 2) {
                Text(notification.title)
                    .font(.system(size: 14, weight: .semibold))

                Text(notification.message)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, 16)
        .shadow(color: Color.black.opacity(0.1), radius: 8, x: 0, y: 4)
    }

    private var notificationIcon: String {
        switch notification.type {
        case .info: return "info.circle.fill"
        case .success: return "checkmark.circle.fill"
        case .warning: return "exclamationmark.triangle.fill"
        case .error: return "xmark.circle.fill"
        }
    }

    private var notificationColor: Color {
        switch notification.type {
        case .info: return .blue
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }
}
