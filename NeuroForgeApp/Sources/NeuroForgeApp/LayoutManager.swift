import Foundation
import SwiftUI

class LayoutManager: ObservableObject {
    @Published var inputHeight: CGFloat = 20
    @Published var inputMaxHeight: CGFloat = 60
    @Published var inputPadding: CGFloat = 8
    @Published var cornerRadius: CGFloat = 16
    @Published var buttonSize: CGFloat = 16
    @Published var spacing: CGFloat = 12
    @Published var horizontalPadding: CGFloat = 16
    @Published var verticalPadding: CGFloat = 12
    
    func updateLayout(from message: String) {
        let lowercased = message.lowercased()
        
        // Height adjustments
        if lowercased.contains("taller") || lowercased.contains("increase height") {
            inputHeight = min(inputHeight + 10, 80)
            inputMaxHeight = min(inputMaxHeight + 20, 160)
        } else if lowercased.contains("shorter") || lowercased.contains("decrease height") {
            inputHeight = max(inputHeight - 10, 15)
            inputMaxHeight = max(inputMaxHeight - 20, 30)
        }
        
        // Padding adjustments
        if lowercased.contains("more padding") || lowercased.contains("bigger padding") {
            inputPadding = min(inputPadding + 2, 16)
            horizontalPadding = min(horizontalPadding + 4, 24)
            verticalPadding = min(verticalPadding + 2, 16)
        } else if lowercased.contains("less padding") || lowercased.contains("smaller padding") {
            inputPadding = max(inputPadding - 2, 4)
            horizontalPadding = max(horizontalPadding - 4, 8)
            verticalPadding = max(verticalPadding - 2, 4)
        }
        
        // Corner radius adjustments
        if lowercased.contains("more rounded") || lowercased.contains("rounder") {
            cornerRadius = min(cornerRadius + 4, 24)
        } else if lowercased.contains("less rounded") || lowercased.contains("square") {
            cornerRadius = max(cornerRadius - 4, 4)
        }
        
        // Button size adjustments
        if lowercased.contains("bigger buttons") || lowercased.contains("larger buttons") {
            buttonSize = min(buttonSize + 2, 20)
        } else if lowercased.contains("smaller buttons") || lowercased.contains("tiny buttons") {
            buttonSize = max(buttonSize - 2, 12)
        }
        
        // Spacing adjustments
        if lowercased.contains("more spacing") || lowercased.contains("wider spacing") {
            spacing = min(spacing + 2, 20)
        } else if lowercased.contains("less spacing") || lowercased.contains("tighter spacing") {
            spacing = max(spacing - 2, 4)
        }
        
        print("🎨 Layout updated: height=\(inputHeight)-\(inputMaxHeight), padding=\(inputPadding), radius=\(cornerRadius)")
    }
    
    func resetToDefault() {
        inputHeight = 20
        inputMaxHeight = 60
        inputPadding = 8
        cornerRadius = 16
        buttonSize = 16
        spacing = 12
        horizontalPadding = 16
        verticalPadding = 12
        print("🎨 Layout reset to defaults")
    }
    
    func getLayoutInfo() -> String {
        return """
        Current Layout Settings:
        • Input height: \(inputHeight)-\(inputMaxHeight)px
        • Padding: \(inputPadding)px
        • Corner radius: \(cornerRadius)px
        • Button size: \(buttonSize)px
        • Spacing: \(spacing)px
        • Horizontal padding: \(horizontalPadding)px
        • Vertical padding: \(verticalPadding)px
        """
    }
}
