import Foundation
import SwiftUI

// MARK: - Chart Data Point
struct ChartDataPoint: Identifiable, Codable, Hashable {
    let id: UUID
    let label: String
    let value: Double
    let timestamp: Date
    let category: String?
    let color: String?
    
    init(
        id: UUID = UUID(),
        label: String,
        value: Double,
        timestamp: Date = Date(),
        category: String? = nil,
        color: String? = nil
    ) {
        self.id = id
        self.label = label
        self.value = value
        self.timestamp = timestamp
        self.category = category
        self.color = color
    }
    
    var displayColor: Color {
        if let colorString = color {
            return Color(hex: colorString)
        }
        return .blue
    }
}

// MARK: - Chart Type
enum ChartType: String, CaseIterable {
    case bar = "bar"
    case line = "line"
    case pie = "pie"
    case scatter = "scatter"
    
    var displayName: String {
        switch self {
        case .bar: return "Bar Chart"
        case .line: return "Line Chart"
        case .pie: return "Pie Chart"
        case .scatter: return "Scatter Plot"
        }
    }
    
    var icon: String {
        switch self {
        case .bar: return "chart.bar"
        case .line: return "chart.line.uptrend.xyaxis"
        case .pie: return "chart.pie"
        case .scatter: return "chart.dots.scatter"
        }
    }
}

// Note: Color(hex:) extension is defined in Utils/ModernDesignSystem.swift
