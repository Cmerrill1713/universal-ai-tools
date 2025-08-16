//
//  NotificationCenter.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import UserNotifications
import AppKit
import Combine
import AudioToolbox

@MainActor
class NotificationManager: NSObject, ObservableObject {
    static let shared = NotificationManager()
    
    // MARK: - Published Properties
    @Published var notifications: [AppNotification] = []
    @Published var unreadCount: Int = 0
    @Published var isDoNotDisturbEnabled: Bool = false
    @Published var notificationRules: [NotificationRule] = []
    @Published var notificationHistory: [AppNotification] = []
    @Published var soundEnabled: Bool = true
    @Published var hapticEnabled: Bool = true
    @Published var desktopNotificationsEnabled: Bool = true
    @Published var groupedNotifications: [NotificationGroup] = []
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private let maxNotifications = 100
    private let maxHistory = 500
    private var notificationQueue = DispatchQueue(label: "com.universalaitools.notifications", qos: .userInteractive)
    private var doNotDisturbSchedule: DoNotDisturbSchedule?
    private var currentPriority: NotificationPriority = .normal
    
    // MARK: - Initialization
    private override init() {
        super.init()
        
        setupNotificationCenter()
        loadNotificationSettings()
        loadNotificationRules()
        setupDoNotDisturbSchedule()
        requestNotificationPermissions()
    }
    
    // MARK: - Public Interface
    
    /// Show a notification
    func showNotification(
        title: String,
        message: String,
        category: NotificationCategory,
        priority: NotificationPriority = .normal,
        actionable: Bool = false,
        actions: [NotificationAction] = [],
        data: [String: Any] = [:]
    ) {
        let notification = AppNotification(
            id: UUID().uuidString,
            title: title,
            message: message,
            category: category,
            priority: priority,
            timestamp: Date(),
            isRead: false,
            actionable: actionable,
            actions: actions,
            data: data
        )
        
        processNotification(notification)
    }
    
    /// Show success notification
    func showSuccess(_ title: String, message: String = "") {
        showNotification(
            title: title,
            message: message,
            category: .success,
            priority: .normal
        )
    }
    
    /// Show error notification
    func showError(_ title: String, message: String = "") {
        showNotification(
            title: title,
            message: message,
            category: .error,
            priority: .high
        )
    }
    
    /// Show warning notification
    func showWarning(_ title: String, message: String = "") {
        showNotification(
            title: title,
            message: message,
            category: .warning,
            priority: .medium
        )
    }
    
    /// Show info notification
    func showInfo(_ title: String, message: String = "") {
        showNotification(
            title: title,
            message: message,
            category: .info,
            priority: .low
        )
    }
    
    /// Show system notification
    func showSystemNotification(_ title: String, message: String = "", priority: NotificationPriority = .normal) {
        showNotification(
            title: title,
            message: message,
            category: .system,
            priority: priority
        )
    }
    
    /// Show actionable notification
    func showActionableNotification(
        title: String,
        message: String,
        category: NotificationCategory,
        actions: [NotificationAction],
        priority: NotificationPriority = .normal
    ) {
        showNotification(
            title: title,
            message: message,
            category: category,
            priority: priority,
            actionable: true,
            actions: actions
        )
    }
    
    /// Mark notification as read
    func markAsRead(_ notificationId: String) {
        if let index = notifications.firstIndex(where: { $0.id == notificationId }) {
            notifications[index].isRead = true
            updateUnreadCount()
        }
        
        if let index = notificationHistory.firstIndex(where: { $0.id == notificationId }) {
            notificationHistory[index].isRead = true
        }
    }
    
    /// Mark all notifications as read
    func markAllAsRead() {
        for index in notifications.indices {
            notifications[index].isRead = true
        }
        
        for index in notificationHistory.indices {
            notificationHistory[index].isRead = true
        }
        
        updateUnreadCount()
    }
    
    /// Dismiss notification
    func dismissNotification(_ notificationId: String) {
        notifications.removeAll { $0.id == notificationId }
        updateUnreadCount()
        
        // Remove from macOS notification center if present
        UNUserNotificationCenter.current().removeDeliveredNotifications(withIdentifiers: [notificationId])
    }
    
    /// Dismiss all notifications
    func dismissAllNotifications() {
        notifications.removeAll()
        updateUnreadCount()
        
        // Clear macOS notification center
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }
    
    /// Toggle Do Not Disturb mode
    func toggleDoNotDisturb() {
        isDoNotDisturbEnabled.toggle()
        saveNotificationSettings()
        
        if isDoNotDisturbEnabled {
            showInfo("Do Not Disturb Enabled", message: "Notifications will be suppressed")
        } else {
            showInfo("Do Not Disturb Disabled", message: "Notifications will be shown normally")
        }
    }
    
    /// Set Do Not Disturb schedule
    func setDoNotDisturbSchedule(_ schedule: DoNotDisturbSchedule?) {
        doNotDisturbSchedule = schedule
        saveNotificationSettings()
    }
    
    /// Add notification rule
    func addNotificationRule(_ rule: NotificationRule) {
        notificationRules.append(rule)
        saveNotificationRules()
    }
    
    /// Remove notification rule
    func removeNotificationRule(_ ruleId: String) {
        notificationRules.removeAll { $0.id == ruleId }
        saveNotificationRules()
    }
    
    /// Update notification rule
    func updateNotificationRule(_ rule: NotificationRule) {
        if let index = notificationRules.firstIndex(where: { $0.id == rule.id }) {
            notificationRules[index] = rule
            saveNotificationRules()
        }
    }
    
    /// Enable/disable sound notifications
    func setSoundEnabled(_ enabled: Bool) {
        soundEnabled = enabled
        saveNotificationSettings()
    }
    
    /// Enable/disable haptic feedback
    func setHapticEnabled(_ enabled: Bool) {
        hapticEnabled = enabled
        saveNotificationSettings()
    }
    
    /// Enable/disable desktop notifications
    func setDesktopNotificationsEnabled(_ enabled: Bool) {
        desktopNotificationsEnabled = enabled
        saveNotificationSettings()
    }
    
    /// Group notifications by category or sender
    func groupNotifications(_ groupBy: NotificationGrouping) {
        let grouped = Dictionary(grouping: notifications) { notification in
            switch groupBy {
            case .category:
                return notification.category.rawValue
            case .priority:
                return notification.priority.rawValue
            case .time:
                return notification.timeGroup
            case .sender:
                return notification.data["sender"] as? String ?? "Unknown"
            }
        }
        
        groupedNotifications = grouped.map { (key, notifications) in
            NotificationGroup(
                id: key,
                title: key.capitalized,
                notifications: notifications,
                unreadCount: notifications.filter { !$0.isRead }.count
            )
        }.sorted { $0.unreadCount > $1.unreadCount }
    }
    
    /// Clear notification history
    func clearHistory() {
        notificationHistory.removeAll()
        saveNotificationHistory()
    }
    
    /// Get notifications for timeline
    func getNotificationTimeline() -> [NotificationTimelineItem] {
        let allNotifications = (notifications + notificationHistory)
            .sorted { $0.timestamp > $1.timestamp }
        
        return Dictionary(grouping: allNotifications) { notification in
            Calendar.current.startOfDay(for: notification.timestamp)
        }.map { (date, notifications) in
            NotificationTimelineItem(
                date: date,
                notifications: notifications,
                count: notifications.count
            )
        }.sorted { $0.date > $1.date }
    }
    
    // MARK: - Private Implementation
    
    private func processNotification(_ notification: AppNotification) {
        // Apply notification rules
        let processedNotification = applyNotificationRules(notification)
        
        // Check Do Not Disturb
        if shouldSuppressNotification(processedNotification) {
            addToHistory(processedNotification)
            return
        }
        
        // Add to notifications list
        addNotification(processedNotification)
        
        // Show desktop notification if enabled
        if desktopNotificationsEnabled {
            showDesktopNotification(processedNotification)
        }
        
        // Play sound if enabled
        if soundEnabled {
            playNotificationSound(for: processedNotification.category)
        }
        
        // Haptic feedback if enabled
        if hapticEnabled {
            provideHapticFeedback(for: processedNotification.priority)
        }
        
        // Add to history
        addToHistory(processedNotification)
    }
    
    private func applyNotificationRules(_ notification: AppNotification) -> AppNotification {
        var modifiedNotification = notification
        
        for rule in notificationRules where rule.isEnabled {
            if rule.matches(notification) {
                modifiedNotification = rule.apply(to: modifiedNotification)
            }
        }
        
        return modifiedNotification
    }
    
    private func shouldSuppressNotification(_ notification: AppNotification) -> Bool {
        // Check Do Not Disturb mode
        if isDoNotDisturbEnabled {
            // Allow critical notifications through
            return notification.priority != .critical
        }
        
        // Check Do Not Disturb schedule
        if let schedule = doNotDisturbSchedule,
           schedule.isActive {
            return notification.priority != .critical
        }
        
        return false
    }
    
    private func addNotification(_ notification: AppNotification) {
        notifications.insert(notification, at: 0)
        
        // Limit notifications count
        if notifications.count > maxNotifications {
            notifications.removeLast(notifications.count - maxNotifications)
        }
        
        updateUnreadCount()
        groupNotifications(.category)
    }
    
    private func addToHistory(_ notification: AppNotification) {
        notificationHistory.insert(notification, at: 0)
        
        // Limit history count
        if notificationHistory.count > maxHistory {
            notificationHistory.removeLast(notificationHistory.count - maxHistory)
        }
        
        saveNotificationHistory()
    }
    
    private func updateUnreadCount() {
        unreadCount = notifications.filter { !$0.isRead }.count
        
        // Update app badge count
        NSApp.dockTile.badgeLabel = unreadCount > 0 ? "\(unreadCount)" : nil
    }
    
    private func showDesktopNotification(_ notification: AppNotification) {
        let content = UNMutableNotificationContent()
        content.title = notification.title
        content.body = notification.message
        content.categoryIdentifier = notification.category.rawValue
        content.userInfo = ["notificationId": notification.id]
        
        // Set sound
        if soundEnabled {
            content.sound = UNNotificationSound.default
        }
        
        // Add actions if actionable
        if notification.actionable {
            let actions = notification.actions.map { action in
                UNNotificationAction(
                    identifier: action.id,
                    title: action.title,
                    options: action.destructive ? [.destructive] : []
                )
            }
            
            let category = UNNotificationCategory(
                identifier: notification.category.rawValue,
                actions: actions,
                intentIdentifiers: []
            )
            
            UNUserNotificationCenter.current().setNotificationCategories([category])
        }
        
        let request = UNNotificationRequest(
            identifier: notification.id,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("Failed to show desktop notification: \(error)")
            }
        }
    }
    
    private func playNotificationSound(for category: NotificationCategory) {
        let soundId: SystemSoundID
        
        switch category {
        case .error:
            soundId = 1006 // Error sound
        case .warning:
            soundId = 1005 // Alert sound
        case .success:
            soundId = 1004 // Glass sound
        default:
            soundId = 1000 // Default system sound
        }
        
        AudioServicesPlaySystemSound(soundId)
    }
    
    private func provideHapticFeedback(for priority: NotificationPriority) {
        // macOS doesn't have haptic feedback like iOS, but we can use visual feedback
        NSHapticFeedbackManager.defaultPerformer.perform(
            .alignment,
            performanceTime: .now
        )
    }
    
    private func setupNotificationCenter() {
        UNUserNotificationCenter.current().delegate = self
        
        // Setup notification categories
        let categories = NotificationCategory.allCases.map { category in
            UNNotificationCategory(
                identifier: category.rawValue,
                actions: [],
                intentIdentifiers: []
            )
        }
        
        UNUserNotificationCenter.current().setNotificationCategories(Set(categories))
    }
    
    private func requestNotificationPermissions() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                self.desktopNotificationsEnabled = granted
            }
            
            if let error = error {
                print("Failed to request notification permissions: \(error)")
            }
        }
    }
    
    private func loadNotificationSettings() {
        let defaults = UserDefaults.standard
        isDoNotDisturbEnabled = defaults.bool(forKey: "NotificationDoNotDisturb")
        soundEnabled = defaults.object(forKey: "NotificationSoundEnabled") as? Bool ?? true
        hapticEnabled = defaults.object(forKey: "NotificationHapticEnabled") as? Bool ?? true
        desktopNotificationsEnabled = defaults.object(forKey: "NotificationDesktopEnabled") as? Bool ?? true
        
        // Load Do Not Disturb schedule
        if let scheduleData = defaults.data(forKey: "NotificationDNDSchedule"),
           let schedule = try? JSONDecoder().decode(DoNotDisturbSchedule.self, from: scheduleData) {
            doNotDisturbSchedule = schedule
        }
    }
    
    private func saveNotificationSettings() {
        let defaults = UserDefaults.standard
        defaults.set(isDoNotDisturbEnabled, forKey: "NotificationDoNotDisturb")
        defaults.set(soundEnabled, forKey: "NotificationSoundEnabled")
        defaults.set(hapticEnabled, forKey: "NotificationHapticEnabled")
        defaults.set(desktopNotificationsEnabled, forKey: "NotificationDesktopEnabled")
        
        // Save Do Not Disturb schedule
        if let schedule = doNotDisturbSchedule,
           let data = try? JSONEncoder().encode(schedule) {
            defaults.set(data, forKey: "NotificationDNDSchedule")
        }
    }
    
    private func loadNotificationRules() {
        if let data = UserDefaults.standard.data(forKey: "NotificationRules"),
           let rules = try? JSONDecoder().decode([NotificationRule].self, from: data) {
            notificationRules = rules
        }
    }
    
    private func saveNotificationRules() {
        if let data = try? JSONEncoder().encode(notificationRules) {
            UserDefaults.standard.set(data, forKey: "NotificationRules")
        }
    }
    
    private func saveNotificationHistory() {
        // Only save last 100 history items for performance
        let recentHistory = Array(notificationHistory.prefix(100))
        
        if let data = try? JSONEncoder().encode(recentHistory) {
            UserDefaults.standard.set(data, forKey: "NotificationHistory")
        }
    }
    
    private func setupDoNotDisturbSchedule() {
        // Check schedule every minute
        Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { _ in
            if let schedule = self.doNotDisturbSchedule {
                let wasEnabled = self.isDoNotDisturbEnabled
                let shouldBeEnabled = schedule.isActive
                
                if wasEnabled != shouldBeEnabled {
                    self.isDoNotDisturbEnabled = shouldBeEnabled
                }
            }
        }
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationManager: UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notification even when app is in foreground
        completionHandler([.banner, .sound, .badge])
    }
    
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let notificationId = response.notification.request.content.userInfo["notificationId"] as? String
        let actionId = response.actionIdentifier
        
        // Handle notification action
        if let notificationId = notificationId {
            handleNotificationAction(notificationId: notificationId, actionId: actionId)
        }
        
        completionHandler()
    }
    
    private func handleNotificationAction(notificationId: String, actionId: String) {
        guard let notification = notifications.first(where: { $0.id == notificationId }) else {
            return
        }
        
        // Mark as read
        markAsRead(notificationId)
        
        // Handle action
        if actionId == UNNotificationDefaultActionIdentifier {
            // Default action - bring app to foreground
            NSApp.activate(ignoringOtherApps: true)
        } else if let action = notification.actions.first(where: { $0.id == actionId }) {
            // Custom action
            action.handler?()
        }
    }
}

// MARK: - Notification Views

struct NotificationCenterView: View {
    @StateObject private var notificationManager = NotificationManager.shared
    @State private var selectedTab: NotificationTab = .inbox
    @State private var showingSettings = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Notifications")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Spacer()
                
                HStack(spacing: 10) {
                    Button("Mark All Read") {
                        notificationManager.markAllAsRead()
                    }
                    .disabled(notificationManager.unreadCount == 0)
                    
                    Button("Clear All") {
                        notificationManager.dismissAllNotifications()
                    }
                    .disabled(notificationManager.notifications.isEmpty)
                    
                    Button("Settings") {
                        showingSettings = true
                    }
                }
            }
            .padding()
            
            // Tabs
            Picker("View", selection: $selectedTab) {
                ForEach(NotificationTab.allCases, id: \.self) { tab in
                    Text(tab.displayName).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            
            Divider()
            
            // Content
            ScrollView {
                LazyVStack(spacing: 0) {
                    switch selectedTab {
                    case .inbox:
                        NotificationInboxView()
                    case .grouped:
                        GroupedNotificationView()
                    case .history:
                        NotificationHistoryView()
                    case .timeline:
                        NotificationTimelineView()
                    }
                }
            }
        }
        .sheet(isPresented: $showingSettings) {
            NotificationSettingsView()
        }
    }
}

struct NotificationInboxView: View {
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        if notificationManager.notifications.isEmpty {
            VStack(spacing: 20) {
                Image(systemName: "bell")
                    .font(.system(size: 50))
                    .foregroundColor(.secondary)
                
                Text("No Notifications")
                    .font(.title2)
                
                Text("You're all caught up!")
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding()
        } else {
            ForEach(notificationManager.notifications) { notification in
                NotificationRowView(notification: notification)
                Divider()
            }
        }
    }
}

struct GroupedNotificationView: View {
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        ForEach(notificationManager.groupedNotifications) { group in
            NotificationGroupView(group: group)
        }
    }
}

struct NotificationHistoryView: View {
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Notification History")
                    .font(.headline)
                    .padding(.horizontal)
                
                Spacer()
                
                Button("Clear History") {
                    notificationManager.clearHistory()
                }
                .padding(.horizontal)
            }
            .padding(.top)
            
            if notificationManager.notificationHistory.isEmpty {
                VStack(spacing: 20) {
                    Image(systemName: "clock")
                        .font(.system(size: 40))
                        .foregroundColor(.secondary)
                    
                    Text("No History")
                        .font(.title2)
                    
                    Text("Notification history will appear here")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                ForEach(notificationManager.notificationHistory.prefix(50)) { notification in
                    NotificationRowView(notification: notification, showTime: true)
                    Divider()
                }
            }
        }
    }
}

struct NotificationTimelineView: View {
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        let timeline = notificationManager.getNotificationTimeline()
        
        if timeline.isEmpty {
            VStack(spacing: 20) {
                Image(systemName: "timeline.selection")
                    .font(.system(size: 40))
                    .foregroundColor(.secondary)
                
                Text("No Timeline Data")
                    .font(.title2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding()
        } else {
            ForEach(timeline, id: \.date) { item in
                NotificationTimelineItemView(item: item)
            }
        }
    }
}

struct NotificationRowView: View {
    let notification: AppNotification
    let showTime: Bool
    
    @StateObject private var notificationManager = NotificationManager.shared
    
    init(notification: AppNotification, showTime: Bool = false) {
        self.notification = notification
        self.showTime = showTime
    }
    
    var body: some View {
        HStack(spacing: 12) {
            // Category icon
            Image(systemName: notification.category.icon)
                .font(.title3)
                .foregroundColor(notification.category.color)
                .frame(width: 30)
            
            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(notification.title)
                        .font(.headline)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    if showTime {
                        Text(notification.timestamp.formatted(.relative(presentation: .named)))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                if !notification.message.isEmpty {
                    Text(notification.message)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                // Actions
                if notification.actionable && !notification.actions.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(notification.actions.prefix(2)) { action in
                            Button(action.title) {
                                action.handler?()
                                notificationManager.markAsRead(notification.id)
                            }
                            .buttonStyle(.bordered)
                            .font(.caption)
                        }
                    }
                    .padding(.top, 4)
                }
            }
            
            VStack {
                // Priority indicator
                if notification.priority != .normal {
                    Circle()
                        .fill(notification.priority.color)
                        .frame(width: 8, height: 8)
                }
                
                Spacer()
                
                // Unread indicator
                if !notification.isRead {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                }
            }
        }
        .padding()
        .background(notification.isRead ? Color.clear : Color.blue.opacity(0.05))
        .onTapGesture {
            if !notification.isRead {
                notificationManager.markAsRead(notification.id)
            }
        }
        .contextMenu {
            Button("Mark as Read") {
                notificationManager.markAsRead(notification.id)
            }
            .disabled(notification.isRead)
            
            Button("Dismiss") {
                notificationManager.dismissNotification(notification.id)
            }
        }
    }
}

struct NotificationGroupView: View {
    let group: NotificationGroup
    @State private var isExpanded = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Group header
            Button {
                isExpanded.toggle()
            } label: {
                HStack {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption)
                    
                    Text(group.title)
                        .font(.headline)
                    
                    Spacer()
                    
                    if group.unreadCount > 0 {
                        Text("\(group.unreadCount)")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.blue)
                            .foregroundColor(.white)
                            .clipShape(Capsule())
                    }
                    
                    Text("\(group.notifications.count)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .background(Color(.controlBackgroundColor))
            
            // Group content
            if isExpanded {
                ForEach(group.notifications) { notification in
                    NotificationRowView(notification: notification)
                    Divider()
                }
            }
        }
    }
}

struct NotificationTimelineItemView: View {
    let item: NotificationTimelineItem
    @State private var isExpanded = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Date header
            Button {
                isExpanded.toggle()
            } label: {
                HStack {
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption)
                    
                    Text(item.date.formatted(date: .abbreviated, time: .omitted))
                        .font(.headline)
                    
                    Spacer()
                    
                    Text("\(item.count) notifications")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding()
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .background(Color(.controlBackgroundColor))
            
            // Timeline content
            if isExpanded {
                ForEach(item.notifications) { notification in
                    NotificationRowView(notification: notification, showTime: true)
                    Divider()
                }
            }
        }
    }
}

struct NotificationSettingsView: View {
    @StateObject private var notificationManager = NotificationManager.shared
    @State private var newRuleName = ""
    @State private var showingRuleCreator = false
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            Form {
                Section("General") {
                    Toggle("Sound Notifications", isOn: $notificationManager.soundEnabled)
                    Toggle("Haptic Feedback", isOn: $notificationManager.hapticEnabled)
                    Toggle("Desktop Notifications", isOn: $notificationManager.desktopNotificationsEnabled)
                }
                
                Section("Do Not Disturb") {
                    Toggle("Enable Do Not Disturb", isOn: $notificationManager.isDoNotDisturbEnabled)
                    
                    // Do Not Disturb schedule settings would go here
                }
                
                Section("Notification Rules") {
                    ForEach(notificationManager.notificationRules) { rule in
                        NotificationRuleRowView(rule: rule)
                    }
                    
                    Button("Add Rule") {
                        showingRuleCreator = true
                    }
                }
            }
            .navigationTitle("Notification Settings")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .frame(width: 500, height: 600)
        .sheet(isPresented: $showingRuleCreator) {
            NotificationRuleCreatorView()
        }
    }
}

struct NotificationRuleRowView: View {
    let rule: NotificationRule
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(rule.name)
                    .font(.headline)
                
                Text(rule.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Toggle("", isOn: Binding(
                get: { rule.isEnabled },
                set: { enabled in
                    var updatedRule = rule
                    updatedRule.isEnabled = enabled
                    notificationManager.updateNotificationRule(updatedRule)
                }
            ))
        }
    }
}

struct NotificationRuleCreatorView: View {
    @State private var name = ""
    @State private var category: NotificationCategory = .info
    @State private var priority: NotificationPriority = .normal
    @State private var action: NotificationRuleAction = .allow
    @Environment(\.dismiss) private var dismiss
    @StateObject private var notificationManager = NotificationManager.shared
    
    var body: some View {
        NavigationView {
            Form {
                Section("Rule Details") {
                    TextField("Rule Name", text: $name)
                    
                    Picker("Category", selection: $category) {
                        ForEach(NotificationCategory.allCases, id: \.self) { cat in
                            Text(cat.displayName).tag(cat)
                        }
                    }
                    
                    Picker("Priority", selection: $priority) {
                        ForEach(NotificationPriority.allCases, id: \.self) { pri in
                            Text(pri.displayName).tag(pri)
                        }
                    }
                    
                    Picker("Action", selection: $action) {
                        ForEach(NotificationRuleAction.allCases, id: \.self) { act in
                            Text(act.displayName).tag(act)
                        }
                    }
                }
            }
            .navigationTitle("Create Rule")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                
                ToolbarItem(placement: .primaryAction) {
                    Button("Save") {
                        let rule = NotificationRule(
                            id: UUID().uuidString,
                            name: name,
                            description: "Rule for \(category.displayName) notifications",
                            category: category,
                            priority: priority,
                            action: action,
                            isEnabled: true
                        )
                        
                        notificationManager.addNotificationRule(rule)
                        dismiss()
                    }
                    .disabled(name.isEmpty)
                }
            }
        }
        .frame(width: 400, height: 300)
    }
}

// MARK: - Supporting Types

enum NotificationTab: CaseIterable {
    case inbox
    case grouped
    case history
    case timeline
    
    var displayName: String {
        switch self {
        case .inbox: return "Inbox"
        case .grouped: return "Grouped"
        case .history: return "History"
        case .timeline: return "Timeline"
        }
    }
}

enum NotificationCategory: String, CaseIterable, Codable {
    case info
    case success
    case warning
    case error
    case system
    case chat
    case update
    case security
    
    var displayName: String {
        switch self {
        case .info: return "Info"
        case .success: return "Success"
        case .warning: return "Warning"
        case .error: return "Error"
        case .system: return "System"
        case .chat: return "Chat"
        case .update: return "Update"
        case .security: return "Security"
        }
    }
    
    var icon: String {
        switch self {
        case .info: return "info.circle"
        case .success: return "checkmark.circle"
        case .warning: return "exclamationmark.triangle"
        case .error: return "xmark.circle"
        case .system: return "gear"
        case .chat: return "message"
        case .update: return "arrow.clockwise"
        case .security: return "lock.shield"
        }
    }
    
    var color: Color {
        switch self {
        case .info: return .blue
        case .success: return .green
        case .warning: return .orange
        case .error: return .red
        case .system: return .gray
        case .chat: return .purple
        case .update: return .cyan
        case .security: return .yellow
        }
    }
}

enum NotificationPriority: String, CaseIterable, Codable {
    case low
    case normal
    case medium
    case high
    case critical
    
    var displayName: String {
        switch self {
        case .low: return "Low"
        case .normal: return "Normal"
        case .medium: return "Medium"
        case .high: return "High"
        case .critical: return "Critical"
        }
    }
    
    var color: Color {
        switch self {
        case .low: return .gray
        case .normal: return .blue
        case .medium: return .yellow
        case .high: return .orange
        case .critical: return .red
        }
    }
}

enum NotificationGrouping {
    case category
    case priority
    case time
    case sender
}

enum NotificationRuleAction: String, CaseIterable, Codable {
    case allow
    case suppress
    case modify
    case prioritize
    
    var displayName: String {
        switch self {
        case .allow: return "Allow"
        case .suppress: return "Suppress"
        case .modify: return "Modify"
        case .prioritize: return "Prioritize"
        }
    }
}

struct AppNotification: Identifiable, Codable {
    let id: String
    let title: String
    let message: String
    let category: NotificationCategory
    let priority: NotificationPriority
    let timestamp: Date
    var isRead: Bool
    let actionable: Bool
    let actions: [NotificationAction]
    let data: [String: Any]
    
    var timeGroup: String {
        let calendar = Calendar.current
        let now = Date()
        
        if calendar.isDateInToday(timestamp) {
            return "Today"
        } else if calendar.isDateInYesterday(timestamp) {
            return "Yesterday"
        } else if calendar.isDate(timestamp, equalTo: now, toGranularity: .weekOfYear) {
            return "This Week"
        } else {
            return "Older"
        }
    }
    
    enum CodingKeys: String, CodingKey {
        case id, title, message, category, priority, timestamp, isRead, actionable, actions
    }
    
    init(id: String, title: String, message: String, category: NotificationCategory, priority: NotificationPriority, timestamp: Date, isRead: Bool, actionable: Bool, actions: [NotificationAction], data: [String: Any]) {
        self.id = id
        self.title = title
        self.message = message
        self.category = category
        self.priority = priority
        self.timestamp = timestamp
        self.isRead = isRead
        self.actionable = actionable
        self.actions = actions
        self.data = data
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        message = try container.decode(String.self, forKey: .message)
        category = try container.decode(NotificationCategory.self, forKey: .category)
        priority = try container.decode(NotificationPriority.self, forKey: .priority)
        timestamp = try container.decode(Date.self, forKey: .timestamp)
        isRead = try container.decode(Bool.self, forKey: .isRead)
        actionable = try container.decode(Bool.self, forKey: .actionable)
        actions = try container.decode([NotificationAction].self, forKey: .actions)
        data = [:]
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(message, forKey: .message)
        try container.encode(category, forKey: .category)
        try container.encode(priority, forKey: .priority)
        try container.encode(timestamp, forKey: .timestamp)
        try container.encode(isRead, forKey: .isRead)
        try container.encode(actionable, forKey: .actionable)
        try container.encode(actions, forKey: .actions)
    }
}

struct NotificationAction: Identifiable, Codable {
    let id: String
    let title: String
    let destructive: Bool
    let handler: (() -> Void)?
    
    enum CodingKeys: String, CodingKey {
        case id, title, destructive
    }
    
    init(id: String, title: String, destructive: Bool = false, handler: (() -> Void)? = nil) {
        self.id = id
        self.title = title
        self.destructive = destructive
        self.handler = handler
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        destructive = try container.decode(Bool.self, forKey: .destructive)
        handler = nil
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(destructive, forKey: .destructive)
    }
}

struct NotificationRule: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let category: NotificationCategory?
    let priority: NotificationPriority?
    let action: NotificationRuleAction
    var isEnabled: Bool
    
    func matches(_ notification: AppNotification) -> Bool {
        if let category = category, notification.category != category {
            return false
        }
        
        if let priority = priority, notification.priority != priority {
            return false
        }
        
        return true
    }
    
    func apply(to notification: AppNotification) -> AppNotification {
        var modified = notification
        
        switch action {
        case .allow:
            break // No changes
        case .suppress:
            // This would be handled at a higher level
            break
        case .modify:
            // Could modify title, message, etc.
            break
        case .prioritize:
            // Could change priority
            break
        }
        
        return modified
    }
}

struct NotificationGroup: Identifiable {
    let id: String
    let title: String
    let notifications: [AppNotification]
    let unreadCount: Int
}

struct NotificationTimelineItem {
    let date: Date
    let notifications: [AppNotification]
    let count: Int
}

struct DoNotDisturbSchedule: Codable {
    let startTime: Date
    let endTime: Date
    let daysOfWeek: [Int] // 1-7, Sunday = 1
    let allowCritical: Bool
    
    var isActive: Bool {
        let now = Date()
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: now)
        
        // Check if today is in the schedule
        if !daysOfWeek.contains(weekday) {
            return false
        }
        
        // Check if current time is within the schedule
        let currentTime = calendar.dateComponents([.hour, .minute], from: now)
        let startComponents = calendar.dateComponents([.hour, .minute], from: startTime)
        let endComponents = calendar.dateComponents([.hour, .minute], from: endTime)
        
        let currentMinutes = (currentTime.hour ?? 0) * 60 + (currentTime.minute ?? 0)
        let startMinutes = (startComponents.hour ?? 0) * 60 + (startComponents.minute ?? 0)
        let endMinutes = (endComponents.hour ?? 0) * 60 + (endComponents.minute ?? 0)
        
        if startMinutes <= endMinutes {
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes
        } else {
            // Overnight schedule
            return currentMinutes >= startMinutes || currentMinutes <= endMinutes
        }
    }
}
