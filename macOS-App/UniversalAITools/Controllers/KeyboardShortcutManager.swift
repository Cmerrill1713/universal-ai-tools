//
//  KeyboardShortcutManager.swift
//  UniversalAITools
//
//  Advanced keyboard control system with customizable shortcuts,
//  chord-based shortcuts, Vi-like navigation, and command palette
//

import SwiftUI
import AppKit
import Carbon
import Combine

// MARK: - Keyboard Shortcut Definition
struct KeyboardShortcut: Identifiable, Codable, Hashable {
    let id = UUID()
    let key: String
    let modifiers: EventModifiers
    let action: String
    let description: String
    let category: String
    let isChord: Bool
    let chordKeys: [String]?
    let isGlobal: Bool
    let isCustomizable: Bool
    
    init(key: String, modifiers: EventModifiers, action: String, description: String,
         category: String = "General", isChord: Bool = false, chordKeys: [String]? = nil,
         isGlobal: Bool = false, isCustomizable: Bool = true) {
        self.key = key
        self.modifiers = modifiers
        self.action = action
        self.description = description
        self.category = category
        self.isChord = isChord
        self.chordKeys = chordKeys
        self.isGlobal = isGlobal
        self.isCustomizable = isCustomizable
    }
    
    var displayString: String {
        var parts: [String] = []
        
        if modifiers.contains(.command) { parts.append("⌘") }
        if modifiers.contains(.option) { parts.append("⌥") }
        if modifiers.contains(.control) { parts.append("⌃") }
        if modifiers.contains(.shift) { parts.append("⇧") }
        
        if isChord, let chordKeys = chordKeys {
            parts.append(key.uppercased())
            parts.append("→")
            parts.append(chordKeys.joined(separator: " "))
        } else {
            parts.append(key.uppercased())
        }
        
        return parts.joined()
    }
    
    static func == (lhs: KeyboardShortcut, rhs: KeyboardShortcut) -> Bool {
        lhs.id == rhs.id
    }
    
    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

// MARK: - Navigation Mode
enum NavigationMode: String, CaseIterable {
    case normal = "normal"
    case vi = "vi"
    case emacs = "emacs"
    case custom = "custom"
    
    var displayName: String {
        switch self {
        case .normal: return "Normal"
        case .vi: return "Vi-like"
        case .emacs: return "Emacs-like"
        case .custom: return "Custom"
        }
    }
}

// MARK: - Command Palette Item
struct CommandPaletteItem: Identifiable {
    let id = UUID()
    let title: String
    let subtitle: String?
    let category: String
    let keywords: [String]
    let action: () -> Void
    let icon: String?
    let shortcut: KeyboardShortcut?
    let isRecent: Bool
    
    var searchableText: String {
        let components = [title, subtitle, category] + keywords
        return components.compactMap { $0 }.joined(separator: " ").lowercased()
    }
}

// MARK: - Keyboard Context
struct KeyboardContext {
    let currentView: String
    let selectedItems: [Any]
    let applicationState: [String: Any]
    let isEditing: Bool
    let hasInputFocus: Bool
    
    var canNavigate: Bool {
        !hasInputFocus
    }
    
    var canExecuteCommands: Bool {
        !isEditing
    }
}

// MARK: - Keyboard Shortcut Manager
@MainActor
class KeyboardShortcutManager: ObservableObject {
    
    // MARK: - Published Properties
    @Published var shortcuts: [KeyboardShortcut] = []
    @Published var navigationMode: NavigationMode = .normal
    @Published var isCommandPaletteVisible: Bool = false
    @Published var commandPaletteItems: [CommandPaletteItem] = []
    @Published var recentCommands: [CommandPaletteItem] = []
    @Published var isRecordingShortcut: Bool = false
    @Published var currentChordSequence: [String] = []
    @Published var showShortcutHints: Bool = false
    @Published var conflictDetection: Bool = true
    
    // MARK: - Private Properties
    private var eventMonitor: Any?
    private var globalEventMonitor: Any?
    private var actionRegistry: [String: () -> Void] = [:]
    private var chordTimeout: Timer?
    private let chordTimeoutDuration: TimeInterval = 2.0
    private var currentContext: KeyboardContext?
    private var viState: ViNavigationState = ViNavigationState()
    private var customizationManager: ShortcutCustomizationManager
    private var conflictResolver: ShortcutConflictResolver
    private var commandPaletteController: CommandPaletteController
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    init() {
        self.customizationManager = ShortcutCustomizationManager()
        self.conflictResolver = ShortcutConflictResolver()
        self.commandPaletteController = CommandPaletteController()
        
        setupDefaultShortcuts()
        setupEventMonitoring()
        setupCommandPalette()
        loadCustomShortcuts()
    }
    
    deinit {
        stopEventMonitoring()
    }
    
    // MARK: - Setup Methods
    private func setupDefaultShortcuts() {
        shortcuts = [
            // Navigation
            KeyboardShortcut(
                key: "k",
                modifiers: [.command],
                action: "openCommandPalette",
                description: "Open Command Palette",
                category: "Navigation"
            ),
            
            KeyboardShortcut(
                key: "f",
                modifiers: [.command],
                action: "openSearch",
                description: "Open Search",
                category: "Navigation"
            ),
            
            KeyboardShortcut(
                key: "1",
                modifiers: [.command],
                action: "switchToChat",
                description: "Switch to Chat View",
                category: "Navigation"
            ),
            
            KeyboardShortcut(
                key: "2",
                modifiers: [.command],
                action: "switchToGraph",
                description: "Switch to Graph View",
                category: "Navigation"
            ),
            
            KeyboardShortcut(
                key: "3",
                modifiers: [.command],
                action: "switchToWorkflow",
                description: "Switch to Workflow View",
                category: "Navigation"
            ),
            
            // Chat
            KeyboardShortcut(
                key: "Return",
                modifiers: [.command],
                action: "sendMessage",
                description: "Send Message",
                category: "Chat"
            ),
            
            KeyboardShortcut(
                key: "r",
                modifiers: [.command],
                action: "startVoiceRecording",
                description: "Start Voice Recording",
                category: "Chat"
            ),
            
            // Graph
            KeyboardShortcut(
                key: "f",
                modifiers: [.command, .shift],
                action: "fitGraphToScreen",
                description: "Fit Graph to Screen",
                category: "Graph"
            ),
            
            KeyboardShortcut(
                key: "h",
                modifiers: [.command],
                action: "hideSelectedNodes",
                description: "Hide Selected Nodes",
                category: "Graph"
            ),
            
            // Chord shortcuts
            KeyboardShortcut(
                key: "g",
                modifiers: [.command],
                action: "graphModeChord",
                description: "Graph Mode",
                category: "Chords",
                isChord: true,
                chordKeys: ["c", "f", "r", "l"]
            ),
            
            // Global shortcuts
            KeyboardShortcut(
                key: "Space",
                modifiers: [.command, .option],
                action: "toggleQuickActions",
                description: "Toggle Quick Actions",
                category: "Global",
                isGlobal: true
            ),
            
            // Development
            KeyboardShortcut(
                key: "j",
                modifiers: [.command, .option],
                action: "openDeveloperConsole",
                description: "Open Developer Console",
                category: "Development"
            ),
            
            KeyboardShortcut(
                key: "r",
                modifiers: [.command, .shift],
                action: "reloadApplication",
                description: "Reload Application",
                category: "Development"
            )
        ]
        
        registerActions()
    }
    
    private func setupEventMonitoring() {
        // Local event monitor for application shortcuts
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: [.keyDown]) { [weak self] event in
            return self?.handleKeyEvent(event) ?? event
        }
        
        // Global event monitor for system-wide shortcuts
        globalEventMonitor = NSEvent.addGlobalMonitorForEvents(matching: [.keyDown]) { [weak self] event in
            self?.handleGlobalKeyEvent(event)
        }
    }
    
    private func setupCommandPalette() {
        commandPaletteController.delegate = self
        loadCommandPaletteItems()
    }
    
    private func stopEventMonitoring() {
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
            eventMonitor = nil
        }
        
        if let globalMonitor = globalEventMonitor {
            NSEvent.removeMonitor(globalMonitor)
            globalEventMonitor = nil
        }
    }
    
    // MARK: - Public Methods
    func updateContext(_ context: KeyboardContext) {
        currentContext = context
        
        // Update command palette items based on context
        loadCommandPaletteItems()
        
        // Update Vi state if in Vi mode
        if navigationMode == .vi {
            viState.updateContext(context)
        }
    }
    
    func setNavigationMode(_ mode: NavigationMode) {
        navigationMode = mode
        
        switch mode {
        case .vi:
            viState = ViNavigationState()
        case .emacs:
            setupEmacsBindings()
        case .normal, .custom:
            break
        }
    }
    
    func registerAction(_ action: String, handler: @escaping () -> Void) {
        actionRegistry[action] = handler
    }
    
    func executeAction(_ action: String) {
        if let handler = actionRegistry[action] {
            handler()
        } else {
            print("Unknown action: \(action)")
        }
    }
    
    func addCustomShortcut(_ shortcut: KeyboardShortcut) {
        // Check for conflicts
        if conflictDetection {
            let conflicts = conflictResolver.findConflicts(shortcut, in: shortcuts)
            if !conflicts.isEmpty {
                // Handle conflicts
                showConflictResolution(shortcut, conflicts: conflicts)
                return
            }
        }
        
        shortcuts.append(shortcut)
        saveCustomShortcuts()
    }
    
    func removeShortcut(_ shortcut: KeyboardShortcut) {
        shortcuts.removeAll { $0.id == shortcut.id }
        saveCustomShortcuts()
    }
    
    func resetToDefaults() {
        shortcuts.removeAll { $0.isCustomizable }
        setupDefaultShortcuts()
        saveCustomShortcuts()
    }
    
    func startRecordingShortcut() {
        isRecordingShortcut = true
    }
    
    func stopRecordingShortcut() {
        isRecordingShortcut = false
    }
    
    func showCommandPalette() {
        isCommandPaletteVisible = true
        loadCommandPaletteItems()
    }
    
    func hideCommandPalette() {
        isCommandPaletteVisible = false
    }
    
    func enableShortcutHints() {
        showShortcutHints = true
        
        // Auto-hide after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.showShortcutHints = false
        }
    }
    
    // MARK: - Event Handling
    private func handleKeyEvent(_ event: NSEvent) -> NSEvent? {
        guard let context = currentContext,
              context.canExecuteCommands else { return event }
        
        // Record shortcut if in recording mode
        if isRecordingShortcut {
            recordShortcut(from: event)
            return nil
        }
        
        // Handle based on navigation mode
        switch navigationMode {
        case .normal:
            return handleNormalModeEvent(event)
        case .vi:
            return handleViModeEvent(event)
        case .emacs:
            return handleEmacsModeEvent(event)
        case .custom:
            return handleCustomModeEvent(event)
        }
    }
    
    private func handleGlobalKeyEvent(_ event: NSEvent) {
        // Handle global shortcuts
        let keyCode = event.keyCode
        let modifiers = EventModifiers(rawValue: event.modifierFlags.rawValue)
        let key = keyStringFromKeyCode(keyCode)
        
        for shortcut in shortcuts where shortcut.isGlobal {
            if shortcut.key.lowercased() == key.lowercased() && shortcut.modifiers == modifiers {
                executeAction(shortcut.action)
                break
            }
        }
    }
    
    private func handleNormalModeEvent(_ event: NSEvent) -> NSEvent? {
        let keyCode = event.keyCode
        let modifiers = EventModifiers(rawValue: event.modifierFlags.rawValue)
        let key = keyStringFromKeyCode(keyCode)
        
        // Check for chord sequences
        if !currentChordSequence.isEmpty {
            return handleChordSequence(key, modifiers: modifiers, event: event)
        }
        
        // Find matching shortcut
        for shortcut in shortcuts {
            if shortcut.key.lowercased() == key.lowercased() && shortcut.modifiers == modifiers {
                if shortcut.isChord {
                    startChordSequence(shortcut)
                    return nil
                } else {
                    executeAction(shortcut.action)
                    return nil
                }
            }
        }
        
        return event
    }
    
    private func handleViModeEvent(_ event: NSEvent) -> NSEvent? {
        guard let context = currentContext,
              context.canNavigate else { return event }
        
        let key = keyStringFromKeyCode(event.keyCode)
        let modifiers = EventModifiers(rawValue: event.modifierFlags.rawValue)
        
        // Let Vi state handler process the event
        if viState.handleKeyEvent(key, modifiers: modifiers) {
            return nil // Event was consumed
        }
        
        // Fall back to normal mode handling
        return handleNormalModeEvent(event)
    }
    
    private func handleEmacsModeEvent(_ event: NSEvent) -> NSEvent? {
        // Implement Emacs-style key bindings
        let key = keyStringFromKeyCode(event.keyCode)
        let modifiers = EventModifiers(rawValue: event.modifierFlags.rawValue)
        
        // Handle Emacs-specific sequences (C-x, M-x, etc.)
        if modifiers.contains(.control) {
            switch key.lowercased() {
            case "x":
                startEmacsCommand()
                return nil
            case "f":
                executeAction("moveForward")
                return nil
            case "b":
                executeAction("moveBackward")
                return nil
            case "n":
                executeAction("moveDown")
                return nil
            case "p":
                executeAction("moveUp")
                return nil
            default:
                break
            }
        }
        
        return handleNormalModeEvent(event)
    }
    
    private func handleCustomModeEvent(_ event: NSEvent) -> NSEvent? {
        // Handle custom key bindings
        return handleNormalModeEvent(event)
    }
    
    // MARK: - Chord Sequence Handling
    private func startChordSequence(_ shortcut: KeyboardShortcut) {
        currentChordSequence = [shortcut.key]
        
        // Start timeout timer
        chordTimeout?.invalidate()
        chordTimeout = Timer.scheduledTimer(withTimeInterval: chordTimeoutDuration, repeats: false) { [weak self] _ in
            self?.resetChordSequence()
        }
        
        // Show chord hints
        showChordHints(for: shortcut)
    }
    
    private func handleChordSequence(_ key: String, modifiers: EventModifiers, event: NSEvent) -> NSEvent? {
        currentChordSequence.append(key.lowercased())
        
        // Find matching chord shortcut
        for shortcut in shortcuts where shortcut.isChord {
            if let chordKeys = shortcut.chordKeys,
               currentChordSequence.count == chordKeys.count + 1, // +1 for the initial key
               Array(currentChordSequence.dropFirst()) == chordKeys.map({ $0.lowercased() }) {
                
                executeAction(shortcut.action)
                resetChordSequence()
                return nil
            }
        }
        
        // Check if sequence is still valid
        let hasValidContinuation = shortcuts.contains { shortcut in
            guard shortcut.isChord, let chordKeys = shortcut.chordKeys else { return false }
            let fullSequence = [shortcut.key.lowercased()] + chordKeys.map { $0.lowercased() }
            return fullSequence.prefix(currentChordSequence.count) == ArraySlice(currentChordSequence)
        }
        
        if !hasValidContinuation {
            resetChordSequence()
        }
        
        return nil
    }
    
    private func resetChordSequence() {
        currentChordSequence.removeAll()
        chordTimeout?.invalidate()
        chordTimeout = nil
        hideChordHints()
    }
    
    private func showChordHints(for shortcut: KeyboardShortcut) {
        // Implementation would show visual hints for available chord completions
        enableShortcutHints()
    }
    
    private func hideChordHints() {
        showShortcutHints = false
    }
    
    // MARK: - Command Palette
    private func loadCommandPaletteItems() {
        commandPaletteItems = [
            CommandPaletteItem(
                title: "Open Chat",
                subtitle: "Switch to chat interface",
                category: "Navigation",
                keywords: ["chat", "conversation", "talk"],
                action: { self.executeAction("switchToChat") },
                icon: "message",
                shortcut: shortcuts.first { $0.action == "switchToChat" },
                isRecent: false
            ),
            
            CommandPaletteItem(
                title: "Open Graph View",
                subtitle: "Switch to graph visualization",
                category: "Navigation",
                keywords: ["graph", "visualization", "network"],
                action: { self.executeAction("switchToGraph") },
                icon: "circle.grid.hex",
                shortcut: shortcuts.first { $0.action == "switchToGraph" },
                isRecent: false
            ),
            
            CommandPaletteItem(
                title: "Search",
                subtitle: "Search through content",
                category: "Tools",
                keywords: ["search", "find", "query"],
                action: { self.executeAction("openSearch") },
                icon: "magnifyingglass",
                shortcut: shortcuts.first { $0.action == "openSearch" },
                isRecent: false
            ),
            
            CommandPaletteItem(
                title: "Toggle Developer Console",
                subtitle: "Show/hide developer tools",
                category: "Development",
                keywords: ["console", "debug", "developer"],
                action: { self.executeAction("openDeveloperConsole") },
                icon: "terminal",
                shortcut: shortcuts.first { $0.action == "openDeveloperConsole" },
                isRecent: false
            ),
            
            CommandPaletteItem(
                title: "Preferences",
                subtitle: "Open application settings",
                category: "Settings",
                keywords: ["preferences", "settings", "config"],
                action: { self.executeAction("openPreferences") },
                icon: "gearshape",
                shortcut: nil,
                isRecent: false
            )
        ]
        
        // Add recent commands
        commandPaletteItems.append(contentsOf: recentCommands)
    }
    
    func executeCommandPaletteItem(_ item: CommandPaletteItem) {
        item.action()
        addToRecentCommands(item)
        hideCommandPalette()
    }
    
    private func addToRecentCommands(_ item: CommandPaletteItem) {
        // Remove if already in recent
        recentCommands.removeAll { $0.title == item.title }
        
        // Add to beginning
        var recentItem = item
        recentItem = CommandPaletteItem(
            title: item.title,
            subtitle: item.subtitle,
            category: "Recent",
            keywords: item.keywords,
            action: item.action,
            icon: item.icon,
            shortcut: item.shortcut,
            isRecent: true
        )
        recentCommands.insert(recentItem, at: 0)
        
        // Limit to 10 recent items
        if recentCommands.count > 10 {
            recentCommands.removeLast()
        }
    }
    
    // MARK: - Vi Navigation
    private func setupEmacsBindings() {
        // Register Emacs-specific actions
        registerAction("moveForward") { /* Move cursor forward */ }
        registerAction("moveBackward") { /* Move cursor backward */ }
        registerAction("moveUp") { /* Move cursor up */ }
        registerAction("moveDown") { /* Move cursor down */ }
    }
    
    private func startEmacsCommand() {
        // Start Emacs command sequence (C-x)
        showCommandPalette()
    }
    
    // MARK: - Shortcut Recording
    private func recordShortcut(from event: NSEvent) {
        let keyCode = event.keyCode
        let modifiers = EventModifiers(rawValue: event.modifierFlags.rawValue)
        let key = keyStringFromKeyCode(keyCode)
        
        // Create recorded shortcut
        let recordedShortcut = KeyboardShortcut(
            key: key,
            modifiers: modifiers,
            action: "customAction",
            description: "Custom Shortcut",
            category: "Custom"
        )
        
        // Notify delegate or show UI for completing shortcut setup
        NotificationCenter.default.post(
            name: .shortcutRecorded,
            object: recordedShortcut
        )
        
        stopRecordingShortcut()
    }
    
    // MARK: - Conflict Resolution
    private func showConflictResolution(_ shortcut: KeyboardShortcut, conflicts: [KeyboardShortcut]) {
        // Implementation would show conflict resolution UI
        print("Shortcut conflict detected: \(shortcut.displayString)")
        for conflict in conflicts {
            print("Conflicts with: \(conflict.displayString) - \(conflict.description)")
        }
    }
    
    // MARK: - Persistence
    private func loadCustomShortcuts() {
        // Load custom shortcuts from UserDefaults or file
        if let data = UserDefaults.standard.data(forKey: "customShortcuts"),
           let customShortcuts = try? JSONDecoder().decode([KeyboardShortcut].self, from: data) {
            shortcuts.append(contentsOf: customShortcuts)
        }
    }
    
    private func saveCustomShortcuts() {
        let customShortcuts = shortcuts.filter { $0.isCustomizable }
        if let data = try? JSONEncoder().encode(customShortcuts) {
            UserDefaults.standard.set(data, forKey: "customShortcuts")
        }
    }
    
    // MARK: - Action Registration
    private func registerActions() {
        registerAction("openCommandPalette") { [weak self] in
            self?.showCommandPalette()
        }
        
        registerAction("openSearch") {
            NotificationCenter.default.post(name: .openSearch, object: nil)
        }
        
        registerAction("switchToChat") {
            NotificationCenter.default.post(name: .switchToChat, object: nil)
        }
        
        registerAction("switchToGraph") {
            NotificationCenter.default.post(name: .switchToGraph, object: nil)
        }
        
        registerAction("switchToWorkflow") {
            NotificationCenter.default.post(name: .switchToWorkflow, object: nil)
        }
        
        registerAction("sendMessage") {
            NotificationCenter.default.post(name: .sendMessage, object: nil)
        }
        
        registerAction("startVoiceRecording") {
            NotificationCenter.default.post(name: .startVoiceRecording, object: nil)
        }
        
        registerAction("fitGraphToScreen") {
            NotificationCenter.default.post(name: .fitGraphToScreen, object: nil)
        }
        
        registerAction("hideSelectedNodes") {
            NotificationCenter.default.post(name: .hideSelectedNodes, object: nil)
        }
        
        registerAction("toggleQuickActions") {
            NotificationCenter.default.post(name: .toggleQuickActions, object: nil)
        }
        
        registerAction("openDeveloperConsole") {
            NotificationCenter.default.post(name: .openDeveloperConsole, object: nil)
        }
        
        registerAction("reloadApplication") {
            NotificationCenter.default.post(name: .reloadApplication, object: nil)
        }
        
        registerAction("openPreferences") {
            NotificationCenter.default.post(name: .openPreferences, object: nil)
        }
        
        // Graph mode chord actions
        registerAction("graphModeChord") {
            // This would start a chord sequence for graph-specific actions
        }
    }
    
    // MARK: - Utility Methods
    private func keyStringFromKeyCode(_ keyCode: UInt16) -> String {
        // Convert key code to string representation
        let inputSource = TISCopyCurrentASCIICapableKeyboardLayoutInputSource().takeRetainedValue()
        let layoutData = TISGetInputSourceProperty(inputSource, kTISPropertyUnicodeKeyLayoutData)
        let dataRef = unsafeBitCast(layoutData, to: CFData.self)
        let keyboardLayout = unsafeBitCast(CFDataGetBytePtr(dataRef), to: UnsafePointer<UCKeyboardLayout>.self)
        
        var deadKeyState: UInt32 = 0
        var stringLength = 0
        var string = [UniChar](repeating: 0, count: 4)
        
        let status = UCKeyTranslate(
            keyboardLayout,
            keyCode,
            UInt16(kUCKeyActionDisplay),
            0,
            UInt32(LMGetKbdLast() & 0xFF),
            OptionBits(kUCKeyTranslateNoDeadKeysBit),
            &deadKeyState,
            4,
            &stringLength,
            &string
        )
        
        if status == noErr && stringLength > 0 {
            return String(utf16CodeUnits: string, count: stringLength)
        }
        
        // Fallback for special keys
        switch keyCode {
        case 36: return "Return"
        case 48: return "Tab"
        case 49: return "Space"
        case 51: return "Delete"
        case 53: return "Escape"
        case 123: return "Left"
        case 124: return "Right"
        case 125: return "Down"
        case 126: return "Up"
        case 116: return "PageUp"
        case 121: return "PageDown"
        case 115: return "Home"
        case 119: return "End"
        case 122: return "F1"
        case 120: return "F2"
        case 99: return "F3"
        case 118: return "F4"
        case 96: return "F5"
        case 97: return "F6"
        case 98: return "F7"
        case 100: return "F8"
        case 101: return "F9"
        case 109: return "F10"
        case 103: return "F11"
        case 111: return "F12"
        default: return "Unknown"
        }
    }
}

// MARK: - Supporting Classes

class ViNavigationState {
    enum Mode {
        case normal
        case insert
        case visual
        case command
    }
    
    private var mode: Mode = .normal
    private var context: KeyboardContext?
    
    func updateContext(_ context: KeyboardContext) {
        self.context = context
    }
    
    func handleKeyEvent(_ key: String, modifiers: EventModifiers) -> Bool {
        switch mode {
        case .normal:
            return handleNormalModeKey(key, modifiers: modifiers)
        case .insert:
            return handleInsertModeKey(key, modifiers: modifiers)
        case .visual:
            return handleVisualModeKey(key, modifiers: modifiers)
        case .command:
            return handleCommandModeKey(key, modifiers: modifiers)
        }
    }
    
    private func handleNormalModeKey(_ key: String, modifiers: EventModifiers) -> Bool {
        switch key.lowercased() {
        case "h":
            NotificationCenter.default.post(name: .moveLeft, object: nil)
            return true
        case "j":
            NotificationCenter.default.post(name: .moveDown, object: nil)
            return true
        case "k":
            NotificationCenter.default.post(name: .moveUp, object: nil)
            return true
        case "l":
            NotificationCenter.default.post(name: .moveRight, object: nil)
            return true
        case "i":
            mode = .insert
            return true
        case "v":
            mode = .visual
            return true
        case ":":
            mode = .command
            return true
        case "g":
            if modifiers.contains(.shift) {
                NotificationCenter.default.post(name: .moveToEnd, object: nil)
            } else {
                NotificationCenter.default.post(name: .moveToBeginning, object: nil)
            }
            return true
        default:
            return false
        }
    }
    
    private func handleInsertModeKey(_ key: String, modifiers: EventModifiers) -> Bool {
        if key.lowercased() == "escape" {
            mode = .normal
            return true
        }
        return false
    }
    
    private func handleVisualModeKey(_ key: String, modifiers: EventModifiers) -> Bool {
        if key.lowercased() == "escape" {
            mode = .normal
            return true
        }
        // Handle visual mode navigation
        return handleNormalModeKey(key, modifiers: modifiers)
    }
    
    private func handleCommandModeKey(_ key: String, modifiers: EventModifiers) -> Bool {
        if key.lowercased() == "escape" || key.lowercased() == "return" {
            mode = .normal
            return true
        }
        return false
    }
}

class ShortcutCustomizationManager {
    func loadCustomizations() -> [KeyboardShortcut] {
        // Load custom shortcuts from persistent storage
        return []
    }
    
    func saveCustomizations(_ shortcuts: [KeyboardShortcut]) {
        // Save custom shortcuts to persistent storage
    }
}

class ShortcutConflictResolver {
    func findConflicts(_ shortcut: KeyboardShortcut, in shortcuts: [KeyboardShortcut]) -> [KeyboardShortcut] {
        return shortcuts.filter { existing in
            existing.key.lowercased() == shortcut.key.lowercased() &&
            existing.modifiers == shortcut.modifiers &&
            existing.id != shortcut.id
        }
    }
    
    func resolveConflicts(_ shortcuts: [KeyboardShortcut]) -> [KeyboardShortcut] {
        // Implement conflict resolution logic
        return shortcuts
    }
}

class CommandPaletteController {
    weak var delegate: CommandPaletteDelegate?
    
    func search(_ query: String, in items: [CommandPaletteItem]) -> [CommandPaletteItem] {
        let lowercaseQuery = query.lowercased()
        
        return items.filter { item in
            item.searchableText.contains(lowercaseQuery)
        }.sorted { item1, item2 in
            // Prioritize exact matches and recent items
            let score1 = calculateRelevanceScore(item1, query: lowercaseQuery)
            let score2 = calculateRelevanceScore(item2, query: lowercaseQuery)
            return score1 > score2
        }
    }
    
    private func calculateRelevanceScore(_ item: CommandPaletteItem, query: String) -> Int {
        var score = 0
        
        // Recent items get higher score
        if item.isRecent {
            score += 100
        }
        
        // Exact title match gets highest score
        if item.title.lowercased() == query {
            score += 1000
        } else if item.title.lowercased().hasPrefix(query) {
            score += 500
        } else if item.title.lowercased().contains(query) {
            score += 200
        }
        
        // Keyword matches
        for keyword in item.keywords {
            if keyword.lowercased().hasPrefix(query) {
                score += 100
            } else if keyword.lowercased().contains(query) {
                score += 50
            }
        }
        
        return score
    }
}

protocol CommandPaletteDelegate: AnyObject {
    func commandPaletteDidShow()
    func commandPaletteDidHide()
}

extension KeyboardShortcutManager: CommandPaletteDelegate {
    func commandPaletteDidShow() {
        isCommandPaletteVisible = true
    }
    
    func commandPaletteDidHide() {
        isCommandPaletteVisible = false
    }
}

// MARK: - Notification Names
extension Notification.Name {
    static let shortcutRecorded = Notification.Name("shortcutRecorded")
    static let openSearch = Notification.Name("openSearch")
    static let switchToChat = Notification.Name("switchToChat")
    static let switchToGraph = Notification.Name("switchToGraph")
    static let switchToWorkflow = Notification.Name("switchToWorkflow")
    static let sendMessage = Notification.Name("sendMessage")
    static let startVoiceRecording = Notification.Name("startVoiceRecording")
    static let fitGraphToScreen = Notification.Name("fitGraphToScreen")
    static let hideSelectedNodes = Notification.Name("hideSelectedNodes")
    static let toggleQuickActions = Notification.Name("toggleQuickActions")
    static let openDeveloperConsole = Notification.Name("openDeveloperConsole")
    static let reloadApplication = Notification.Name("reloadApplication")
    static let openPreferences = Notification.Name("openPreferences")
    static let moveLeft = Notification.Name("moveLeft")
    static let moveRight = Notification.Name("moveRight")
    static let moveUp = Notification.Name("moveUp")
    static let moveDown = Notification.Name("moveDown")
    static let moveToBeginning = Notification.Name("moveToBeginning")
    static let moveToEnd = Notification.Name("moveToEnd")
}

// MARK: - Command Palette View
struct CommandPaletteView: View {
    @ObservedObject var shortcutManager: KeyboardShortcutManager
    @State private var searchText: String = ""
    @State private var selectedIndex: Int = 0
    
    var filteredItems: [CommandPaletteItem] {
        if searchText.isEmpty {
            return shortcutManager.commandPaletteItems
        } else {
            return shortcutManager.commandPaletteController.search(searchText, in: shortcutManager.commandPaletteItems)
        }
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Search field
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                
                TextField("Type a command...", text: $searchText)
                    .textFieldStyle(PlainTextFieldStyle())
                    .font(.system(size: 18))
                    .onSubmit {
                        executeSelectedItem()
                    }
            }
            .padding()
            .background(Color(.controlBackgroundColor))
            
            Divider()
            
            // Results list
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(filteredItems.enumerated()), id: \.element.id) { index, item in
                        commandItemView(item, isSelected: index == selectedIndex)
                            .onTapGesture {
                                shortcutManager.executeCommandPaletteItem(item)
                            }
                    }
                }
            }
            .frame(maxHeight: 400)
        }
        .frame(width: 600)
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.3), radius: 20, x: 0, y: 10)
        .onAppear {
            selectedIndex = 0
        }
        .onChange(of: searchText) { _ in
            selectedIndex = 0
        }
        .onKeyDown { event in
            handleKeyDown(event)
        }
    }
    
    private func commandItemView(_ item: CommandPaletteItem, isSelected: Bool) -> some View {
        HStack {
            // Icon
            if let icon = item.icon {
                Image(systemName: icon)
                    .foregroundColor(.blue)
                    .frame(width: 20, height: 20)
            } else {
                Spacer()
                    .frame(width: 20, height: 20)
            }
            
            // Content
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.primary)
                
                if let subtitle = item.subtitle {
                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Category
            Text(item.category)
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color(.controlColor))
                .cornerRadius(4)
            
            // Shortcut
            if let shortcut = item.shortcut {
                Text(shortcut.displayString)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color(.controlColor))
                    .cornerRadius(4)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(isSelected ? Color(.selectedControlColor) : Color.clear)
    }
    
    private func handleKeyDown(_ event: NSEvent) {
        switch event.keyCode {
        case 125: // Down arrow
            selectedIndex = min(selectedIndex + 1, filteredItems.count - 1)
        case 126: // Up arrow
            selectedIndex = max(selectedIndex - 1, 0)
        case 36: // Return
            executeSelectedItem()
        case 53: // Escape
            shortcutManager.hideCommandPalette()
        default:
            break
        }
    }
    
    private func executeSelectedItem() {
        guard selectedIndex < filteredItems.count else { return }
        let item = filteredItems[selectedIndex]
        shortcutManager.executeCommandPaletteItem(item)
    }
}

// MARK: - Key Down Modifier
extension View {
    func onKeyDown(perform action: @escaping (NSEvent) -> Void) -> some View {
        self.background(
            KeyDownHandler(onKeyDown: action)
        )
    }
}

struct KeyDownHandler: NSViewRepresentable {
    let onKeyDown: (NSEvent) -> Void
    
    func makeNSView(context: Context) -> NSView {
        let view = KeyDownView()
        view.onKeyDown = onKeyDown
        return view
    }
    
    func updateNSView(_ nsView: NSView, context: Context) {
        // Update if needed
    }
}

class KeyDownView: NSView {
    var onKeyDown: ((NSEvent) -> Void)?
    
    override var acceptsFirstResponder: Bool { true }
    
    override func keyDown(with event: NSEvent) {
        onKeyDown?(event)
    }
}