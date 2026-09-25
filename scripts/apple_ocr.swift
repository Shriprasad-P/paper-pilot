import AppKit
import Foundation
import PDFKit
import Vision

struct Block: Codable {
    let text: String
    let bbox: [Double]
}

struct PageOut: Codable {
    let page: Int
    let text: String
    let blocks: [Block]
}

struct Result: Codable {
    let ok: Bool
    let engine: String
    let pages: [PageOut]
}

func fail(_ message: String) -> Never {
    let data = Data("{\"ok\":false,\"error\":\(jsonString(message)),\"code\":\"ocr_failed\"}\n".utf8)
    FileHandle.standardOutput.write(data)
    exit(2)
}

func jsonString(_ value: String) -> String {
    let data = try! JSONSerialization.data(withJSONObject: [value])
    let text = String(data: data, encoding: .utf8)!
    return String(text.dropFirst().dropLast())
}

let args = CommandLine.arguments
if args.count < 2 {
    fail("Missing PDF path.")
}

let url = URL(fileURLWithPath: args[1])
guard let document = PDFDocument(url: url) else {
    fail("Couldn’t open that PDF.")
}

var pages: [PageOut] = []
for index in 0..<document.pageCount {
    guard let page = document.page(at: index) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2
    let size = NSSize(width: max(bounds.width * scale, 1), height: max(bounds.height * scale, 1))
    let image = NSImage(size: size)
    image.lockFocus()
    NSColor.white.setFill()
    NSRect(origin: .zero, size: size).fill()
    if let ctx = NSGraphicsContext.current?.cgContext {
        ctx.saveGState()
        ctx.scaleBy(x: scale, y: scale)
        page.draw(with: .mediaBox, to: ctx)
        ctx.restoreGState()
    }
    image.unlockFocus()
    guard let tiff = image.tiffRepresentation,
          let rep = NSBitmapImageRep(data: tiff),
          let cgImage = rep.cgImage else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        continue
    }
    var blocks: [Block] = []
    var lines: [String] = []
    for observation in request.results ?? [] {
        guard let candidate = observation.topCandidates(1).first else { continue }
        let text = candidate.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty { continue }
        let box = observation.boundingBox
        blocks.append(Block(text: text, bbox: [
            Double(box.origin.x), Double(box.origin.y), Double(box.size.width), Double(box.size.height),
        ]))
        lines.append(text)
    }
    pages.append(PageOut(page: index + 1, text: lines.joined(separator: "\n"), blocks: blocks))
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
let payload = Result(ok: true, engine: "apple_vision", pages: pages)
guard let data = try? encoder.encode(payload) else {
    fail("Couldn’t encode OCR JSON.")
}
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
