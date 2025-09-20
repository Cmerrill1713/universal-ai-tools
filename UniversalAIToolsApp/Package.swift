// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "UniversalAITools",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "UniversalAITools",
            targets: ["UniversalAITools"]
        ),
    ],
    dependencies: [
        // Add any external dependencies here if needed
    ],
    targets: [
        .executableTarget(
            name: "UniversalAITools",
            dependencies: [],
            path: "Sources"
        ),
    ]
)
