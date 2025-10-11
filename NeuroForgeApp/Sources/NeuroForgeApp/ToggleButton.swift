import SwiftUI

struct ToggleButton: View {
    let icon: String
    @Binding var isOn: Bool
    let color: Color
    
    var body: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.15)) {
                isOn.toggle()
            }
        }) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(isOn ? .white : .secondary)
                .frame(width: 24, height: 24)
                .background(
                    Circle()
                        .fill(isOn ? color : Color.clear)
                        .overlay(
                            Circle()
                                .stroke(isOn ? color : Color.secondary.opacity(0.3), lineWidth: 1)
                        )
                )
        }
        .buttonStyle(.plain)
        .help(isOn ? "Disable" : "Enable")
    }
}

#Preview {
    HStack {
        ToggleButton(icon: "safari.fill", isOn: .constant(true), color: .blue)
        ToggleButton(icon: "eye.fill", isOn: .constant(false), color: .purple)
        ToggleButton(icon: "mic.fill", isOn: .constant(true), color: .green)
    }
    .padding()
}
