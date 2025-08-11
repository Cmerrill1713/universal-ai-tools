import SwiftUI

struct MessageListView: View {
    @EnvironmentObject var appState: AppState
    let isGenerating: Bool
    let onRegenerate: () -> Void

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 20) {
                    if (appState.currentChat?.messages.isEmpty ?? true) && !isGenerating {
                        VStack(spacing: 8) {
                            Image(systemName: "text.bubble").font(.title).foregroundColor(.secondary)
                            Text("Start a new conversation").font(.headline)
                            Text("Type a message below to begin.").font(.caption).foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 40)
                    } else {
                        ForEach(appState.currentChat?.messages ?? []) { message in
                            InterfaceMessageBubble(message: message, onRegenerate: onRegenerate)
                                .id(message.id)
                        }
                    }

                    if isGenerating {
                        GeneratingIndicator()
                    }

                    Color.clear.frame(height: 220)
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .padding(.bottom, 8)
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
            }
            .background(AppTheme.primaryBackground)
            .onChange(of: appState.currentChat?.messages.count) { _ in
                withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                    proxy.scrollTo(appState.currentChat?.messages.last?.id, anchor: .bottom)
                }
            }
        }
    }
}


