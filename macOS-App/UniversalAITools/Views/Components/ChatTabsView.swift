import SwiftUI

struct ChatTabsView: View {
    @EnvironmentObject var appState: AppState
    @State private var hoveredTab: SidebarItem?

    var body: some View {
        HStack(spacing: 12) {
            ForEach(quickAccessItems) { item in
                TabButton(
                    item: item,
                    isHovered: hoveredTab == item,
                    onHover: { hoveredTab = $0 ? item : nil },
                    onTap: { appState.selectedSidebarItem = item }
                )
            }

            Spacer()

            // Recent chats dropdown
            if !appState.recentChats.isEmpty {
                RecentChatsButton()
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: AppTheme.mediumRadius)
                .fill(AppTheme.secondaryBackground.opacity(0.5))
        )
    }

    private var quickAccessItems: [SidebarItem] {
        [.chat, .objectives, .tools]
    }
}

// MARK: - Tab Button

struct TabButton: View {
    let item: SidebarItem
    let isHovered: Bool
    let onHover: (Bool) -> Void
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                Image(systemName: item.icon)
                    .font(.system(size: 16))
                    .foregroundColor(isHovered ? AppTheme.accentColor : AppTheme.secondaryText)

                Text(item.title)
                    .font(.caption2)
                    .foregroundColor(isHovered ? AppTheme.primaryText : AppTheme.tertiaryText)
            }
            .frame(width: 60, height: 44)
            .background(
                RoundedRectangle(cornerRadius: AppTheme.smallRadius)
                    .fill(isHovered ? AppTheme.controlBackground : Color.clear)
            )
        }
        .buttonStyle(.plain)
        .onHover(perform: onHover)
    }
}

// MARK: - Recent Chats Button

struct RecentChatsButton: View {
    @EnvironmentObject var appState: AppState
    @State private var showingPopover = false

    var body: some View {
        Button(action: { showingPopover.toggle() }) {
            HStack(spacing: 4) {
                Image(systemName: "clock")
                    .font(.caption)
                Text("Recent")
                    .font(.caption)
                Image(systemName: "chevron.down")
                    .font(.caption2)
            }
            .foregroundColor(AppTheme.secondaryText)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(
                RoundedRectangle(cornerRadius: AppTheme.smallRadius)
                    .fill(AppTheme.controlBackground)
            )
        }
        .buttonStyle(.plain)
        .popover(isPresented: $showingPopover) {
            RecentChatsPopover()
                .frame(width: 250, height: 300)
        }
    }
}

// MARK: - Recent Chats Popover

struct RecentChatsPopover: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Recent Chats")
                .font(.headline)
                .padding()

            Divider()

            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(appState.recentChats) { chat in
                        RecentChatRow(chat: chat) {
                            appState.currentChat = chat
                        }
                    }
                }
                .padding()
            }
        }
        .background(AppTheme.primaryBackground)
    }
}
