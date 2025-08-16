//
//  AdvancedGestureController.swift
//  UniversalAITools
//
//  Advanced gesture recognition and handling system for 3D graph manipulation
//  Supports multi-touch gestures, haptic feedback, and complex interactions
//

import SwiftUI
import AppKit
import Combine

// MARK: - Gesture Types
enum GestureType: CaseIterable {
    case pan
    case pinch
    case rotation
    case swipe
    case tap
    case doubleTap
    case longPress
    case forceTouch
    case trackpadPan
    case trackpadPinch
    case trackpadRotate
    case complexManipulation
}

// MARK: - Gesture State
struct GestureState {
    var isActive: Bool = false
    var velocity: CGPoint = .zero
    var acceleration: CGPoint = .zero
    var scale: Double = 1.0
    var rotation: Double = 0.0
    var translation: CGPoint = .zero
    var force: Double = 0.0
    var touchCount: Int = 0
    var timestamp = Date()
}

// MARK: - Gesture Configuration
struct GestureConfiguration {
    var minimumTouchCount: Int = 1
    var maximumTouchCount: Int = 10
    var minimumPressDuration: TimeInterval = 0.5
    var allowedGestureTypes: Set<GestureType> = Set(GestureType.allCases)
    var enableHapticFeedback: Bool = true
    var enableVelocityTracking: Bool = true
    var gestureConflictResolution: GestureConflictStrategy = .priority
}

enum GestureConflictStrategy {
    case priority
    case simultaneous
    case exclusive
}

// MARK: - Gesture Event
struct GestureEvent {
    let id = UUID()
    let type: GestureType
    let state: GestureState
    let location: CGPoint
    let timestamp = Date()
    let target: AnyView?
}

// MARK: - Gesture Delegate Protocol
protocol AdvancedGestureDelegate: AnyObject {
    func gestureDidBegin(_ gesture: GestureEvent)
    func gestureDidChange(_ gesture: GestureEvent)
    func gestureDidEnd(_ gesture: GestureEvent)
    func gestureDidCancel(_ gesture: GestureEvent)
    func shouldRecognizeGesture(_ type: GestureType, at location: CGPoint) -> Bool
    func gesturePriorityFor(_ type: GestureType) -> Int
}

// Default implementation
extension AdvancedGestureDelegate {
    func shouldRecognizeGesture(_ type: GestureType, at location: CGPoint) -> Bool { return true }
    func gesturePriorityFor(_ type: GestureType) -> Int { return 0 }
}

// MARK: - Advanced Gesture Controller
@MainActor
class AdvancedGestureController: ObservableObject {
    
    // MARK: - Published Properties
    @Published var activeGestures: [GestureEvent] = []
    @Published var gestureHistory: [GestureEvent] = []
    @Published var isTrackingVelocity: Bool = true
    @Published var hapticFeedbackEnabled: Bool = true
    
    // MARK: - Private Properties
    private var configuration: GestureConfiguration
    private weak var delegate: AdvancedGestureDelegate?
    private var velocityTracker: VelocityTracker
    private var hapticController: HapticController
    private var gestureRecognizers: [NSGestureRecognizer] = []
    private var gestureStates: [GestureType: GestureState] = [:]
    private var conflictResolver: GestureConflictResolver
    
    // Publishers
    private var cancellables = Set<AnyCancellable>()
    let gesturePublisher = PassthroughSubject<GestureEvent, Never>()
    
    // MARK: - Initialization
    init(configuration: GestureConfiguration = GestureConfiguration(), delegate: AdvancedGestureDelegate? = nil) {
        self.configuration = configuration
        self.delegate = delegate
        self.velocityTracker = VelocityTracker()
        self.hapticController = HapticController()
        self.conflictResolver = GestureConflictResolver(strategy: configuration.gestureConflictResolution)
        
        setupGestureRecognizers()
        setupPublishers()
    }
    
    // MARK: - Setup Methods
    private func setupGestureRecognizers() {
        // Clear existing recognizers
        gestureRecognizers.removeAll()
        
        // Pan gesture
        if configuration.allowedGestureTypes.contains(.pan) {
            let panGesture = NSPanGestureRecognizer(target: self, action: #selector(handlePanGesture(_:)))
            panGesture.minimumNumberOfTouches = configuration.minimumTouchCount
            panGesture.maximumNumberOfTouches = configuration.maximumTouchCount
            gestureRecognizers.append(panGesture)
        }
        
        // Pinch gesture
        if configuration.allowedGestureTypes.contains(.pinch) {
            let pinchGesture = NSMagnificationGestureRecognizer(target: self, action: #selector(handlePinchGesture(_:)))
            gestureRecognizers.append(pinchGesture)
        }
        
        // Rotation gesture
        if configuration.allowedGestureTypes.contains(.rotation) {
            let rotationGesture = NSRotationGestureRecognizer(target: self, action: #selector(handleRotationGesture(_:)))
            gestureRecognizers.append(rotationGesture)
        }
        
        // Click gesture
        if configuration.allowedGestureTypes.contains(.tap) {
            let clickGesture = NSClickGestureRecognizer(target: self, action: #selector(handleClickGesture(_:)))
            gestureRecognizers.append(clickGesture)
        }
        
        // Double click gesture
        if configuration.allowedGestureTypes.contains(.doubleTap) {
            let doubleClickGesture = NSClickGestureRecognizer(target: self, action: #selector(handleDoubleClickGesture(_:)))
            doubleClickGesture.numberOfClicksRequired = 2
            gestureRecognizers.append(doubleClickGesture)
        }
        
        // Long press gesture
        if configuration.allowedGestureTypes.contains(.longPress) {
            let longPressGesture = NSPressGestureRecognizer(target: self, action: #selector(handleLongPressGesture(_:)))
            longPressGesture.minimumPressDuration = configuration.minimumPressDuration
            gestureRecognizers.append(longPressGesture)
        }
        
        // Setup gesture priorities and dependencies
        setupGestureDependencies()
    }
    
    private func setupGestureDependencies() {
        // Configure gesture recognizer dependencies to handle conflicts
        for recognizer in gestureRecognizers {
            recognizer.delegate = self
        }
        
        // Set up specific dependencies
        let doubleClick = gestureRecognizers.first { $0 is NSClickGestureRecognizer && ($0 as! NSClickGestureRecognizer).numberOfClicksRequired == 2 }
        let singleClick = gestureRecognizers.first { $0 is NSClickGestureRecognizer && ($0 as! NSClickGestureRecognizer).numberOfClicksRequired == 1 }
        
        if let doubleClick = doubleClick, let singleClick = singleClick {
            singleClick.shouldRequireFailure(of: doubleClick)
        }
    }
    
    private func setupPublishers() {
        gesturePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] gesture in
                self?.processGestureEvent(gesture)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Public Methods
    func attachToView(_ view: NSView) {
        for recognizer in gestureRecognizers {
            view.addGestureRecognizer(recognizer)
        }
    }
    
    func detachFromView(_ view: NSView) {
        for recognizer in gestureRecognizers {
            view.removeGestureRecognizer(recognizer)
        }
    }
    
    func updateConfiguration(_ newConfiguration: GestureConfiguration) {
        configuration = newConfiguration
        setupGestureRecognizers()
    }
    
    func enableGestureType(_ type: GestureType) {
        configuration.allowedGestureTypes.insert(type)
        setupGestureRecognizers()
    }
    
    func disableGestureType(_ type: GestureType) {
        configuration.allowedGestureTypes.remove(type)
        setupGestureRecognizers()
    }
    
    func clearGestureHistory() {
        gestureHistory.removeAll()
    }
    
    // MARK: - Gesture Handlers
    @objc private func handlePanGesture(_ recognizer: NSPanGestureRecognizer) {
        let location = recognizer.location(in: recognizer.view)
        let translation = recognizer.translation(in: recognizer.view)
        let velocity = recognizer.velocity(in: recognizer.view)
        
        var state = gestureStates[.pan] ?? GestureState()
        state.translation = translation
        state.velocity = velocity
        state.isActive = recognizer.state == .began || recognizer.state == .changed
        state.timestamp = Date()
        
        if isTrackingVelocity {
            state.acceleration = velocityTracker.updateVelocity(velocity, for: .pan)
        }
        
        gestureStates[.pan] = state
        
        let event = GestureEvent(type: .pan, state: state, location: location, target: nil)
        
        switch recognizer.state {
        case .began:
            delegate?.gestureDidBegin(event)
            triggerHapticFeedback(for: .pan, intensity: 0.3)
        case .changed:
            delegate?.gestureDidChange(event)
        case .ended:
            state.isActive = false
            gestureStates[.pan] = state
            delegate?.gestureDidEnd(event)
            triggerHapticFeedback(for: .pan, intensity: 0.2)
        case .cancelled:
            state.isActive = false
            gestureStates[.pan] = state
            delegate?.gestureDidCancel(event)
        default:
            break
        }
        
        gesturePublisher.send(event)
    }
    
    @objc private func handlePinchGesture(_ recognizer: NSMagnificationGestureRecognizer) {
        let location = recognizer.location(in: recognizer.view)
        let scale = recognizer.magnification + 1.0
        
        var state = gestureStates[.pinch] ?? GestureState()
        state.scale = scale
        state.isActive = recognizer.state == .began || recognizer.state == .changed
        state.timestamp = Date()
        
        gestureStates[.pinch] = state
        
        let event = GestureEvent(type: .pinch, state: state, location: location, target: nil)
        
        switch recognizer.state {
        case .began:
            delegate?.gestureDidBegin(event)
            triggerHapticFeedback(for: .pinch, intensity: 0.4)
        case .changed:
            delegate?.gestureDidChange(event)
        case .ended:
            state.isActive = false
            gestureStates[.pinch] = state
            delegate?.gestureDidEnd(event)
            triggerHapticFeedback(for: .pinch, intensity: 0.3)
        case .cancelled:
            state.isActive = false
            gestureStates[.pinch] = state
            delegate?.gestureDidCancel(event)
        default:
            break
        }
        
        gesturePublisher.send(event)
    }
    
    @objc private func handleRotationGesture(_ recognizer: NSRotationGestureRecognizer) {
        let location = recognizer.location(in: recognizer.view)
        let rotation = recognizer.rotation
        
        var state = gestureStates[.rotation] ?? GestureState()
        state.rotation = rotation
        state.isActive = recognizer.state == .began || recognizer.state == .changed
        state.timestamp = Date()
        
        gestureStates[.rotation] = state
        
        let event = GestureEvent(type: .rotation, state: state, location: location, target: nil)
        
        switch recognizer.state {
        case .began:
            delegate?.gestureDidBegin(event)
            triggerHapticFeedback(for: .rotation, intensity: 0.35)
        case .changed:
            delegate?.gestureDidChange(event)
        case .ended:
            state.isActive = false
            gestureStates[.rotation] = state
            delegate?.gestureDidEnd(event)
            triggerHapticFeedback(for: .rotation, intensity: 0.25)
        case .cancelled:
            state.isActive = false
            gestureStates[.rotation] = state
            delegate?.gestureDidCancel(event)
        default:
            break
        }
        
        gesturePublisher.send(event)
    }
    
    @objc private func handleClickGesture(_ recognizer: NSClickGestureRecognizer) {
        let location = recognizer.location(in: recognizer.view)
        
        var state = gestureStates[.tap] ?? GestureState()
        state.isActive = recognizer.state == .began
        state.timestamp = Date()
        
        gestureStates[.tap] = state
        
        let event = GestureEvent(type: .tap, state: state, location: location, target: nil)
        
        if recognizer.state == .ended {
            delegate?.gestureDidEnd(event)
            triggerHapticFeedback(for: .tap, intensity: 0.2)
            gesturePublisher.send(event)
        }
    }
    
    @objc private func handleDoubleClickGesture(_ recognizer: NSClickGestureRecognizer) {
        let location = recognizer.location(in: recognizer.view)
        
        var state = gestureStates[.doubleTap] ?? GestureState()
        state.isActive = recognizer.state == .began
        state.timestamp = Date()
        
        gestureStates[.doubleTap] = state
        
        let event = GestureEvent(type: .doubleTap, state: state, location: location, target: nil)
        
        if recognizer.state == .ended {
            delegate?.gestureDidEnd(event)
            triggerHapticFeedback(for: .doubleTap, intensity: 0.4)
            gesturePublisher.send(event)
        }
    }
    
    @objc private func handleLongPressGesture(_ recognizer: NSPressGestureRecognizer) {
        let location = recognizer.location(in: recognizer.view)
        
        var state = gestureStates[.longPress] ?? GestureState()
        state.isActive = recognizer.state == .began || recognizer.state == .changed
        state.timestamp = Date()
        
        gestureStates[.longPress] = state
        
        let event = GestureEvent(type: .longPress, state: state, location: location, target: nil)
        
        switch recognizer.state {
        case .began:
            delegate?.gestureDidBegin(event)
            triggerHapticFeedback(for: .longPress, intensity: 0.5)
        case .ended:
            state.isActive = false
            gestureStates[.longPress] = state
            delegate?.gestureDidEnd(event)
        case .cancelled:
            state.isActive = false
            gestureStates[.longPress] = state
            delegate?.gestureDidCancel(event)
        default:
            break
        }
        
        gesturePublisher.send(event)
    }
    
    // MARK: - Private Methods
    private func processGestureEvent(_ event: GestureEvent) {
        // Add to active gestures if active
        if event.state.isActive {
            if !activeGestures.contains(where: { $0.type == event.type }) {
                activeGestures.append(event)
            } else {
                // Update existing gesture
                if let index = activeGestures.firstIndex(where: { $0.type == event.type }) {
                    activeGestures[index] = event
                }
            }
        } else {
            // Remove from active gestures
            activeGestures.removeAll { $0.type == event.type }
        }
        
        // Add to history (keep last 100 events)
        gestureHistory.append(event)
        if gestureHistory.count > 100 {
            gestureHistory.removeFirst()
        }
        
        // Resolve conflicts if multiple gestures are active
        conflictResolver.resolveConflicts(activeGestures)
    }
    
    private func triggerHapticFeedback(for gestureType: GestureType, intensity: Double) {
        guard hapticFeedbackEnabled && configuration.enableHapticFeedback else { return }
        hapticController.triggerFeedback(for: gestureType, intensity: intensity)
    }
}

// MARK: - NSGestureRecognizerDelegate
extension AdvancedGestureController: NSGestureRecognizerDelegate {
    func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer, shouldAttemptToRecognizeWith event: NSEvent) -> Bool {
        guard let view = gestureRecognizer.view else { return false }
        let location = gestureRecognizer.location(in: view)
        
        // Check with delegate
        let gestureType = gestureTypeForRecognizer(gestureRecognizer)
        return delegate?.shouldRecognizeGesture(gestureType, at: location) ?? true
    }
    
    func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: NSGestureRecognizer) -> Bool {
        return configuration.gestureConflictResolution == .simultaneous
    }
    
    private func gestureTypeForRecognizer(_ recognizer: NSGestureRecognizer) -> GestureType {
        switch recognizer {
        case is NSPanGestureRecognizer:
            return .pan
        case is NSMagnificationGestureRecognizer:
            return .pinch
        case is NSRotationGestureRecognizer:
            return .rotation
        case let clickRecognizer as NSClickGestureRecognizer:
            return clickRecognizer.numberOfClicksRequired == 2 ? .doubleTap : .tap
        case is NSPressGestureRecognizer:
            return .longPress
        default:
            return .tap
        }
    }
}

// MARK: - Supporting Classes

class VelocityTracker {
    private var velocityHistory: [GestureType: [CGPoint]] = [:]
    private let maxHistoryCount = 5
    
    func updateVelocity(_ velocity: CGPoint, for gestureType: GestureType) -> CGPoint {
        var history = velocityHistory[gestureType] ?? []
        history.append(velocity)
        
        if history.count > maxHistoryCount {
            history.removeFirst()
        }
        
        velocityHistory[gestureType] = history
        
        // Calculate acceleration (change in velocity)
        if history.count >= 2 {
            let previous = history[history.count - 2]
            return CGPoint(x: velocity.x - previous.x, y: velocity.y - previous.y)
        }
        
        return .zero
    }
}

class HapticController {
    func triggerFeedback(for gestureType: GestureType, intensity: Double) {
        // macOS haptic feedback simulation
        DispatchQueue.main.async {
            NSHapticFeedbackManager.defaultPerformer.perform(.generic, performanceTime: .now)
        }
    }
}

class GestureConflictResolver {
    private let strategy: GestureConflictStrategy
    
    init(strategy: GestureConflictStrategy) {
        self.strategy = strategy
    }
    
    func resolveConflicts(_ gestures: [GestureEvent]) {
        guard gestures.count > 1 else { return }
        
        switch strategy {
        case .priority:
            resolvePriorityConflicts(gestures)
        case .simultaneous:
            // Allow all gestures to proceed
            break
        case .exclusive:
            resolveExclusiveConflicts(gestures)
        }
    }
    
    private func resolvePriorityConflicts(_ gestures: [GestureEvent]) {
        // Implement priority-based conflict resolution
        // Higher priority gestures override lower priority ones
    }
    
    private func resolveExclusiveConflicts(_ gestures: [GestureEvent]) {
        // Only allow one gesture at a time
        // Cancel all but the first gesture
    }
}
