// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "RevenueOS",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "RevenueOS", targets: ["RevenueOS"]),
    ],
    targets: [
        .executableTarget(
            name: "RevenueOS",
            path: "Sources/RevenueOS"
        ),
    ]
)
