import SwiftUI

// MARK: - Action Button Component
struct ActionButton: View {
    let icon: String
    let label: String
    let action: () -> Void
    
    @State private var isHovered = false
    @State private var isPressed = false
    
    var body: some View {
        Button(action: {
            withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                isPressed = true
            }
            
            // Haptic feedback on click
            NSHapticFeedbackManager.defaultPerformer.perform(
                .generic,
                performanceTime: .default
            )
            
            action()
            
            // Reset pressed state after action
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.8)) {
                    isPressed = false
                }
            }
        }) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(iconColor)
                    .rotationEffect(.degrees(isPressed ? 15 : 0))
                    .scaleEffect(isPressed ? 1.2 : (isHovered ? 1.1 : 1.0))
                
                if isHovered || isPressed {
                    Text(label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(textColor)
                        .transition(.asymmetric(
                            insertion: .move(edge: .leading).combined(with: .opacity),
                            removal: .move(edge: .trailing).combined(with: .opacity)
                        ))
                }
            }
            .padding(.horizontal, isHovered ? 10 : 6)
            .padding(.vertical, 6)
            .background(backgroundView)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(borderColor, lineWidth: 1)
                    .opacity(isHovered ? 1.0 : 0.0)
            )
            .shadow(
                color: AppTheme.composerShadow.opacity(isPressed ? 0.3 : (isHovered ? 0.15 : 0.05)),
                radius: isPressed ? 4 : (isHovered ? 3 : 1),
                x: 0,
                y: isPressed ? 2 : 1
            )
        }
        .buttonStyle(PlainButtonStyle())
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .onHover { hovering in
            withAnimation(.spring(response: 0.25, dampingFraction: 0.8)) {
                isHovered = hovering
            }
        }
        .help(label)
    }
    
    // MARK: - Computed Properties
    
    private var iconColor: Color {
        if isPressed {
            return AppTheme.accentGreen
        } else if isHovered {
            return AppTheme.primaryText
        } else {
            return AppTheme.secondaryText
        }
    }
    
    private var textColor: Color {
        if isPressed {
            return AppTheme.accentGreen
        } else {
            return AppTheme.primaryText
        }
    }
    
    private var backgroundView: some View {
        Group {
            if isPressed {
                LinearGradient(
                    gradient: Gradient(colors: [
                        AppTheme.accentGreen.opacity(0.15),
                        AppTheme.accentGreen.opacity(0.1)
                    ]),
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            } else if isHovered {
                AppTheme.surfaceBackground.opacity(0.8)
            } else {
                AppTheme.surfaceBackground.opacity(0.5)
            }
        }
    }
    
    private var borderColor: Color {
        if isPressed {
            return AppTheme.accentGreen.opacity(0.5)
        } else if isHovered {
            return AppTheme.separator.opacity(0.5)
        } else {
            return Color.clear
        }
    }
}

// MARK: - Action Button Style Variants
extension ActionButton {
    enum Style {
        case primary
        case secondary
        case danger
        case success
    }
    
    init(icon: String, label: String, style: Style = .secondary, action: @escaping () -> Void) {
        self.icon = icon
        self.label = label
        self.action = action
    }
}

// MARK: - Common Action Presets
extension ActionButton {
    static func copy(action: @escaping () -> Void) -> ActionButton {
        ActionButton(icon: "doc.on.doc", label: "Copy", action: action)
    }
    
    static func regenerate(action: @escaping () -> Void) -> ActionButton {
        ActionButton(icon: "arrow.clockwise", label: "Regenerate", action: action)
    }
    
    static func share(action: @escaping () -> Void) -> ActionButton {
        ActionButton(icon: "square.and.arrow.up", label: "Share", action: action)
    }
    
    static func edit(action: @escaping () -> Void) -> ActionButton {
        ActionButton(icon: "pencil", label: "Edit", action: action)
    }
    
    static func delete(action: @escaping () -> Void) -> ActionButton {
        ActionButton(icon: "trash", label: "Delete", action: action)
    }
    
    static func favorite(action: @escaping () -> Void) -> ActionButton {
        ActionButton(icon: "star", label: "Favorite", action: action)
    }
}

// MARK: - Preview
struct ActionButton_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            Text("Action Button Components")
                .font(.headline)
                .padding()
            
            HStack(spacing: 12) {
                ActionButton(icon: "doc.on.doc", label: "Copy", action: {
                    print("Copy action")
                })
                
                ActionButton(icon: "arrow.clockwise", label: "Regenerate", action: {
                    print("Regenerate action")
                })
                
                ActionButton(icon: "square.and.arrow.up", label: "Share", action: {
                    print("Share action")
                })
            }
            .padding()
            
            Divider()
            
            Text("Preset Buttons")
                .font(.subheadline)
                .foregroundColor(.secondary)
            
            HStack(spacing: 12) {
                ActionButton.copy {
                    print("Copy preset")
                }
                
                ActionButton.edit {
                    print("Edit preset")
                }
                
                ActionButton.favorite {
                    print("Favorite preset")
                }
                
                ActionButton.delete {
                    print("Delete preset")
                }
            }
            .padding()
            
            Spacer()
        }
        .frame(width: 500, height: 300)
        .background(AppTheme.primaryBackground)
    }
}