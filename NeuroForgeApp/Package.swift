// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "NeuroForgeApp",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "NeuroForgeApp",
            targets: ["NeuroForgeApp"]
        )
    ],
    targets: [
        .executableTarget(
            name: "NeuroForgeApp",
            dependencies: []
        ),
        .testTarget(
            name: "NeuroForgeAppTests",
            dependencies: ["NeuroForgeApp"]
        ),
        .testTarget(
            name: "AppUITests",
            dependencies: [],
            path: "Tests/AppUITests"
        )
    ]
)
