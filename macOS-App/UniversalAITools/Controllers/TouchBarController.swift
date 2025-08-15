//
//  TouchBarController.swift
//  UniversalAITools
//
//  MacBook Pro Touch Bar integration with context-sensitive controls,
//  quick actions, real-time adjustments, and custom layouts
//

import AppKit
import SwiftUI
import Combine

// MARK: - Touch Bar Item Types
enum TouchBarItemType {
    case button
    case slider
    case segmentedControl
    case colorPicker
    case scrubber
    case popover
    case groupItem
    case spacer
    case customView
}

// MARK: - Touch Bar Item Configuration
struct TouchBarItemConfig {
    let identifier: String
    let type: TouchBarItemType
    let title: String?
    let image: NSImage?
    let action: (() -> Void)?
    let isEnabled: Bool
    let priority: Float
    let customizationLabel: String?
    let width: CGFloat?
    
    // Type-specific properties
    let sliderConfig: SliderConfig?
    let segmentedConfig: SegmentedConfig?
    let colorPickerConfig: ColorPickerConfig?
    let scrubberConfig: ScrubberConfig?
    let popoverConfig: PopoverConfig?
    let groupConfig: GroupConfig?
    let customViewConfig: CustomViewConfig?
    
    init(identifier: String, type: TouchBarItemType, title: String? = nil, image: NSImage? = nil,
         action: (() -> Void)? = nil, isEnabled: Bool = true, priority: Float = 0.0,
         customizationLabel: String? = nil, width: CGFloat? = nil,
         sliderConfig: SliderConfig? = nil, segmentedConfig: SegmentedConfig? = nil,
         colorPickerConfig: ColorPickerConfig? = nil, scrubberConfig: ScrubberConfig? = nil,
         popoverConfig: PopoverConfig? = nil, groupConfig: GroupConfig? = nil,
         customViewConfig: CustomViewConfig? = nil) {
        self.identifier = identifier
        self.type = type
        self.title = title
        self.image = image
        self.action = action
        self.isEnabled = isEnabled
        self.priority = priority
        self.customizationLabel = customizationLabel
        self.width = width
        self.sliderConfig = sliderConfig
        self.segmentedConfig = segmentedConfig
        self.colorPickerConfig = colorPickerConfig
        self.scrubberConfig = scrubberConfig
        self.popoverConfig = popoverConfig
        self.groupConfig = groupConfig
        self.customViewConfig = customViewConfig
    }
}

// MARK: - Configuration Structs
struct SliderConfig {
    let minValue: Double
    let maxValue: Double
    let currentValue: Double
    let valueChangedAction: (Double) -> Void
    let label: String?
    let accessibilityDescription: String?
}

struct SegmentedConfig {
    let segments: [SegmentItem]
    let selectedIndex: Int
    let selectionChangedAction: (Int) -> Void
    
    struct SegmentItem {
        let title: String?
        let image: NSImage?
        let width: CGFloat?
    }
}

struct ColorPickerConfig {
    let currentColor: NSColor
    let colorChangedAction: (NSColor) -> Void
    let showsAlpha: Bool
}

struct ScrubberConfig {
    let items: [ScrubberItem]
    let selectedIndex: Int?
    let selectionChangedAction: (Int) -> Void
    let mode: NSScrubberMode
    
    struct ScrubberItem {
        let title: String?
        let image: NSImage?
        let identifier: String
    }
}

struct PopoverConfig {
    let contentViewController: NSViewController
    let pressAndHoldAction: (() -> Void)?
    let showsCloseButton: Bool
}

struct GroupConfig {
    let items: [TouchBarItemConfig]
    let preferredItemWidth: CGFloat?
}

struct CustomViewConfig {
    let view: NSView
    let viewController: NSViewController?
}

// MARK: - Touch Bar Layout
enum TouchBarLayout: String, CaseIterable {
    case main = "main"
    case chat = "chat"
    case graph = "graph"
    case parameters = "parameters"
    case workflow = "workflow"
    case debug = "debug"
    
    var displayName: String {
        switch self {
        case .main: return "Main"
        case .chat: return "Chat"
        case .graph: return "Graph"
        case .parameters: return "Parameters"
        case .workflow: return "Workflow"
        case .debug: return "Debug"
        }
    }
}

// MARK: - Touch Bar Context
struct TouchBarContext {
    let currentView: String
    let selectedItems: [Any]
    let applicationState: [String: Any]
    let userPreferences: [String: Any]
    
    var hasSelection: Bool {
        !selectedItems.isEmpty
    }
    
    var selectionCount: Int {
        selectedItems.count
    }
}

// MARK: - Touch Bar Controller
@available(macOS 10.12.2, *)
class TouchBarController: NSObject, ObservableObject {
    
    // MARK: - Published Properties
    @Published var currentLayout: TouchBarLayout = .main
    @Published var isCustomizing: Bool = false
    @Published var availableLayouts: [TouchBarLayout] = TouchBarLayout.allCases
    
    // MARK: - Private Properties
    private var touchBar: NSTouchBar?
    private var layoutProviders: [TouchBarLayout: TouchBarLayoutProvider] = [:]
    private var currentContext: TouchBarContext?
    private var customizationController: TouchBarCustomizationController?
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Touch Bar Identifiers
    private struct Identifiers {
        static let touchBar = NSTouchBarItem.Identifier("com.universalaitools.touchbar")
        static let mainGroup = NSTouchBarItem.Identifier("com.universalaitools.touchbar.main")
        static let quickActions = NSTouchBarItem.Identifier("com.universalaitools.touchbar.quickactions")
        static let navigation = NSTouchBarItem.Identifier("com.universalaitools.touchbar.navigation")
        static let tools = NSTouchBarItem.Identifier("com.universalaitools.touchbar.tools")
        static let parameters = NSTouchBarItem.Identifier("com.universalaitools.touchbar.parameters")
        static let customization = NSTouchBarItem.Identifier("com.universalaitools.touchbar.customization")
    }
    
    // MARK: - Initialization
    override init() {
        super.init()
        setupLayoutProviders()
        setupCustomizationController()
    }
    
    // MARK: - Public Methods
    func setupTouchBar() -> NSTouchBar? {
        let touchBar = NSTouchBar()
        touchBar.delegate = self
        touchBar.customizationIdentifier = Identifiers.touchBar
        touchBar.defaultItemIdentifiers = defaultIdentifiers(for: currentLayout)
        touchBar.customizationAllowedItemIdentifiers = customizationAllowedIdentifiers(for: currentLayout)
        touchBar.principalItemIdentifier = principalIdentifier(for: currentLayout)
        
        self.touchBar = touchBar
        return touchBar
    }
    
    func updateContext(_ context: TouchBarContext) {
        currentContext = context
        
        // Update layout based on context
        let newLayout = determineLayout(from: context)
        if newLayout != currentLayout {
            setLayout(newLayout)
        }
        
        // Update existing touch bar items
        updateTouchBarItems()
    }
    
    func setLayout(_ layout: TouchBarLayout) {
        guard layout != currentLayout else { return }
        
        currentLayout = layout
        
        // Update touch bar with new layout
        if let touchBar = touchBar {
            touchBar.defaultItemIdentifiers = defaultIdentifiers(for: layout)
            touchBar.customizationAllowedItemIdentifiers = customizationAllowedIdentifiers(for: layout)
            touchBar.principalItemIdentifier = principalIdentifier(for: layout)
        }
    }
    
    func startCustomization() {
        guard let touchBar = touchBar else { return }
        isCustomizing = true
        touchBar.isVisible = true
        customizationController?.startCustomization()
    }
    
    func endCustomization() {
        isCustomizing = false
        customizationController?.endCustomization()
    }
    
    // MARK: - Private Methods
    private func setupLayoutProviders() {
        layoutProviders[.main] = MainLayoutProvider()
        layoutProviders[.chat] = ChatLayoutProvider()
        layoutProviders[.graph] = GraphLayoutProvider()
        layoutProviders[.parameters] = ParametersLayoutProvider()
        layoutProviders[.workflow] = WorkflowLayoutProvider()
        layoutProviders[.debug] = DebugLayoutProvider()
    }
    
    private func setupCustomizationController() {
        customizationController = TouchBarCustomizationController()
        customizationController?.delegate = self
    }
    
    private func determineLayout(from context: TouchBarContext) -> TouchBarLayout {
        // Determine the best layout based on current context
        switch context.currentView {
        case "chat", "conversation":
            return .chat
        case "graph", "visualization":
            return .graph
        case "parameters", "settings":
            return .parameters
        case "workflow", "editor":
            return .workflow
        case "debug", "console":
            return .debug
        default:
            return .main
        }
    }
    
    private func updateTouchBarItems() {
        guard let touchBar = touchBar,
              let provider = layoutProviders[currentLayout],
              let context = currentContext else { return }
        
        let configs = provider.itemConfigs(for: context)
        
        // Update existing items or create new ones
        for config in configs {
            if let existingItem = touchBar.item(forIdentifier: NSTouchBarItem.Identifier(config.identifier)) {
                updateTouchBarItem(existingItem, with: config)
            }
        }
    }
    
    private func updateTouchBarItem(_ item: NSTouchBarItem, with config: TouchBarItemConfig) {
        // Update item properties based on type
        switch config.type {
        case .button:
            if let button = item as? NSCustomTouchBarItem,
               let buttonView = button.view as? NSButton {
                buttonView.title = config.title ?? ""
                buttonView.image = config.image
                buttonView.isEnabled = config.isEnabled
            }
            
        case .slider:
            if let sliderItem = item as? NSSliderTouchBarItem,
               let sliderConfig = config.sliderConfig {
                sliderItem.slider.minValue = sliderConfig.minValue
                sliderItem.slider.maxValue = sliderConfig.maxValue
                sliderItem.slider.doubleValue = sliderConfig.currentValue
                sliderItem.label = sliderConfig.label ?? ""
            }
            
        case .segmentedControl:
            if let segmentedItem = item as? NSPickerTouchBarItem,
               let segmentedConfig = config.segmentedConfig {
                segmentedItem.selectedIndex = segmentedConfig.selectedIndex
            }
            
        case .colorPicker:
            if let colorItem = item as? NSColorPickerTouchBarItem,
               let colorConfig = config.colorPickerConfig {
                colorItem.color = colorConfig.currentColor
                colorItem.showsAlpha = colorConfig.showsAlpha
            }
            
        default:
            break
        }
    }
    
    private func defaultIdentifiers(for layout: TouchBarLayout) -> [NSTouchBarItem.Identifier] {
        guard let provider = layoutProviders[layout] else { return [] }
        return provider.defaultIdentifiers()
    }
    
    private func customizationAllowedIdentifiers(for layout: TouchBarLayout) -> [NSTouchBarItem.Identifier] {
        guard let provider = layoutProviders[layout] else { return [] }
        return provider.customizationAllowedIdentifiers()
    }
    
    private func principalIdentifier(for layout: TouchBarLayout) -> NSTouchBarItem.Identifier? {
        guard let provider = layoutProviders[layout] else { return nil }
        return provider.principalIdentifier()
    }
}

// MARK: - NSTouchBarDelegate
@available(macOS 10.12.2, *)
extension TouchBarController: NSTouchBarDelegate {
    
    func touchBar(_ touchBar: NSTouchBar, makeItemForIdentifier identifier: NSTouchBarItem.Identifier) -> NSTouchBarItem? {
        guard let provider = layoutProviders[currentLayout],
              let context = currentContext else { return nil }
        
        let configs = provider.itemConfigs(for: context)
        
        if let config = configs.first(where: { $0.identifier == identifier.rawValue }) {
            return makeTouchBarItem(from: config)
        }
        
        return nil
    }
    
    private func makeTouchBarItem(from config: TouchBarItemConfig) -> NSTouchBarItem? {
        let identifier = NSTouchBarItem.Identifier(config.identifier)
        
        switch config.type {
        case .button:
            return makeButtonItem(identifier: identifier, config: config)
            
        case .slider:
            return makeSliderItem(identifier: identifier, config: config)
            
        case .segmentedControl:
            return makeSegmentedItem(identifier: identifier, config: config)
            
        case .colorPicker:
            return makeColorPickerItem(identifier: identifier, config: config)
            
        case .scrubber:
            return makeScrubberItem(identifier: identifier, config: config)
            
        case .popover:
            return makePopoverItem(identifier: identifier, config: config)
            
        case .groupItem:
            return makeGroupItem(identifier: identifier, config: config)
            
        case .spacer:
            return NSTouchBarItem(identifier: identifier)
            
        case .customView:
            return makeCustomViewItem(identifier: identifier, config: config)
        }
    }
    
    private func makeButtonItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSCustomTouchBarItem {
        let item = NSCustomTouchBarItem(identifier: identifier)
        
        let button = NSButton(title: config.title ?? "", target: self, action: #selector(touchBarButtonAction(_:)))
        button.image = config.image
        button.isEnabled = config.isEnabled
        
        if let width = config.width {
            button.widthAnchor.constraint(equalToConstant: width).isActive = true
        }
        
        // Store action in button's representedObject
        button.representedObject = config.action
        
        item.view = button
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        return item
    }
    
    private func makeSliderItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSSliderTouchBarItem {
        guard let sliderConfig = config.sliderConfig else {
            return NSSliderTouchBarItem(identifier: identifier)
        }
        
        let item = NSSliderTouchBarItem(identifier: identifier)
        item.slider.minValue = sliderConfig.minValue
        item.slider.maxValue = sliderConfig.maxValue
        item.slider.doubleValue = sliderConfig.currentValue
        item.label = sliderConfig.label ?? ""
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        item.target = self
        item.action = #selector(touchBarSliderAction(_:))
        
        // Store action in slider's representedObject
        item.slider.representedObject = sliderConfig.valueChangedAction
        
        return item
    }
    
    private func makeSegmentedItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSPickerTouchBarItem {
        guard let segmentedConfig = config.segmentedConfig else {
            return NSPickerTouchBarItem(identifier: identifier)
        }
        
        let item = NSPickerTouchBarItem(identifier: identifier)
        
        // Create picker labels
        var labels: [String] = []
        var images: [NSImage] = []
        
        for segment in segmentedConfig.segments {
            if let title = segment.title {
                labels.append(title)
            }
            if let image = segment.image {
                images.append(image)
            }
        }
        
        if !labels.isEmpty {
            item.pickerLabels = labels
        }
        if !images.isEmpty {
            item.pickerImages = images
        }
        
        item.selectedIndex = segmentedConfig.selectedIndex
        item.target = self
        item.action = #selector(touchBarSegmentedAction(_:))
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        // Store action
        item.representedObject = segmentedConfig.selectionChangedAction
        
        return item
    }
    
    private func makeColorPickerItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSColorPickerTouchBarItem {
        guard let colorConfig = config.colorPickerConfig else {
            return NSColorPickerTouchBarItem(identifier: identifier)
        }
        
        let item = NSColorPickerTouchBarItem(identifier: identifier)
        item.color = colorConfig.currentColor
        item.showsAlpha = colorConfig.showsAlpha
        item.target = self
        item.action = #selector(touchBarColorAction(_:))
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        // Store action
        item.representedObject = colorConfig.colorChangedAction
        
        return item
    }
    
    private func makeScrubberItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSCustomTouchBarItem {
        guard let scrubberConfig = config.scrubberConfig else {
            return NSCustomTouchBarItem(identifier: identifier)
        }
        
        let item = NSCustomTouchBarItem(identifier: identifier)
        let scrubber = NSScrubber()
        
        scrubber.scrubberLayout = NSScrubberFlowLayout()
        scrubber.mode = scrubberConfig.mode
        scrubber.selectionBackgroundStyle = .roundedBackground
        scrubber.dataSource = self
        scrubber.delegate = self
        
        // Store config in scrubber
        scrubber.representedObject = scrubberConfig
        
        item.view = scrubber
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        return item
    }
    
    private func makePopoverItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSPopoverTouchBarItem {
        guard let popoverConfig = config.popoverConfig else {
            return NSPopoverTouchBarItem(identifier: identifier)
        }
        
        let item = NSPopoverTouchBarItem(identifier: identifier)
        item.collapsedRepresentationLabel = config.title ?? ""
        item.collapsedRepresentationImage = config.image
        item.popoverTouchBar.rootViewController = popoverConfig.contentViewController
        item.showsCloseButton = popoverConfig.showsCloseButton
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        if let pressAndHoldAction = popoverConfig.pressAndHoldAction {
            item.pressAndHoldAction = pressAndHoldAction
        }
        
        return item
    }
    
    private func makeGroupItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSGroupTouchBarItem {
        guard let groupConfig = config.groupConfig else {
            return NSGroupTouchBarItem(identifier: identifier)
        }
        
        let groupTouchBar = NSTouchBar()
        groupTouchBar.delegate = self
        
        let identifiers = groupConfig.items.map { NSTouchBarItem.Identifier($0.identifier) }
        groupTouchBar.defaultItemIdentifiers = identifiers
        
        let item = NSGroupTouchBarItem(identifier: identifier)
        item.groupTouchBar = groupTouchBar
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        if let preferredWidth = groupConfig.preferredItemWidth {
            item.preferredItemWidth = preferredWidth
        }
        
        return item
    }
    
    private func makeCustomViewItem(identifier: NSTouchBarItem.Identifier, config: TouchBarItemConfig) -> NSCustomTouchBarItem {
        guard let customConfig = config.customViewConfig else {
            return NSCustomTouchBarItem(identifier: identifier)
        }
        
        let item = NSCustomTouchBarItem(identifier: identifier)
        item.view = customConfig.view
        item.viewController = customConfig.viewController
        item.customizationLabel = config.customizationLabel ?? config.title ?? ""
        
        return item
    }
    
    // MARK: - Touch Bar Actions
    @objc private func touchBarButtonAction(_ sender: NSButton) {
        if let action = sender.representedObject as? (() -> Void) {
            action()
        }
    }
    
    @objc private func touchBarSliderAction(_ sender: NSSliderTouchBarItem) {
        if let action = sender.slider.representedObject as? ((Double) -> Void) {
            action(sender.slider.doubleValue)
        }
    }
    
    @objc private func touchBarSegmentedAction(_ sender: NSPickerTouchBarItem) {
        if let action = sender.representedObject as? ((Int) -> Void) {
            action(sender.selectedIndex)
        }
    }
    
    @objc private func touchBarColorAction(_ sender: NSColorPickerTouchBarItem) {
        if let action = sender.representedObject as? ((NSColor) -> Void) {
            action(sender.color)
        }
    }
}

// MARK: - NSScrubberDataSource & NSScrubberDelegate
@available(macOS 10.12.2, *)
extension TouchBarController: NSScrubberDataSource, NSScrubberDelegate {
    
    func numberOfItems(for scrubber: NSScrubber) -> Int {
        if let config = scrubber.representedObject as? ScrubberConfig {
            return config.items.count
        }
        return 0
    }
    
    func scrubber(_ scrubber: NSScrubber, viewForItemAt index: Int) -> NSScrubberItemView {
        let itemView = NSScrubberTextItemView()
        
        if let config = scrubber.representedObject as? ScrubberConfig,
           index < config.items.count {
            let item = config.items[index]
            itemView.textField.stringValue = item.title ?? ""
        }
        
        return itemView
    }
    
    func scrubber(_ scrubber: NSScrubber, didSelectItemAt selectedIndex: Int) {
        if let config = scrubber.representedObject as? ScrubberConfig {
            config.selectionChangedAction(selectedIndex)
        }
    }
}

// MARK: - Touch Bar Layout Provider Protocol
protocol TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig]
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier]
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier]
    func principalIdentifier() -> NSTouchBarItem.Identifier?
}

// MARK: - Layout Providers

struct MainLayoutProvider: TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig] {
        return [
            TouchBarItemConfig(
                identifier: "quick_chat",
                type: .button,
                title: "Chat",
                image: NSImage(systemSymbolName: "message", accessibilityDescription: "Chat"),
                action: { /* Open chat */ },
                customizationLabel: "Quick Chat"
            ),
            
            TouchBarItemConfig(
                identifier: "graph_view",
                type: .button,
                title: "Graph",
                image: NSImage(systemSymbolName: "circle.grid.hex", accessibilityDescription: "Graph"),
                action: { /* Open graph */ },
                customizationLabel: "Graph View"
            ),
            
            TouchBarItemConfig(
                identifier: "search",
                type: .button,
                title: "Search",
                image: NSImage(systemSymbolName: "magnifyingglass", accessibilityDescription: "Search"),
                action: { /* Open search */ },
                customizationLabel: "Search"
            )
        ]
    }
    
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier] {
        return [
            NSTouchBarItem.Identifier("quick_chat"),
            NSTouchBarItem.Identifier("graph_view"),
            .flexibleSpace,
            NSTouchBarItem.Identifier("search")
        ]
    }
    
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier] {
        return defaultIdentifiers() + [
            .flexibleSpace,
            .fixedSpaceSmall,
            .fixedSpaceLarge
        ]
    }
    
    func principalIdentifier() -> NSTouchBarItem.Identifier? {
        return nil
    }
}

struct ChatLayoutProvider: TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig] {
        return [
            TouchBarItemConfig(
                identifier: "send_message",
                type: .button,
                title: "Send",
                image: NSImage(systemSymbolName: "paperplane.fill", accessibilityDescription: "Send"),
                action: { /* Send message */ },
                customizationLabel: "Send Message"
            ),
            
            TouchBarItemConfig(
                identifier: "voice_input",
                type: .button,
                title: "Voice",
                image: NSImage(systemSymbolName: "mic", accessibilityDescription: "Voice"),
                action: { /* Start voice input */ },
                customizationLabel: "Voice Input"
            ),
            
            TouchBarItemConfig(
                identifier: "model_selector",
                type: .segmentedControl,
                customizationLabel: "Model Selector",
                segmentedConfig: SegmentedConfig(
                    segments: [
                        SegmentedConfig.SegmentItem(title: "GPT-4", image: nil, width: nil),
                        SegmentedConfig.SegmentItem(title: "Claude", image: nil, width: nil),
                        SegmentedConfig.SegmentItem(title: "Local", image: nil, width: nil)
                    ],
                    selectedIndex: 0,
                    selectionChangedAction: { index in /* Change model */ }
                )
            ),
            
            TouchBarItemConfig(
                identifier: "temperature_slider",
                type: .slider,
                customizationLabel: "Temperature",
                sliderConfig: SliderConfig(
                    minValue: 0.0,
                    maxValue: 2.0,
                    currentValue: 0.7,
                    valueChangedAction: { value in /* Update temperature */ },
                    label: "Temp",
                    accessibilityDescription: "Model temperature"
                )
            )
        ]
    }
    
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier] {
        return [
            NSTouchBarItem.Identifier("voice_input"),
            NSTouchBarItem.Identifier("model_selector"),
            .flexibleSpace,
            NSTouchBarItem.Identifier("temperature_slider"),
            NSTouchBarItem.Identifier("send_message")
        ]
    }
    
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier] {
        return defaultIdentifiers() + [
            .flexibleSpace,
            .fixedSpaceSmall,
            .fixedSpaceLarge
        ]
    }
    
    func principalIdentifier() -> NSTouchBarItem.Identifier? {
        return NSTouchBarItem.Identifier("send_message")
    }
}

struct GraphLayoutProvider: TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig] {
        return [
            TouchBarItemConfig(
                identifier: "layout_selector",
                type: .segmentedControl,
                customizationLabel: "Layout",
                segmentedConfig: SegmentedConfig(
                    segments: [
                        SegmentedConfig.SegmentItem(title: "Force", image: nil, width: nil),
                        SegmentedConfig.SegmentItem(title: "Tree", image: nil, width: nil),
                        SegmentedConfig.SegmentItem(title: "Circle", image: nil, width: nil)
                    ],
                    selectedIndex: 0,
                    selectionChangedAction: { index in /* Change layout */ }
                )
            ),
            
            TouchBarItemConfig(
                identifier: "zoom_slider",
                type: .slider,
                customizationLabel: "Zoom",
                sliderConfig: SliderConfig(
                    minValue: 0.1,
                    maxValue: 3.0,
                    currentValue: 1.0,
                    valueChangedAction: { value in /* Update zoom */ },
                    label: "Zoom",
                    accessibilityDescription: "Graph zoom level"
                )
            ),
            
            TouchBarItemConfig(
                identifier: "filter_nodes",
                type: .button,
                title: "Filter",
                image: NSImage(systemSymbolName: "line.3.horizontal.decrease", accessibilityDescription: "Filter"),
                action: { /* Open filter */ },
                customizationLabel: "Filter Nodes"
            ),
            
            TouchBarItemConfig(
                identifier: "center_graph",
                type: .button,
                title: "Center",
                image: NSImage(systemSymbolName: "scope", accessibilityDescription: "Center"),
                action: { /* Center graph */ },
                customizationLabel: "Center Graph"
            )
        ]
    }
    
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier] {
        return [
            NSTouchBarItem.Identifier("layout_selector"),
            .flexibleSpace,
            NSTouchBarItem.Identifier("zoom_slider"),
            NSTouchBarItem.Identifier("filter_nodes"),
            NSTouchBarItem.Identifier("center_graph")
        ]
    }
    
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier] {
        return defaultIdentifiers() + [
            .flexibleSpace,
            .fixedSpaceSmall,
            .fixedSpaceLarge
        ]
    }
    
    func principalIdentifier() -> NSTouchBarItem.Identifier? {
        return NSTouchBarItem.Identifier("zoom_slider")
    }
}

struct ParametersLayoutProvider: TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig] {
        return [
            TouchBarItemConfig(
                identifier: "preset_scrubber",
                type: .scrubber,
                customizationLabel: "Presets",
                scrubberConfig: ScrubberConfig(
                    items: [
                        ScrubberConfig.ScrubberItem(title: "Default", image: nil, identifier: "default"),
                        ScrubberConfig.ScrubberItem(title: "Performance", image: nil, identifier: "performance"),
                        ScrubberConfig.ScrubberItem(title: "Quality", image: nil, identifier: "quality")
                    ],
                    selectedIndex: 0,
                    selectionChangedAction: { index in /* Load preset */ },
                    mode: .free
                )
            ),
            
            TouchBarItemConfig(
                identifier: "reset_params",
                type: .button,
                title: "Reset",
                image: NSImage(systemSymbolName: "arrow.counterclockwise", accessibilityDescription: "Reset"),
                action: { /* Reset parameters */ },
                customizationLabel: "Reset Parameters"
            ),
            
            TouchBarItemConfig(
                identifier: "apply_changes",
                type: .button,
                title: "Apply",
                image: NSImage(systemSymbolName: "checkmark", accessibilityDescription: "Apply"),
                action: { /* Apply changes */ },
                customizationLabel: "Apply Changes"
            )
        ]
    }
    
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier] {
        return [
            NSTouchBarItem.Identifier("preset_scrubber"),
            .flexibleSpace,
            NSTouchBarItem.Identifier("reset_params"),
            NSTouchBarItem.Identifier("apply_changes")
        ]
    }
    
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier] {
        return defaultIdentifiers() + [
            .flexibleSpace,
            .fixedSpaceSmall,
            .fixedSpaceLarge
        ]
    }
    
    func principalIdentifier() -> NSTouchBarItem.Identifier? {
        return NSTouchBarItem.Identifier("apply_changes")
    }
}

struct WorkflowLayoutProvider: TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig] {
        return [
            TouchBarItemConfig(
                identifier: "play_workflow",
                type: .button,
                title: "Play",
                image: NSImage(systemSymbolName: "play.fill", accessibilityDescription: "Play"),
                action: { /* Play workflow */ },
                customizationLabel: "Play Workflow"
            ),
            
            TouchBarItemConfig(
                identifier: "pause_workflow",
                type: .button,
                title: "Pause",
                image: NSImage(systemSymbolName: "pause.fill", accessibilityDescription: "Pause"),
                action: { /* Pause workflow */ },
                customizationLabel: "Pause Workflow"
            ),
            
            TouchBarItemConfig(
                identifier: "stop_workflow",
                type: .button,
                title: "Stop",
                image: NSImage(systemSymbolName: "stop.fill", accessibilityDescription: "Stop"),
                action: { /* Stop workflow */ },
                customizationLabel: "Stop Workflow"
            ),
            
            TouchBarItemConfig(
                identifier: "save_workflow",
                type: .button,
                title: "Save",
                image: NSImage(systemSymbolName: "square.and.arrow.down", accessibilityDescription: "Save"),
                action: { /* Save workflow */ },
                customizationLabel: "Save Workflow"
            )
        ]
    }
    
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier] {
        return [
            NSTouchBarItem.Identifier("play_workflow"),
            NSTouchBarItem.Identifier("pause_workflow"),
            NSTouchBarItem.Identifier("stop_workflow"),
            .flexibleSpace,
            NSTouchBarItem.Identifier("save_workflow")
        ]
    }
    
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier] {
        return defaultIdentifiers() + [
            .flexibleSpace,
            .fixedSpaceSmall,
            .fixedSpaceLarge
        ]
    }
    
    func principalIdentifier() -> NSTouchBarItem.Identifier? {
        return NSTouchBarItem.Identifier("play_workflow")
    }
}

struct DebugLayoutProvider: TouchBarLayoutProvider {
    func itemConfigs(for context: TouchBarContext) -> [TouchBarItemConfig] {
        return [
            TouchBarItemConfig(
                identifier: "console_toggle",
                type: .button,
                title: "Console",
                image: NSImage(systemSymbolName: "terminal", accessibilityDescription: "Console"),
                action: { /* Toggle console */ },
                customizationLabel: "Toggle Console"
            ),
            
            TouchBarItemConfig(
                identifier: "debug_step",
                type: .button,
                title: "Step",
                image: NSImage(systemSymbolName: "forward.frame", accessibilityDescription: "Step"),
                action: { /* Debug step */ },
                customizationLabel: "Debug Step"
            ),
            
            TouchBarItemConfig(
                identifier: "debug_continue",
                type: .button,
                title: "Continue",
                image: NSImage(systemSymbolName: "play", accessibilityDescription: "Continue"),
                action: { /* Debug continue */ },
                customizationLabel: "Debug Continue"
            )
        ]
    }
    
    func defaultIdentifiers() -> [NSTouchBarItem.Identifier] {
        return [
            NSTouchBarItem.Identifier("console_toggle"),
            .flexibleSpace,
            NSTouchBarItem.Identifier("debug_step"),
            NSTouchBarItem.Identifier("debug_continue")
        ]
    }
    
    func customizationAllowedIdentifiers() -> [NSTouchBarItem.Identifier] {
        return defaultIdentifiers() + [
            .flexibleSpace,
            .fixedSpaceSmall,
            .fixedSpaceLarge
        ]
    }
    
    func principalIdentifier() -> NSTouchBarItem.Identifier? {
        return nil
    }
}

// MARK: - Touch Bar Customization Controller
class TouchBarCustomizationController {
    weak var delegate: TouchBarCustomizationDelegate?
    
    func startCustomization() {
        // Start customization mode
        delegate?.customizationDidStart()
    }
    
    func endCustomization() {
        // End customization mode
        delegate?.customizationDidEnd()
    }
}

protocol TouchBarCustomizationDelegate: AnyObject {
    func customizationDidStart()
    func customizationDidEnd()
}

// MARK: - Touch Bar Customization Delegate
@available(macOS 10.12.2, *)
extension TouchBarController: TouchBarCustomizationDelegate {
    func customizationDidStart() {
        isCustomizing = true
    }
    
    func customizationDidEnd() {
        isCustomizing = false
    }
}