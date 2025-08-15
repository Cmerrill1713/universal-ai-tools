import Foundation
import SwiftUI

// MARK: - View Mode
enum ViewMode: String, CaseIterable, Identifiable, Codable {
    case native = "native"
    case web = "web"
    case hybrid = "hybrid"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .native: return "Native"
        case .web: return "Web"
        case .hybrid: return "Hybrid"
        }
    }
    
    var icon: String {
        switch self {
        case .native: return "app.dashed"
        case .web: return "globe"
        case .hybrid: return "rectangle.split.2x1"
        }
    }
    
    var description: String {
        switch self {
        case .native: return "Native SwiftUI interface"
        case .web: return "Web-based interface"
        case .hybrid: return "Combined native and web"
        }
    }
}