//
//  InteractiveGraphNavigation.swift
//  UniversalAITools
//
//  Enhanced 3D graph navigation controls with first-person navigation,
//  orbit controls, path-based navigation, and smooth camera transitions
//

import SwiftUI
import SceneKit
import simd
import Combine

// MARK: - Navigation Mode
enum NavigationMode: String, CaseIterable {
    case orbit = "orbit"
    case firstPerson = "first_person"
    case path = "path"
    case follow = "follow"
    case overview = "overview"
}

// MARK: - Camera State
struct CameraState {
    var position: simd_float3
    var target: simd_float3
    var up: simd_float3
    var fov: Float
    var near: Float
    var far: Float
    
    static let `default` = CameraState(
        position: simd_float3(0, 0, 10),
        target: simd_float3(0, 0, 0),
        up: simd_float3(0, 1, 0),
        fov: 60.0,
        near: 0.1,
        far: 1000.0
    )
}

// MARK: - Bookmark
struct NavigationBookmark: Identifiable, Codable {
    let id = UUID()
    let name: String
    let description: String
    let cameraState: CameraStateData
    let createdAt: Date = Date()
    
    struct CameraStateData: Codable {
        let position: [Float]
        let target: [Float]
        let up: [Float]
        let fov: Float
    }
}

// MARK: - Path Waypoint
struct PathWaypoint: Identifiable {
    let id = UUID()
    let position: simd_float3
    let target: simd_float3
    let duration: TimeInterval
    let easing: EasingFunction
}

enum EasingFunction {
    case linear
    case easeInOut
    case easeIn
    case easeOut
    case bounce
}

// MARK: - Navigation Path
struct NavigationPath: Identifiable {
    let id = UUID()
    let name: String
    let waypoints: [PathWaypoint]
    let isLooping: Bool
    let totalDuration: TimeInterval
}

// MARK: - Interactive Graph Navigation
struct InteractiveGraphNavigation: View {
    @StateObject private var navigationController = NavigationController()
    @StateObject private var bookmarkManager = BookmarkManager()
    @StateObject private var pathManager = PathManager()
    @StateObject private var animationController = AnimationController()
    
    @State private var selectedMode: NavigationMode = .orbit
    @State private var showControls: Bool = true
    @State private var showMinimap: Bool = true
    @State private var showBookmarks: Bool = false
    @State private var showPathEditor: Bool = false
    @State private var isNavigating: Bool = false
    @State private var currentSpeed: Float = 1.0
    @State private var smoothTransitions: Bool = true
    @State private var autoFocus: Bool = true
    
    var body: some View {
        ZStack {
            // Main 3D Scene
            sceneView
            
            // Navigation Controls Overlay
            VStack {
                if showControls {
                    navigationControlsOverlay
                        .padding()
                }
                
                Spacer()
                
                HStack {
                    if showMinimap {
                        minimapView
                            .frame(width: 200, height: 150)
                            .padding()
                    }
                    
                    Spacer()
                    
                    // Speed and mode indicators
                    navigationStatusView
                        .padding()
                }
            }
            
            // Bookmarks Panel
            if showBookmarks {
                bookmarksPanel
                    .frame(width: 300)
                    .background(Color(.controlBackgroundColor))
                    .transition(.move(edge: .trailing))
            }
            
            // Path Editor Panel
            if showPathEditor {
                pathEditorPanel
                    .frame(width: 350)
                    .background(Color(.controlBackgroundColor))
                    .transition(.move(edge: .leading))
            }
        }
        .onAppear {
            setupNavigation()
        }
        .gesture(navigationGestures)
    }
    
    // MARK: - Scene View
    private var sceneView: some View {
        SceneKitView(navigationController: navigationController)
            .allowsHitTesting(true)
    }
    
    // MARK: - Navigation Controls Overlay
    private var navigationControlsOverlay: some View {
        VStack(spacing: 16) {
            // Mode Selection
            HStack {
                Text("Navigation Mode")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Picker("Mode", selection: $selectedMode) {
                    ForEach(NavigationMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue.capitalized).tag(mode)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .frame(width: 300)
                .onChange(of: selectedMode) { newMode in
                    navigationController.setMode(newMode)
                }
            }
            
            // Mode-specific controls
            Group {
                switch selectedMode {
                case .orbit:
                    orbitControls
                case .firstPerson:
                    firstPersonControls
                case .path:
                    pathControls
                case .follow:
                    followControls
                case .overview:
                    overviewControls
                }
            }
            
            // Common controls
            commonControls
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.controlBackgroundColor).opacity(0.9))
                .backdrop(BlurEffect(style: .regular))
        )
    }
    
    private var orbitControls: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Orbit Controls")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: resetOrbitView) {
                    Text("Reset View")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            HStack {
                VStack(alignment: .leading) {
                    Text("Distance")
                        .font(.caption)
                    Slider(value: $navigationController.orbitDistance, in: 1...100)
                        .frame(width: 120)
                }
                
                VStack(alignment: .leading) {
                    Text("Auto Rotate")
                        .font(.caption)
                    Toggle("", isOn: $navigationController.autoRotate)
                }
                
                VStack(alignment: .leading) {
                    Text("Focal Point")
                        .font(.caption)
                    Button(action: setFocalPoint) {
                        Text("Set")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
        }
    }
    
    private var firstPersonControls: some View {
        VStack(spacing: 12) {
            HStack {
                Text("First Person Controls")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: enterFlyMode) {
                    Text("Fly Mode")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            HStack {
                VStack(alignment: .leading) {
                    Text("Movement Speed")
                        .font(.caption)
                    Slider(value: $currentSpeed, in: 0.1...10.0)
                        .frame(width: 150)
                }
                
                VStack(alignment: .leading) {
                    Text("Mouse Sensitivity")
                        .font(.caption)
                    Slider(value: $navigationController.mouseSensitivity, in: 0.1...5.0)
                        .frame(width: 120)
                }
            }
            
            // Movement keys indicator
            movementKeysIndicator
        }
    }
    
    private var pathControls: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Path Navigation")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: { showPathEditor.toggle() }) {
                    Text("Edit Paths")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            if let currentPath = pathManager.currentPath {
                HStack {
                    Button(action: playPath) {
                        Image(systemName: isNavigating ? "pause.fill" : "play.fill")
                            .foregroundColor(.blue)
                    }
                    
                    Text(currentPath.name)
                        .font(.caption)
                    
                    Spacer()
                    
                    Text("\(pathManager.currentWaypointIndex + 1)/\(currentPath.waypoints.count)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                Text("No path selected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
    
    private var followControls: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Follow Mode")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: selectFollowTarget) {
                    Text("Select Target")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            if let target = navigationController.followTarget {
                HStack {
                    Text("Following: \(target)")
                        .font(.caption)
                    
                    Spacer()
                    
                    Button(action: stopFollowing) {
                        Text("Stop")
                            .font(.caption)
                            .foregroundColor(.red)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            
            HStack {
                VStack(alignment: .leading) {
                    Text("Follow Distance")
                        .font(.caption)
                    Slider(value: $navigationController.followDistance, in: 1...20)
                        .frame(width: 120)
                }
                
                VStack(alignment: .leading) {
                    Text("Smoothing")
                        .font(.caption)
                    Slider(value: $navigationController.followSmoothing, in: 0.1...1.0)
                        .frame(width: 120)
                }
            }
        }
    }
    
    private var overviewControls: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Overview Mode")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: fitToGraph) {
                    Text("Fit to Graph")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            HStack {
                Button(action: viewFromTop) {
                    Text("Top View")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                
                Button(action: viewFromSide) {
                    Text("Side View")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
                
                Button(action: viewFromFront) {
                    Text("Front View")
                        .font(.caption)
                        .foregroundColor(.blue)
                }
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
    
    private var commonControls: some View {
        HStack {
            // Bookmarks
            Button(action: { showBookmarks.toggle() }) {
                HStack(spacing: 4) {
                    Image(systemName: "bookmark")
                    Text("Bookmarks")
                }
                .font(.caption)
                .foregroundColor(.blue)
            }
            
            // Save current view
            Button(action: saveCurrentView) {
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                    Text("Save View")
                }
                .font(.caption)
                .foregroundColor(.blue)
            }
            
            Spacer()
            
            // Settings
            Toggle("Smooth", isOn: $smoothTransitions)
                .font(.caption)
            
            Toggle("Auto Focus", isOn: $autoFocus)
                .font(.caption)
            
            // Hide controls button
            Button(action: { showControls.toggle() }) {
                Image(systemName: "eye.slash")
                    .foregroundColor(.secondary)
            }
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    private var movementKeysIndicator: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Controls:")
                .font(.caption)
                .fontWeight(.medium)
            
            HStack(spacing: 16) {
                VStack(spacing: 2) {
                    Text("WASD")
                        .font(.caption2)
                        .fontWeight(.medium)
                    Text("Move")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                VStack(spacing: 2) {
                    Text("QE")
                        .font(.caption2)
                        .fontWeight(.medium)
                    Text("Up/Down")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                VStack(spacing: 2) {
                    Text("Shift")
                        .font(.caption2)
                        .fontWeight(.medium)
                    Text("Fast")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                VStack(spacing: 2) {
                    Text("Mouse")
                        .font(.caption2)
                        .fontWeight(.medium)
                    Text("Look")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(8)
        .background(Color(.controlColor))
        .cornerRadius(6)
    }
    
    // MARK: - Minimap View
    private var minimapView: some View {
        ZStack {
            // Minimap background
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.controlBackgroundColor))
                .stroke(Color.gray.opacity(0.3), lineWidth: 1)
            
            // Minimap content (placeholder)
            VStack {
                Text("Minimap")
                    .font(.caption)
                    .fontWeight(.medium)
                
                // Camera position indicator
                ZStack {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                    
                    // Direction indicator
                    Path { path in
                        path.move(to: CGPoint(x: 0, y: -10))
                        path.addLine(to: CGPoint(x: 0, y: -15))
                    }
                    .stroke(Color.blue, lineWidth: 2)
                    .rotationEffect(.degrees(Double(navigationController.yaw)))
                }
                .frame(width: 100, height: 80)
                .background(Color(.controlColor))
                .cornerRadius(4)
            }
            .padding()
        }
    }
    
    // MARK: - Navigation Status View
    private var navigationStatusView: some View {
        VStack(alignment: .trailing, spacing: 4) {
            HStack(spacing: 8) {
                // Mode indicator
                Text(selectedMode.rawValue.capitalized)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(4)
                
                // Speed indicator
                if selectedMode == .firstPerson {
                    Text("Speed: \(currentSpeed, specifier: "%.1f")x")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            // Position info
            Text("X: \(navigationController.cameraState.position.x, specifier: "%.1f")")
                .font(.caption2)
                .foregroundColor(.secondary)
            Text("Y: \(navigationController.cameraState.position.y, specifier: "%.1f")")
                .font(.caption2)
                .foregroundColor(.secondary)
            Text("Z: \(navigationController.cameraState.position.z, specifier: "%.1f")")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(Color(.controlBackgroundColor).opacity(0.8))
        )
    }
    
    // MARK: - Bookmarks Panel
    private var bookmarksPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Bookmarks")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { showBookmarks = false }) {
                    Image(systemName: "xmark")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(bookmarkManager.bookmarks) { bookmark in
                        bookmarkCard(bookmark)
                    }
                }
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func bookmarkCard(_ bookmark: NavigationBookmark) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(bookmark.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: { navigateToBookmark(bookmark) }) {
                    Image(systemName: "location")
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            Text(bookmark.description)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            Text(bookmark.createdAt, style: .relative)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(Color(.controlColor))
        .cornerRadius(6)
    }
    
    // MARK: - Path Editor Panel
    private var pathEditorPanel: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Path Editor")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { showPathEditor = false }) {
                    Image(systemName: "xmark")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            // Path list
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(pathManager.paths) { path in
                        pathCard(path)
                    }
                }
            }
            
            // Path creation controls
            VStack(spacing: 8) {
                Button(action: startRecordingPath) {
                    HStack {
                        Image(systemName: "plus.circle")
                        Text("Record New Path")
                    }
                    .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
                
                if pathManager.isRecording {
                    HStack {
                        Button(action: addWaypoint) {
                            Text("Add Waypoint")
                                .foregroundColor(.green)
                        }
                        
                        Button(action: stopRecordingPath) {
                            Text("Stop Recording")
                                .foregroundColor(.red)
                        }
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func pathCard(_ path: NavigationPath) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(path.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: { selectPath(path) }) {
                    Image(systemName: "play")
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            Text("\(path.waypoints.count) waypoints")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("Duration: \(path.totalDuration, specifier: "%.1f")s")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(8)
        .background(pathManager.currentPath?.id == path.id ? Color.blue.opacity(0.2) : Color(.controlColor))
        .cornerRadius(6)
    }
    
    // MARK: - Gestures
    private var navigationGestures: some Gesture {
        SimultaneousGesture(
            // Pan gesture for orbit/first-person look
            DragGesture()
                .onChanged { value in
                    handleDragGesture(value)
                },
            
            // Magnification for zoom
            MagnificationGesture()
                .onChanged { value in
                    handleZoomGesture(value)
                }
        )
    }
    
    // MARK: - Methods
    private func setupNavigation() {
        navigationController.setup()
        bookmarkManager.loadBookmarks()
        pathManager.loadPaths()
    }
    
    private func handleDragGesture(_ value: DragGesture.Value) {
        switch selectedMode {
        case .orbit:
            navigationController.handleOrbitDrag(value.translation)
        case .firstPerson:
            navigationController.handleFirstPersonLook(value.translation)
        default:
            break
        }
    }
    
    private func handleZoomGesture(_ value: MagnificationGesture.Value) {
        navigationController.handleZoom(value)
    }
    
    // MARK: - Control Actions
    private func resetOrbitView() {
        navigationController.resetOrbitView()
    }
    
    private func setFocalPoint() {
        navigationController.setFocalPointFromSelection()
    }
    
    private func enterFlyMode() {
        navigationController.enterFlyMode()
    }
    
    private func playPath() {
        if isNavigating {
            pathManager.pauseCurrentPath()
        } else {
            pathManager.playCurrentPath()
        }
        isNavigating.toggle()
    }
    
    private func selectFollowTarget() {
        navigationController.selectFollowTargetFromSelection()
    }
    
    private func stopFollowing() {
        navigationController.stopFollowing()
    }
    
    private func fitToGraph() {
        navigationController.fitToGraph()
    }
    
    private func viewFromTop() {
        navigationController.viewFromTop()
    }
    
    private func viewFromSide() {
        navigationController.viewFromSide()
    }
    
    private func viewFromFront() {
        navigationController.viewFromFront()
    }
    
    private func saveCurrentView() {
        bookmarkManager.saveCurrentView(navigationController.cameraState)
    }
    
    private func navigateToBookmark(_ bookmark: NavigationBookmark) {
        navigationController.navigateToBookmark(bookmark, smooth: smoothTransitions)
    }
    
    private func selectPath(_ path: NavigationPath) {
        pathManager.selectPath(path)
    }
    
    private func startRecordingPath() {
        pathManager.startRecordingPath()
    }
    
    private func addWaypoint() {
        pathManager.addWaypoint(navigationController.cameraState)
    }
    
    private func stopRecordingPath() {
        pathManager.stopRecordingPath()
    }
}

// MARK: - SceneKit View
struct SceneKitView: NSViewRepresentable {
    let navigationController: NavigationController
    
    func makeNSView(context: Context) -> SCNView {
        let sceneView = SCNView()
        sceneView.scene = navigationController.scene
        sceneView.allowsCameraControl = false
        sceneView.backgroundColor = NSColor.black
        sceneView.autoenablesDefaultLighting = true
        
        // Set up camera
        sceneView.pointOfView = navigationController.cameraNode
        
        return sceneView
    }
    
    func updateNSView(_ nsView: SCNView, context: Context) {
        // Update scene if needed
    }
}

// MARK: - Navigation Controller
@MainActor
class NavigationController: ObservableObject {
    @Published var cameraState = CameraState.default
    @Published var orbitDistance: Float = 10.0
    @Published var autoRotate: Bool = false
    @Published var mouseSensitivity: Float = 1.0
    @Published var followTarget: String?
    @Published var followDistance: Float = 5.0
    @Published var followSmoothing: Float = 0.5
    @Published var yaw: Float = 0.0
    @Published var pitch: Float = 0.0
    
    let scene = SCNScene()
    let cameraNode = SCNNode()
    private var currentMode: NavigationMode = .orbit
    private var animationTimer: Timer?
    
    func setup() {
        // Set up camera
        cameraNode.camera = SCNCamera()
        cameraNode.camera?.fieldOfView = CGFloat(cameraState.fov)
        cameraNode.camera?.zNear = Double(cameraState.near)
        cameraNode.camera?.zFar = Double(cameraState.far)
        scene.rootNode.addChildNode(cameraNode)
        
        updateCameraPosition()
    }
    
    func setMode(_ mode: NavigationMode) {
        currentMode = mode
        
        switch mode {
        case .orbit:
            setupOrbitMode()
        case .firstPerson:
            setupFirstPersonMode()
        case .path:
            setupPathMode()
        case .follow:
            setupFollowMode()
        case .overview:
            setupOverviewMode()
        }
    }
    
    private func updateCameraPosition() {
        cameraNode.position = SCNVector3(
            cameraState.position.x,
            cameraState.position.y,
            cameraState.position.z
        )
        
        cameraNode.look(at: SCNVector3(
            cameraState.target.x,
            cameraState.target.y,
            cameraState.target.z
        ))
    }
    
    // MARK: - Mode Implementations
    private func setupOrbitMode() {
        // Configure orbit mode
    }
    
    private func setupFirstPersonMode() {
        // Configure first-person mode
    }
    
    private func setupPathMode() {
        // Configure path mode
    }
    
    private func setupFollowMode() {
        // Configure follow mode
    }
    
    private func setupOverviewMode() {
        // Configure overview mode
    }
    
    // MARK: - Gesture Handlers
    func handleOrbitDrag(_ translation: CGSize) {
        yaw += Float(translation.x) * 0.01 * mouseSensitivity
        pitch += Float(translation.y) * 0.01 * mouseSensitivity
        pitch = max(-Float.pi/2, min(Float.pi/2, pitch))
        
        updateOrbitPosition()
    }
    
    func handleFirstPersonLook(_ translation: CGSize) {
        yaw += Float(translation.x) * 0.01 * mouseSensitivity
        pitch += Float(translation.y) * 0.01 * mouseSensitivity
        pitch = max(-Float.pi/2, min(Float.pi/2, pitch))
        
        updateFirstPersonRotation()
    }
    
    func handleZoom(_ value: MagnificationGesture.Value) {
        orbitDistance *= Float(2.0 - value)
        orbitDistance = max(1.0, min(100.0, orbitDistance))
        
        if currentMode == .orbit {
            updateOrbitPosition()
        }
    }
    
    private func updateOrbitPosition() {
        let x = orbitDistance * cos(pitch) * sin(yaw)
        let y = orbitDistance * sin(pitch)
        let z = orbitDistance * cos(pitch) * cos(yaw)
        
        cameraState.position = cameraState.target + simd_float3(x, y, z)
        updateCameraPosition()
    }
    
    private func updateFirstPersonRotation() {
        cameraNode.eulerAngles = SCNVector3(pitch, yaw, 0)
    }
    
    // MARK: - Navigation Actions
    func resetOrbitView() {
        yaw = 0
        pitch = 0
        orbitDistance = 10
        updateOrbitPosition()
    }
    
    func setFocalPointFromSelection() {
        // Set focal point based on selected object
    }
    
    func enterFlyMode() {
        // Enable fly mode controls
    }
    
    func selectFollowTargetFromSelection() {
        // Set follow target from selection
    }
    
    func stopFollowing() {
        followTarget = nil
    }
    
    func fitToGraph() {
        // Calculate bounds and fit camera
    }
    
    func viewFromTop() {
        pitch = -Float.pi/2
        yaw = 0
        updateOrbitPosition()
    }
    
    func viewFromSide() {
        pitch = 0
        yaw = Float.pi/2
        updateOrbitPosition()
    }
    
    func viewFromFront() {
        pitch = 0
        yaw = 0
        updateOrbitPosition()
    }
    
    func navigateToBookmark(_ bookmark: NavigationBookmark, smooth: Bool) {
        let targetState = CameraState(
            position: simd_float3(
                bookmark.cameraState.position[0],
                bookmark.cameraState.position[1],
                bookmark.cameraState.position[2]
            ),
            target: simd_float3(
                bookmark.cameraState.target[0],
                bookmark.cameraState.target[1],
                bookmark.cameraState.target[2]
            ),
            up: simd_float3(
                bookmark.cameraState.up[0],
                bookmark.cameraState.up[1],
                bookmark.cameraState.up[2]
            ),
            fov: bookmark.cameraState.fov,
            near: cameraState.near,
            far: cameraState.far
        )
        
        if smooth {
            animateToState(targetState)
        } else {
            cameraState = targetState
            updateCameraPosition()
        }
    }
    
    private func animateToState(_ targetState: CameraState) {
        // Implement smooth camera transition
        let duration: TimeInterval = 1.0
        let startState = cameraState
        let startTime = Date()
        
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1/60, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            
            let elapsed = Date().timeIntervalSince(startTime)
            let progress = min(elapsed / duration, 1.0)
            let easedProgress = easeInOut(Float(progress))
            
            self.cameraState.position = simd_mix(startState.position, targetState.position, simd_float3(easedProgress))
            self.cameraState.target = simd_mix(startState.target, targetState.target, simd_float3(easedProgress))
            self.cameraState.fov = startState.fov + (targetState.fov - startState.fov) * easedProgress
            
            self.updateCameraPosition()
            
            if progress >= 1.0 {
                self.animationTimer?.invalidate()
                self.animationTimer = nil
            }
        }
    }
    
    private func easeInOut(_ t: Float) -> Float {
        return t * t * (3.0 - 2.0 * t)
    }
}

// MARK: - Supporting Managers
@MainActor
class BookmarkManager: ObservableObject {
    @Published var bookmarks: [NavigationBookmark] = []
    
    func loadBookmarks() {
        // Load saved bookmarks
        bookmarks = [
            NavigationBookmark(
                name: "Graph Center",
                description: "Overview of the entire graph",
                cameraState: NavigationBookmark.CameraStateData(
                    position: [0, 0, 20],
                    target: [0, 0, 0],
                    up: [0, 1, 0],
                    fov: 60
                )
            )
        ]
    }
    
    func saveCurrentView(_ cameraState: CameraState) {
        let bookmark = NavigationBookmark(
            name: "Saved View \(bookmarks.count + 1)",
            description: "Custom saved viewpoint",
            cameraState: NavigationBookmark.CameraStateData(
                position: [cameraState.position.x, cameraState.position.y, cameraState.position.z],
                target: [cameraState.target.x, cameraState.target.y, cameraState.target.z],
                up: [cameraState.up.x, cameraState.up.y, cameraState.up.z],
                fov: cameraState.fov
            )
        )
        bookmarks.append(bookmark)
    }
}

@MainActor
class PathManager: ObservableObject {
    @Published var paths: [NavigationPath] = []
    @Published var currentPath: NavigationPath?
    @Published var currentWaypointIndex: Int = 0
    @Published var isRecording: Bool = false
    
    private var recordingWaypoints: [PathWaypoint] = []
    
    func loadPaths() {
        // Load saved paths
        paths = []
    }
    
    func selectPath(_ path: NavigationPath) {
        currentPath = path
        currentWaypointIndex = 0
    }
    
    func playCurrentPath() {
        // Start path playback
    }
    
    func pauseCurrentPath() {
        // Pause path playback
    }
    
    func startRecordingPath() {
        isRecording = true
        recordingWaypoints.removeAll()
    }
    
    func addWaypoint(_ cameraState: CameraState) {
        let waypoint = PathWaypoint(
            position: cameraState.position,
            target: cameraState.target,
            duration: 2.0,
            easing: .easeInOut
        )
        recordingWaypoints.append(waypoint)
    }
    
    func stopRecordingPath() {
        isRecording = false
        
        if !recordingWaypoints.isEmpty {
            let path = NavigationPath(
                name: "Recorded Path \(paths.count + 1)",
                waypoints: recordingWaypoints,
                isLooping: false,
                totalDuration: recordingWaypoints.reduce(0) { $0 + $1.duration }
            )
            paths.append(path)
            recordingWaypoints.removeAll()
        }
    }
}

@MainActor
class AnimationController: ObservableObject {
    @Published var isAnimating: Bool = false
    
    private var currentAnimation: Timer?
    
    func startAnimation() {
        isAnimating = true
    }
    
    func stopAnimation() {
        currentAnimation?.invalidate()
        currentAnimation = nil
        isAnimating = false
    }
}

// MARK: - Blur Effect
struct BlurEffect: NSViewRepresentable {
    let style: NSVisualEffectView.BlurringMode
    
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }
    
    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        // Update if needed
    }
}