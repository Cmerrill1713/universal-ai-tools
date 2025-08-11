// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "UniversalAIToolsClient",
    platforms: [
        .iOS(.v15), .macOS(.v12)
    ],
    products: [
        .library(
            name: "UniversalAIToolsClient",
            targets: ["UniversalAIToolsClient"]
        )
    ],
    targets: [
        .target(
            name: "UniversalAIToolsClient",
            path: "Sources/UniversalAIToolsClient"
        ),
        .testTarget(
            name: "UniversalAIToolsClientTests",
            dependencies: ["UniversalAIToolsClient"],
            path: "Tests/UniversalAIToolsClientTests"
        )
    ]
)


