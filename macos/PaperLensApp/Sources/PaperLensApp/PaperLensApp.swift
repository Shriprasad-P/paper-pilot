import AppKit
import Combine
import Darwin
import SwiftUI
import WebKit

@main
struct PaperLensApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var model = AppModel.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if let url = model.url {
                    LocalWebView(url: url)
                } else if model.isStarting {
                    ProgressView("Starting Paper Lens and local models…")
                        .frame(minWidth: 760, minHeight: 520)
                } else {
                    VStack(spacing: 14) {
                        Text("Paper Lens couldn’t start").font(.title2)
                        Text(model.error ?? "The local app server is unavailable.")
                            .multilineTextAlignment(.center)
                            .foregroundStyle(.secondary)
                        Button("Try again") { Task { await model.start() } }
                    }
                    .padding(36)
                    .frame(minWidth: 600, minHeight: 360)
                }
            }
            .frame(minWidth: 760, minHeight: 520)
        }
        .windowResizability(.contentSize)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
        Task { await AppModel.shared.start() }
    }

    func applicationWillTerminate(_ notification: Notification) {
        AppModel.shared.stop()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

@MainActor
final class AppModel: ObservableObject {
    static let shared = AppModel()

    @Published var url: URL?
    @Published var error: String?
    @Published var isStarting = false
    private var ollama: Process?
    private var next: Process?

    func start() async {
        guard !isStarting else { return }
        isStarting = true
        error = nil
        stop()
        do {
            let resources = Bundle.main.resourceURL!
            let webRoot = try prepareWritableWebRoot(resources: resources)
            let ollamaPort = try availablePort()
            let ollamaURL = URL(string: "http://127.0.0.1:\(ollamaPort)")!
            let ollamaExe = resources.appendingPathComponent("Ollama/ollama")
            let ollamaModels = resources.appendingPathComponent("OllamaModels")
            try launchOllama(ollamaExe, models: ollamaModels, url: ollamaURL)
            try await waitFor(URL(string: "\(ollamaURL.absoluteString)/api/version")!, process: ollama, service: "Ollama")

            let port: UInt16 = 43123
            let serverURL = URL(string: "http://127.0.0.1:\(port)")!
            try launchNext(resources: resources, webRoot: webRoot, url: serverURL, ollamaURL: ollamaURL)
            try await waitFor(URL(string: "\(serverURL.absoluteString)/api/config")!, process: next, service: "Paper Lens server")
            url = serverURL
        } catch {
            stop()
            self.error = error.localizedDescription
        }
        isStarting = false
    }

    func stop() {
        next?.terminate()
        ollama?.terminate()
        next = nil
        ollama = nil
        url = nil
    }

    private func prepareWritableWebRoot(resources: URL) throws -> URL {
        let source = resources.appendingPathComponent("PaperLensServer", isDirectory: true)
        let support = try FileManager.default.url(
            for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true
        ).appendingPathComponent("Paper Lens", isDirectory: true)
        let target = support.appendingPathComponent("PaperLensServer", isDirectory: true)
        let sourceBuild = try String(contentsOf: source.appendingPathComponent(".next/BUILD_ID"), encoding: .utf8)
        let targetBuild = try? String(contentsOf: target.appendingPathComponent(".next/BUILD_ID"), encoding: .utf8)
        if sourceBuild != targetBuild {
            try? FileManager.default.removeItem(at: target)
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            try FileManager.default.copyItem(at: source, to: target)
        }
        return target
    }

    private func launchOllama(_ executable: URL, models: URL, url: URL) throws {
        guard FileManager.default.isExecutableFile(atPath: executable.path) else {
            throw AppError.missing("Bundled Ollama runtime is missing.")
        }
        let process = Process()
        process.executableURL = executable
        process.arguments = ["serve"]
        process.environment = ProcessInfo.processInfo.environment.merging([
            "OLLAMA_HOST": "\(url.host!):\(url.port!)",
            "OLLAMA_MODELS": models.path,
            "OLLAMA_NO_CLOUD": "1",
        ]) { _, new in new }
        process.standardOutput = FileHandle.standardOutput
        process.standardError = FileHandle.standardError
        try process.run()
        ollama = process
    }

    private func launchNext(resources: URL, webRoot: URL, url: URL, ollamaURL: URL) throws {
        let node = resources.appendingPathComponent("node")
        let python = resources.appendingPathComponent("Python/bin/python3.13")
        let pythonHome = resources.appendingPathComponent("Python")
        let pythonPackages = resources.appendingPathComponent("PythonPackages")
        let fluxCache = resources.appendingPathComponent("HuggingFace/hub")
        let process = Process()
        process.executableURL = node
        process.arguments = ["server.js"]
        process.currentDirectoryURL = webRoot
        process.environment = ProcessInfo.processInfo.environment.merging([
            "HOSTNAME": "127.0.0.1",
            "PORT": String(url.port!),
            "PAPER_LENS_MOCK": "0",
            "PAPER_LENS_PYTHON": python.path,
            "PAPER_LENS_OCR_BINARY": resources.appendingPathComponent("apple_ocr").path,
            "PAPER_LENS_OLLAMA_URL": ollamaURL.absoluteString,
            "PYTHONHOME": pythonHome.path,
            "PYTHONPATH": pythonPackages.path,
            "HF_HOME": resources.appendingPathComponent("HuggingFace").path,
            "HF_HUB_CACHE": fluxCache.path,
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
        ]) { _, new in new }
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        next = process
    }

    private func waitFor(_ url: URL, process: Process?, service: String) async throws {
        for _ in 0..<60 {
            if Task.isCancelled { throw CancellationError() }
            if process?.isRunning != true {
                throw AppError.unavailable("\(service) exited during startup (code \(process?.terminationStatus ?? -1)). Check for a port conflict and try again.")
            }
            if let (_, response) = try? await URLSession.shared.data(from: url),
               (response as? HTTPURLResponse)?.statusCode == 200 { return }
            try await Task.sleep(for: .milliseconds(500))
        }
        throw AppError.unavailable("The bundled local service did not become ready.")
    }

    private func availablePort() throws -> UInt16 {
        let descriptor = Darwin.socket(AF_INET, SOCK_STREAM, 0)
        guard descriptor >= 0 else { throw AppError.unavailable("Could not create a local socket.") }
        defer { Darwin.close(descriptor) }
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = 0
        address.sin_addr = in_addr(s_addr: in_addr_t(0x7f000001).bigEndian)
        let bound = withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }
        guard bound == 0 else { throw AppError.unavailable("Could not reserve a local port.") }
        var actual = sockaddr_in()
        var length = socklen_t(MemoryLayout<sockaddr_in>.size)
        let read = withUnsafeMutablePointer(to: &actual) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.getsockname(descriptor, $0, &length)
            }
        }
        guard read == 0 else { throw AppError.unavailable("Could not read the local port.") }
        return UInt16(bigEndian: actual.sin_port)
    }

}

private enum AppError: LocalizedError {
    case missing(String)
    case unavailable(String)
    var errorDescription: String? {
        switch self { case .missing(let message), .unavailable(let message): message }
    }
}

private struct LocalWebView: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let view = WKWebView(frame: .zero)
        view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: url))
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(origin: url.origin) }

    @MainActor final class Coordinator: NSObject, WKNavigationDelegate {
        let origin: String
        init(origin: String) { self.origin = origin }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
            if url.origin == origin { decisionHandler(.allow) }
            else { NSWorkspace.shared.open(url); decisionHandler(.cancel) }
        }
    }
}

private extension URL {
    var origin: String { "\(scheme ?? "http")://\(host ?? ""):\(port ?? 80)" }
}
