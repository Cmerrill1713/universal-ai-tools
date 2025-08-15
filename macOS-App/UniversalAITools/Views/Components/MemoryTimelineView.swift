import SwiftUI

struct MemoryTimelineView: View {
    let events: [MemoryEvent]
    let contexts: [ContextNode]
    
    @State private var selectedEvent: MemoryEvent?
    @State private var selectedSession: String?
    @State private var timeScale: TimeScale = .hour
    @State private var showMemoryUsage = true
    @State private var showSessionGroups = true
    @State private var selectedTimeRange: Date = Date()
    @State private var zoomLevel: Double = 1.0
    @State private var scrollOffset: CGFloat = 0
    @State private var hoveredEvent: String?
    
    // Timeline parameters
    private let eventHeight: CGFloat = 24
    private let sessionGroupHeight: CGFloat = 40
    private let timelineMargin: CGFloat = 60
    private let eventSpacing: CGFloat = 4
    private let minEventWidth: CGFloat = 8
    
    enum TimeScale: String, CaseIterable {
        case minute = "1m"
        case fiveMinutes = "5m"
        case fifteenMinutes = "15m"  
        case hour = "1h"
        case sixHours = "6h"
        case day = "1d"
        case week = "1w"
        
        var displayName: String {
            switch self {
            case .minute: return "1 Minute"
            case .fiveMinutes: return "5 Minutes"
            case .fifteenMinutes: return "15 Minutes"
            case .hour: return "1 Hour"
            case .sixHours: return "6 Hours"
            case .day: return "1 Day"
            case .week: return "1 Week"
            }
        }
        
        var timeInterval: TimeInterval {
            switch self {
            case .minute: return 60
            case .fiveMinutes: return 300
            case .fifteenMinutes: return 900
            case .hour: return 3600
            case .sixHours: return 21600
            case .day: return 86400
            case .week: return 604800
            }
        }
        
        var tickInterval: TimeInterval {
            switch self {
            case .minute: return 10 // 10 seconds
            case .fiveMinutes: return 30 // 30 seconds
            case .fifteenMinutes: return 60 // 1 minute
            case .hour: return 300 // 5 minutes
            case .sixHours: return 1800 // 30 minutes
            case .day: return 3600 // 1 hour
            case .week: return 86400 // 1 day
            }
        }
        
        var majorTickInterval: TimeInterval {
            return timeInterval / 10
        }
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                AppTheme.primaryBackground
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Header with controls
                    headerView
                    
                    // Main timeline area
                    timelineArea(geometry: geometry)
                    
                    // Memory usage chart (if enabled)
                    if showMemoryUsage {
                        memoryUsageChart
                            .frame(height: 120)
                    }
                }
                
                // Event details panel
                if let selectedEvent = selectedEvent {
                    eventDetailsPanel(for: selectedEvent, geometry: geometry)
                }
                
                // Session details panel
                if let selectedSession = selectedSession {
                    sessionDetailsPanel(for: selectedSession, geometry: geometry)
                }
            }
        }
    }
    
    // MARK: - Header View
    
    private var headerView: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Memory Timeline")
                    .font(AppTheme.title3)
                    .fontWeight(.semibold)
                    .foregroundColor(AppTheme.primaryText)
                
                Text("\(filteredEvents.count) events in timeline")
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                // Time scale picker
                Picker("Time Scale", selection: $timeScale) {
                    ForEach(TimeScale.allCases, id: \.self) { scale in
                        Text(scale.displayName).tag(scale)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 120)
                
                // Display options
                Menu("Options") {
                    Toggle("Memory Usage Chart", isOn: $showMemoryUsage)
                    Toggle("Session Groups", isOn: $showSessionGroups)
                    
                    Divider()
                    
                    Button("Reset Zoom") {
                        withAnimation(AppTheme.normalAnimation) {
                            zoomLevel = 1.0
                            scrollOffset = 0
                        }
                    }
                    
                    Button("Go to Now") {
                        scrollToNow()
                    }
                }
                .menuStyle(.borderlessButton)
                
                // Zoom controls
                HStack {
                    Button(action: { zoomIn() }) {
                        Image(systemName: "plus.magnifyingglass")
                            .font(.system(size: 14))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    
                    Button(action: { zoomOut() }) {
                        Image(systemName: "minus.magnifyingglass")
                            .font(.system(size: 14))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(AppTheme.secondaryBackground)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.separator),
            alignment: .bottom
        )
    }
    
    // MARK: - Timeline Area
    
    private func timelineArea(geometry: GeometryProxy) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            ZStack(alignment: .topLeading) {
                // Background and grid
                timelineBackground(width: timelineWidth)
                
                // Time axis
                timeAxis
                
                // Session groups (if enabled)
                if showSessionGroups {
                    sessionGroupsView
                }
                
                // Events
                eventsView
                
                // Current time indicator
                currentTimeIndicator
            }
            .frame(width: max(timelineWidth, geometry.size.width), height: timelineContentHeight)
        }
        .scaleEffect(x: zoomLevel, y: 1.0, anchor: .leading)
        .background(AppTheme.primaryBackground)
    }
    
    // MARK: - Timeline Background and Grid
    
    private func timelineBackground(width: CGFloat) -> some View {
        ZStack {
            // Background
            Rectangle()
                .fill(AppTheme.primaryBackground)
            
            // Grid lines
            ForEach(timeTickPositions, id: \.0) { (position, isMajor) in
                Rectangle()
                    .fill(isMajor ? AppTheme.separator : AppTheme.separator.opacity(0.3))
                    .frame(width: isMajor ? 2 : 1)
                    .position(x: position, y: timelineContentHeight / 2)
            }
        }
    }
    
    // MARK: - Time Axis
    
    private var timeAxis: some View {
        ZStack(alignment: .topLeading) {
            // Axis line
            Rectangle()
                .fill(AppTheme.separator)
                .frame(width: timelineWidth, height: 2)
                .position(x: timelineWidth / 2, y: timelineMargin - 10)
            
            // Time labels
            ForEach(timeLabelPositions, id: \.0) { (position, time) in
                VStack(spacing: 2) {
                    Text(formatTimeLabel(time))
                        .font(AppTheme.caption2)
                        .foregroundColor(AppTheme.secondaryText)
                        .rotationEffect(.degrees(-45))
                    
                    Rectangle()
                        .fill(AppTheme.separator)
                        .frame(width: 1, height: 8)
                }
                .position(x: position, y: timelineMargin - 25)
            }
        }
    }
    
    // MARK: - Session Groups View
    
    private var sessionGroupsView: some View {
        ForEach(sessionGroups, id: \.sessionId) { group in
            let groupY = timelineMargin + CGFloat(group.trackIndex) * (sessionGroupHeight + 10)
            let groupWidth = timePosition(for: group.endTime) - timePosition(for: group.startTime)
            
            ZStack(alignment: .leading) {
                // Session background
                RoundedRectangle(cornerRadius: 4)
                    .fill(sessionColor(for: group.sessionId).opacity(0.2))
                    .frame(width: max(groupWidth, 40), height: sessionGroupHeight)
                
                // Session border
                RoundedRectangle(cornerRadius: 4)
                    .stroke(
                        selectedSession == group.sessionId ? AppTheme.accentColor : sessionColor(for: group.sessionId),
                        lineWidth: selectedSession == group.sessionId ? 2 : 1
                    )
                    .frame(width: max(groupWidth, 40), height: sessionGroupHeight)
                
                // Session label
                HStack {
                    Image(systemName: "person.circle")
                        .foregroundColor(sessionColor(for: group.sessionId))
                        .font(.system(size: 12))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(group.sessionId ?? "Unknown Session")
                            .font(AppTheme.caption2)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                            .lineLimit(1)
                        
                        Text("\(group.events.count) events")
                            .font(AppTheme.caption2)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
            }
            .position(x: timePosition(for: group.startTime) + max(groupWidth, 40) / 2, y: groupY + sessionGroupHeight / 2)
            .onTapGesture {
                withAnimation(AppTheme.normalAnimation) {
                    selectedSession = selectedSession == group.sessionId ? nil : group.sessionId
                    selectedEvent = nil
                }
            }
        }
    }
    
    // MARK: - Events View
    
    private var eventsView: some View {
        ForEach(filteredEvents) { event in
            eventView(for: event)
        }
    }
    
    private func eventView(for event: MemoryEvent) -> some View {
        let eventPosition = timePosition(for: event.timestamp)
        let eventY = eventYPosition(for: event)
        let isHovered = hoveredEvent == event.id
        let isSelected = selectedEvent?.id == event.id
        let eventWidth = max(minEventWidth, calculateEventWidth(for: event))
        
        return ZStack {
            // Event rectangle
            RoundedRectangle(cornerRadius: 3)
                .fill(event.action.color.opacity(isSelected ? 1.0 : 0.8))
                .frame(width: eventWidth, height: eventHeight)
                .overlay(
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(
                            isSelected ? AppTheme.primaryText : AppTheme.borderColor,
                            lineWidth: isSelected ? 2 : 1
                        )
                )
                .shadow(
                    color: isHovered ? event.action.color.opacity(0.6) : AppTheme.lightShadow,
                    radius: isHovered ? 4 : 1
                )
            
            // Event icon
            Image(systemName: event.action.icon)
                .font(.system(size: 10))
                .foregroundColor(AppTheme.primaryText)
            
            // Duration indicator (for events with duration)
            if let duration = event.metadata.duration, duration > 0 {
                HStack {
                    Spacer()
                    Rectangle()
                        .fill(AppTheme.primaryText.opacity(0.3))
                        .frame(width: 2, height: eventHeight - 4)
                        .cornerRadius(1)
                }
            }
        }
        .scaleEffect(isHovered ? 1.1 : 1.0)
        .animation(AppTheme.quickAnimation, value: isHovered)
        .position(x: eventPosition, y: eventY)
        .onTapGesture {
            withAnimation(AppTheme.normalAnimation) {
                selectedEvent = selectedEvent?.id == event.id ? nil : event
                selectedSession = nil
            }
        }
        .onHover { hovering in
            hoveredEvent = hovering ? event.id : nil
        }
    }
    
    // MARK: - Current Time Indicator
    
    private var currentTimeIndicator: some View {
        let currentPosition = timePosition(for: Date())
        
        return ZStack {
            // Current time line
            Rectangle()
                .fill(AppTheme.accentColor)
                .frame(width: 2)
                .position(x: currentPosition, y: timelineContentHeight / 2)
            
            // Current time marker
            Circle()
                .fill(AppTheme.accentColor)
                .frame(width: 8, height: 8)
                .position(x: currentPosition, y: timelineMargin - 10)
            
            // "Now" label
            Text("Now")
                .font(AppTheme.caption2)
                .fontWeight(.medium)
                .foregroundColor(AppTheme.accentColor)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(AppTheme.surfaceBackground)
                .cornerRadius(4)
                .position(x: currentPosition, y: timelineMargin - 35)
        }
    }
    
    // MARK: - Memory Usage Chart
    
    private var memoryUsageChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Memory Usage Over Time")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Text("Peak: \(formatMemorySize(calculatePeakMemoryUsage()))")
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            .padding(.horizontal, 20)
            
            // Simplified memory usage visualization
            GeometryReader { geometry in
                let memoryData = generateMemoryUsageData()
                
                ZStack(alignment: .bottomLeading) {
                    // Background
                    Rectangle()
                        .fill(AppTheme.tertiaryBackground.opacity(0.3))
                    
                    // Memory usage area
                    Path { path in
                        guard !memoryData.isEmpty else { return }
                        
                        let maxMemory = memoryData.map { $0.usage }.max() ?? 1
                        let stepX = geometry.size.width / CGFloat(max(memoryData.count - 1, 1))
                        
                        path.move(to: CGPoint(x: 0, y: geometry.size.height))
                        
                        for (index, data) in memoryData.enumerated() {
                            let x = CGFloat(index) * stepX
                            let y = geometry.size.height * (1 - CGFloat(data.usage / maxMemory))
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                        
                        path.addLine(to: CGPoint(x: geometry.size.width, y: geometry.size.height))
                        path.addLine(to: CGPoint(x: 0, y: geometry.size.height))
                    }
                    .fill(
                        LinearGradient(
                            colors: [
                                AppTheme.accentBlue.opacity(0.6),
                                AppTheme.accentBlue.opacity(0.1)
                            ],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    
                    // Memory usage line
                    Path { path in
                        guard !memoryData.isEmpty else { return }
                        
                        let maxMemory = memoryData.map { $0.usage }.max() ?? 1
                        let stepX = geometry.size.width / CGFloat(max(memoryData.count - 1, 1))
                        
                        for (index, data) in memoryData.enumerated() {
                            let x = CGFloat(index) * stepX
                            let y = geometry.size.height * (1 - CGFloat(data.usage / maxMemory))
                            
                            if index == 0 {
                                path.move(to: CGPoint(x: x, y: y))
                            } else {
                                path.addLine(to: CGPoint(x: x, y: y))
                            }
                        }
                    }
                    .stroke(AppTheme.accentBlue, lineWidth: 2)
                }
            }
            .padding(.horizontal, 20)
        }
        .padding(.vertical, 12)
        .background(AppTheme.tertiaryBackground)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.separator),
            alignment: .top
        )
    }
    
    // MARK: - Detail Panels
    
    private func eventDetailsPanel(for event: MemoryEvent, geometry: GeometryProxy) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Event Details")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    HStack {
                        Image(systemName: event.action.icon)
                            .foregroundColor(event.action.color)
                        Text(event.action.rawValue.capitalized)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                
                Spacer()
                
                Button(action: {
                    withAnimation(AppTheme.normalAnimation) {
                        selectedEvent = nil
                    }
                }) {
                    Image(systemName: "xmark")
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Event ID", value: event.id)
                DetailRow(label: "Context ID", value: event.contextId)
                DetailRow(label: "Timestamp", value: event.timestamp.formatted())
                
                if let sessionId = event.sessionId {
                    DetailRow(label: "Session", value: sessionId)
                }
                
                if let duration = event.metadata.duration {
                    DetailRow(label: "Duration", value: formatDuration(duration))
                }
                
                if let userId = event.metadata.userId {
                    DetailRow(label: "User", value: userId)
                }
                
                if let details = event.metadata.details {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Details:")
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text(details)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                }
                
                // Related context info
                if let context = contexts.first(where: { $0.id == event.contextId }) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Related Context:")
                            .font(AppTheme.caption)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        HStack {
                            Image(systemName: context.type.icon)
                                .foregroundColor(context.type.color)
                            Text(String(context.content.prefix(50)))
                                .font(AppTheme.caption)
                                .foregroundColor(AppTheme.secondaryText)
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
        .shadow(color: AppTheme.mediumShadow, radius: 8)
        .frame(width: 320)
        .position(x: geometry.size.width - 180, y: geometry.size.height / 2)
    }
    
    private func sessionDetailsPanel(for sessionId: String, geometry: GeometryProxy) -> some View {
        let sessionEvents = filteredEvents.filter { $0.sessionId == sessionId }
        
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Session Details")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(sessionId)
                        .font(AppTheme.caption)
                        .foregroundColor(sessionColor(for: sessionId))
                }
                
                Spacer()
                
                Button(action: {
                    withAnimation(AppTheme.normalAnimation) {
                        selectedSession = nil
                    }
                }) {
                    Image(systemName: "xmark")
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
            
            VStack(alignment: .leading, spacing: 8) {
                DetailRow(label: "Total Events", value: "\(sessionEvents.count)")
                
                if let startTime = sessionEvents.map({ $0.timestamp }).min(),
                   let endTime = sessionEvents.map({ $0.timestamp }).max() {
                    DetailRow(label: "Duration", value: formatDuration(endTime.timeIntervalSince(startTime)))
                    DetailRow(label: "Start Time", value: startTime.formatted(date: .omitted, time: .shortened))
                    DetailRow(label: "End Time", value: endTime.formatted(date: .omitted, time: .shortened))
                }
                
                // Event breakdown
                let eventsByAction = Dictionary(grouping: sessionEvents) { $0.action }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text("Event Breakdown:")
                        .font(AppTheme.caption)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.primaryText)
                    
                    ForEach(MemoryEvent.MemoryAction.allCases, id: \.self) { action in
                        if let events = eventsByAction[action], !events.isEmpty {
                            HStack {
                                Image(systemName: action.icon)
                                    .foregroundColor(action.color)
                                    .frame(width: 16)
                                
                                Text(action.rawValue.capitalized)
                                    .font(AppTheme.caption)
                                    .foregroundColor(AppTheme.secondaryText)
                                
                                Spacer()
                                
                                Text("\(events.count)")
                                    .font(AppTheme.caption)
                                    .foregroundColor(AppTheme.primaryText)
                            }
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(AppTheme.surfaceBackground)
        .cornerRadius(12)
        .shadow(color: AppTheme.mediumShadow, radius: 8)
        .frame(width: 300)
        .position(x: 170, y: geometry.size.height / 2)
    }
    
    // MARK: - Computed Properties
    
    private var filteredEvents: [MemoryEvent] {
        let now = Date()
        let startTime = now.addingTimeInterval(-timeScale.timeInterval)
        
        return events.filter { event in
            event.timestamp >= startTime && event.timestamp <= now
        }.sorted { $0.timestamp < $1.timestamp }
    }
    
    private var timelineWidth: CGFloat {
        max(800, CGFloat(timeScale.timeInterval / timeScale.tickInterval) * 50)
    }
    
    private var timelineContentHeight: CGFloat {
        let sessionHeight = showSessionGroups ? CGFloat(sessionGroups.count) * (sessionGroupHeight + 10) : 0
        let eventsHeight: CGFloat = 200
        return timelineMargin + sessionHeight + eventsHeight + 40
    }
    
    private var sessionGroups: [SessionGroup] {
        guard showSessionGroups else { return [] }
        
        let groupedEvents = Dictionary(grouping: filteredEvents) { $0.sessionId ?? "unknown" }
        
        return groupedEvents.enumerated().map { (index, element) in
            let (sessionId, events) = element
            let sortedEvents = events.sorted { $0.timestamp < $1.timestamp }
            
            return SessionGroup(
                sessionId: sessionId == "unknown" ? nil : sessionId,
                events: sortedEvents,
                startTime: sortedEvents.first?.timestamp ?? Date(),
                endTime: sortedEvents.last?.timestamp ?? Date(),
                trackIndex: index
            )
        }.sorted { $0.startTime < $1.startTime }
    }
    
    private var timeTickPositions: [(CGFloat, Bool)] {
        let now = Date()
        let startTime = now.addingTimeInterval(-timeScale.timeInterval)
        let tickInterval = timeScale.tickInterval
        let majorTickInterval = timeScale.majorTickInterval
        
        var positions: [(CGFloat, Bool)] = []
        
        var currentTime = startTime
        while currentTime <= now {
            let position = timePosition(for: currentTime)
            let isMajor = currentTime.timeIntervalSince(startTime).truncatingRemainder(dividingBy: majorTickInterval) < tickInterval / 2
            positions.append((position, isMajor))
            currentTime.addTimeInterval(tickInterval)
        }
        
        return positions
    }
    
    private var timeLabelPositions: [(CGFloat, Date)] {
        let now = Date()
        let startTime = now.addingTimeInterval(-timeScale.timeInterval)
        let labelInterval = timeScale.majorTickInterval
        
        var positions: [(CGFloat, Date)] = []
        
        var currentTime = startTime
        while currentTime <= now {
            let position = timePosition(for: currentTime)
            positions.append((position, currentTime))
            currentTime.addTimeInterval(labelInterval)
        }
        
        return positions
    }
    
    // MARK: - Helper Methods
    
    private func timePosition(for time: Date) -> CGFloat {
        let now = Date()
        let startTime = now.addingTimeInterval(-timeScale.timeInterval)
        let progress = time.timeIntervalSince(startTime) / timeScale.timeInterval
        return CGFloat(progress) * timelineWidth
    }
    
    private func eventYPosition(for event: MemoryEvent) -> CGFloat {
        if showSessionGroups {
            // Place event in its session group
            if let sessionGroup = sessionGroups.first(where: { $0.events.contains { $0.id == event.id } }) {
                return timelineMargin + CGFloat(sessionGroup.trackIndex) * (sessionGroupHeight + 10) + sessionGroupHeight / 2
            }
        }
        
        // Default positioning based on event type
        let typeIndex = MemoryEvent.MemoryAction.allCases.firstIndex(of: event.action) ?? 0
        return timelineMargin + 100 + CGFloat(typeIndex) * (eventHeight + eventSpacing)
    }
    
    private func calculateEventWidth(for event: MemoryEvent) -> CGFloat {
        if let duration = event.metadata.duration, duration > 0 {
            let pixelsPerSecond = timelineWidth / CGFloat(timeScale.timeInterval)
            return max(minEventWidth, CGFloat(duration) * pixelsPerSecond)
        }
        return minEventWidth
    }
    
    private func sessionColor(for sessionId: String?) -> Color {
        guard let sessionId = sessionId else { return AppTheme.tertiaryText }
        
        let colors: [Color] = [.blue, .green, .orange, .purple, .pink, .yellow]
        let index = abs(sessionId.hashValue) % colors.count
        return colors[index]
    }
    
    private func formatTimeLabel(_ time: Date) -> String {
        switch timeScale {
        case .minute, .fiveMinutes, .fifteenMinutes:
            return time.formatted(date: .omitted, time: .shortened)
        case .hour, .sixHours:
            return time.formatted(date: .omitted, time: .shortened)
        case .day, .week:
            return time.formatted(date: .abbreviated, time: .omitted)
        }
    }
    
    private func formatDuration(_ duration: TimeInterval) -> String {
        if duration < 60 {
            return String(format: "%.1fs", duration)
        } else if duration < 3600 {
            return String(format: "%.1fm", duration / 60)
        } else {
            return String(format: "%.1fh", duration / 3600)
        }
    }
    
    private func formatMemorySize(_ bytes: Double) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useMB, .useGB]
        formatter.countStyle = .memory
        return formatter.string(fromByteCount: Int64(bytes))
    }
    
    private func generateMemoryUsageData() -> [MemoryUsagePoint] {
        // Mock memory usage data based on events
        let now = Date()
        let startTime = now.addingTimeInterval(-timeScale.timeInterval)
        let step = timeScale.timeInterval / 50
        
        var data: [MemoryUsagePoint] = []
        var currentTime = startTime
        
        while currentTime <= now {
            let eventsAtTime = filteredEvents.filter { 
                abs($0.timestamp.timeIntervalSince(currentTime)) < step 
            }.count
            
            // Simulate memory usage based on event activity
            let baseUsage = 100.0 // MB
            let activityUsage = Double(eventsAtTime) * 50.0
            let usage = baseUsage + activityUsage + Double.random(in: -20...20)
            
            data.append(MemoryUsagePoint(time: currentTime, usage: max(0, usage)))
            currentTime.addTimeInterval(step)
        }
        
        return data
    }
    
    private func calculatePeakMemoryUsage() -> Double {
        let data = generateMemoryUsageData()
        return data.map { $0.usage }.max() ?? 0
    }
    
    // MARK: - Control Methods
    
    private func zoomIn() {
        withAnimation(AppTheme.normalAnimation) {
            zoomLevel = min(zoomLevel * 1.5, 5.0)
        }
    }
    
    private func zoomOut() {
        withAnimation(AppTheme.normalAnimation) {
            zoomLevel = max(zoomLevel / 1.5, 0.5)
        }
    }
    
    private func scrollToNow() {
        withAnimation(AppTheme.normalAnimation) {
            scrollOffset = timelineWidth - 400 // Show "now" towards right side
        }
    }
}

// MARK: - Supporting Types

struct SessionGroup {
    let sessionId: String?
    let events: [MemoryEvent]
    let startTime: Date
    let endTime: Date
    let trackIndex: Int
}

struct MemoryUsagePoint {
    let time: Date
    let usage: Double // in MB
}

#Preview {
    MemoryTimelineView(
        events: [],
        contexts: []
    )
    .frame(width: 1000, height: 600)
}