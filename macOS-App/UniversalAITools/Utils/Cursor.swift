import SwiftUI
import AppKit

enum HoverCursor {
    case pointingHand
    case crosshair
    case arrow
    case custom(NSCursor)
}

private struct HoverCursorModifier: ViewModifier {
    let cursor: HoverCursor

    func body(content: Content) -> some View {
        content.onHover { isHovering in
            if isHovering {
                switch cursor {
                case .pointingHand:
                    NSCursor.pointingHand.push()
                case .crosshair:
                    NSCursor.crosshair.push()
                case .arrow:
                    NSCursor.arrow.push()
                case .custom(let c):
                    c.push()
                }
            } else {
                NSCursor.pop()
            }
        }
    }
}

extension View {
    func hoverCursor(_ cursor: HoverCursor) -> some View {
        modifier(HoverCursorModifier(cursor: cursor))
    }
}


