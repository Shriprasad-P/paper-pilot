// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PaperLensApp",
    platforms: [.macOS(.v14)],
    products: [.executable(name: "PaperLensApp", targets: ["PaperLensApp"])],
    targets: [.executableTarget(name: "PaperLensApp")]
)
