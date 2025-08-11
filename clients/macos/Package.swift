// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "UniversalAIToolsMac",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .executable(name: "UniversalAIToolsMac", targets: ["UniversalAIToolsMac"])
    ],
    dependencies: [
        .package(path: "../ios")
    ],
    targets: [
        .executableTarget(
            name: "UniversalAIToolsMac",
            dependencies: [
                .product(name: "UniversalAIToolsClient", package: "ios")
            ],
            path: "UniversalAIToolsMac"
        )
    ]
)


