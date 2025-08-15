//
//  ExportManager.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import AppKit
import UniformTypeIdentifiers
import CloudKit
import AVFoundation
import Combine

@MainActor
class ExportManager: ObservableObject {
    static let shared = ExportManager()
    
    // MARK: - Published Properties
    @Published var isExporting: Bool = false
    @Published var exportProgress: Double = 0.0
    @Published var currentExportTask: String = ""
    @Published var exportHistory: [ExportRecord] = []
    @Published var availableFormats: [ExportFormat] = []
    @Published var cloudServices: [CloudService] = []
    @Published var exportTemplates: [ExportTemplate] = []
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private var currentExportJob: ExportJob?
    private var videoRecorder: AVAssetWriter?
    private var exportQueue = DispatchQueue(label: "com.universalaitools.export", qos: .userInitiated)
    
    // MARK: - Initialization
    private init() {
        setupExportFormats()
        setupCloudServices()
        loadExportTemplates()
        loadExportHistory()
    }
    
    // MARK: - Public Interface
    
    /// Export visualization as image
    func exportVisualization(_ view: NSView, 
                           format: ImageFormat = .png,
                           resolution: ExportResolution = .standard,
                           options: ImageExportOptions = ImageExportOptions()) async throws -> URL {
        
        guard !isExporting else {
            throw ExportError.exportInProgress
        }
        
        isExporting = true
        currentExportTask = "Exporting visualization as \(format.rawValue.uppercased())"
        exportProgress = 0.0
        
        defer {
            isExporting = false
            currentExportTask = ""
            exportProgress = 0.0
        }
        
        do {
            let outputURL = try await exportViewAsImage(
                view: view,
                format: format,
                resolution: resolution,
                options: options
            )
            
            try await recordExportSuccess(
                type: .image,
                format: format.rawValue,
                outputURL: outputURL
            )
            
            return outputURL
        } catch {
            try await recordExportFailure(error: error)
            throw error
        }
    }
    
    /// Export data in various formats
    func exportData<T: Codable>(_ data: T, 
                               format: DataFormat,
                               fileName: String? = nil,
                               options: DataExportOptions = DataExportOptions()) async throws -> URL {
        
        guard !isExporting else {
            throw ExportError.exportInProgress
        }
        
        isExporting = true
        currentExportTask = "Exporting data as \(format.rawValue.uppercased())"
        exportProgress = 0.0
        
        defer {
            isExporting = false
            currentExportTask = ""
            exportProgress = 0.0
        }
        
        do {
            let outputURL = try await exportDataToFormat(
                data: data,
                format: format,
                fileName: fileName,
                options: options
            )
            
            try await recordExportSuccess(
                type: .data,
                format: format.rawValue,
                outputURL: outputURL
            )
            
            return outputURL
        } catch {
            try await recordExportFailure(error: error)
            throw error
        }
    }
    
    /// Export interactive report
    func exportInteractiveReport(data: [String: Any],
                                visualizations: [NSView],
                                template: ExportTemplate,
                                options: ReportExportOptions = ReportExportOptions()) async throws -> URL {
        
        guard !isExporting else {
            throw ExportError.exportInProgress
        }
        
        isExporting = true
        currentExportTask = "Generating interactive report"
        exportProgress = 0.0
        
        defer {
            isExporting = false
            currentExportTask = ""
            exportProgress = 0.0
        }
        
        do {
            let outputURL = try await generateInteractiveReport(
                data: data,
                visualizations: visualizations,
                template: template,
                options: options
            )
            
            try await recordExportSuccess(
                type: .report,
                format: "html",
                outputURL: outputURL
            )
            
            return outputURL
        } catch {
            try await recordExportFailure(error: error)
            throw error
        }
    }
    
    /// Start video recording of interface
    func startVideoRecording(view: NSView, 
                            quality: VideoQuality = .high,
                            frameRate: Int = 30) async throws {
        
        guard videoRecorder == nil else {
            throw ExportError.recordingInProgress
        }
        
        currentExportTask = "Recording video"
        
        let outputURL = createTempURL(extension: "mov")
        
        try await setupVideoRecording(
            view: view,
            outputURL: outputURL,
            quality: quality,
            frameRate: frameRate
        )
    }
    
    /// Stop video recording and export
    func stopVideoRecording() async throws -> URL {
        guard let recorder = videoRecorder else {
            throw ExportError.noActiveRecording
        }
        
        currentExportTask = "Finalizing video"
        
        let outputURL = try await finalizeVideoRecording(recorder)
        videoRecorder = nil
        
        try await recordExportSuccess(
            type: .video,
            format: "mov",
            outputURL: outputURL
        )
        
        return outputURL
    }
    
    /// Batch export multiple items
    func batchExport(_ items: [ExportItem], 
                    template: ExportTemplate? = nil) async throws -> [URL] {
        
        guard !isExporting else {
            throw ExportError.exportInProgress
        }
        
        isExporting = true
        currentExportTask = "Batch exporting \(items.count) items"
        
        defer {
            isExporting = false
            currentExportTask = ""
            exportProgress = 0.0
        }
        
        var results: [URL] = []
        
        for (index, item) in items.enumerated() {
            exportProgress = Double(index) / Double(items.count)
            currentExportTask = "Exporting item \(index + 1) of \(items.count)"
            
            do {
                let url = try await exportItem(item, template: template)
                results.append(url)
            } catch {
                // Log error but continue with remaining items
                print("Failed to export item \(index): \(error)")
            }
        }
        
        exportProgress = 1.0
        return results
    }
    
    /// Upload to cloud service
    func uploadToCloud(_ fileURL: URL, 
                      service: CloudService,
                      options: CloudUploadOptions = CloudUploadOptions()) async throws -> String {
        
        currentExportTask = "Uploading to \(service.name)"
        
        switch service.type {
        case .iCloud:
            return try await uploadToiCloud(fileURL, options: options)
        case .dropbox:
            return try await uploadToDropbox(fileURL, options: options)
        case .googleDrive:
            return try await uploadToGoogleDrive(fileURL, options: options)
        }
    }
    
    /// Schedule automatic export
    func scheduleAutomaticExport(_ schedule: ExportSchedule) {
        // Implementation for scheduled exports
        let timer = Timer.scheduledTimer(withTimeInterval: schedule.interval, repeats: true) { _ in
            Task {
                try await self.executeScheduledExport(schedule)
            }
        }
        
        // Store timer for later cancellation
        schedule.timer = timer
    }
    
    /// Get export templates
    func getAvailableTemplates() -> [ExportTemplate] {
        return exportTemplates
    }
    
    /// Create custom export template
    func createTemplate(name: String, 
                       configuration: ExportConfiguration) -> ExportTemplate {
        let template = ExportTemplate(
            id: UUID().uuidString,
            name: name,
            configuration: configuration,
            createdAt: Date()
        )
        
        exportTemplates.append(template)
        saveExportTemplates()
        
        return template
    }
    
    // MARK: - Private Implementation
    
    private func setupExportFormats() {
        availableFormats = [
            ExportFormat(type: .image, formats: [.png, .jpeg, .pdf, .svg]),
            ExportFormat(type: .data, formats: [.json, .csv, .excel, .xml]),
            ExportFormat(type: .video, formats: [.mov, .mp4, .gif]),
            ExportFormat(type: .document, formats: [.html, .pdf, .docx])
        ]
    }
    
    private func setupCloudServices() {
        cloudServices = [
            CloudService(name: "iCloud", type: .iCloud, isEnabled: true),
            CloudService(name: "Dropbox", type: .dropbox, isEnabled: false),
            CloudService(name: "Google Drive", type: .googleDrive, isEnabled: false)
        ]
    }
    
    private func loadExportTemplates() {
        // Load saved templates from UserDefaults or file system
        exportTemplates = [
            ExportTemplate.standardReport,
            ExportTemplate.dataAnalysis,
            ExportTemplate.presentation,
            ExportTemplate.technical
        ]
    }
    
    private func loadExportHistory() {
        // Load export history from persistent storage
        if let data = UserDefaults.standard.data(forKey: "ExportHistory"),
           let history = try? JSONDecoder().decode([ExportRecord].self, from: data) {
            exportHistory = history
        }
    }
    
    private func saveExportHistory() {
        if let data = try? JSONEncoder().encode(exportHistory) {
            UserDefaults.standard.set(data, forKey: "ExportHistory")
        }
    }
    
    private func saveExportTemplates() {
        if let data = try? JSONEncoder().encode(exportTemplates) {
            UserDefaults.standard.set(data, forKey: "ExportTemplates")
        }
    }
    
    private func exportViewAsImage(view: NSView,
                                  format: ImageFormat,
                                  resolution: ExportResolution,
                                  options: ImageExportOptions) async throws -> URL {
        
        return try await withCheckedThrowingContinuation { continuation in
            exportQueue.async {
                do {
                    // Calculate export dimensions
                    let scaleFactor = resolution.scaleFactor
                    let size = NSSize(
                        width: view.bounds.width * scaleFactor,
                        height: view.bounds.height * scaleFactor
                    )
                    
                    // Create bitmap representation
                    guard let bitmapRep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
                        continuation.resume(throwing: ExportError.bitmapCreationFailed)
                        return
                    }
                    
                    bitmapRep.size = size
                    view.cacheDisplay(in: view.bounds, to: bitmapRep)
                    
                    // Create output URL
                    let outputURL = self.createTempURL(extension: format.fileExtension)
                    
                    // Export based on format
                    switch format {
                    case .png:
                        try self.exportAsPNG(bitmapRep, to: outputURL, options: options)
                    case .jpeg:
                        try self.exportAsJPEG(bitmapRep, to: outputURL, options: options)
                    case .pdf:
                        try self.exportAsPDF(view, to: outputURL, options: options)
                    case .svg:
                        try self.exportAsSVG(view, to: outputURL, options: options)
                    }
                    
                    continuation.resume(returning: outputURL)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    private func exportDataToFormat<T: Codable>(data: T,
                                              format: DataFormat,
                                              fileName: String?,
                                              options: DataExportOptions) async throws -> URL {
        
        return try await withCheckedThrowingContinuation { continuation in
            exportQueue.async {
                do {
                    let outputURL = self.createTempURL(
                        extension: format.fileExtension,
                        fileName: fileName
                    )
                    
                    switch format {
                    case .json:
                        try self.exportAsJSON(data, to: outputURL, options: options)
                    case .csv:
                        try self.exportAsCSV(data, to: outputURL, options: options)
                    case .excel:
                        try self.exportAsExcel(data, to: outputURL, options: options)
                    case .xml:
                        try self.exportAsXML(data, to: outputURL, options: options)
                    case .graphML:
                        try self.exportAsGraphML(data, to: outputURL, options: options)
                    }
                    
                    continuation.resume(returning: outputURL)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }
    
    private func generateInteractiveReport(data: [String: Any],
                                         visualizations: [NSView],
                                         template: ExportTemplate,
                                         options: ReportExportOptions) async throws -> URL {
        
        let outputURL = createTempURL(extension: "html")
        
        // Generate HTML report with embedded visualizations
        var htmlContent = template.configuration.htmlTemplate
        
        // Replace placeholders with actual data
        for (key, value) in data {
            htmlContent = htmlContent.replacingOccurrences(of: "{{\\(key)}}", with: String(describing: value))
        }
        
        // Embed visualizations as base64 images
        for (index, visualization) in visualizations.enumerated() {
            let imageData = try await exportViewAsImageData(visualization, format: .png)
            let base64Image = imageData.base64EncodedString()
            htmlContent = htmlContent.replacingOccurrences(
                of: "{{visualization_\(index)}}",
                with: "data:image/png;base64,\(base64Image)"
            )
        }
        
        // Add interactive features
        htmlContent += generateInteractiveJavaScript()
        
        try htmlContent.write(to: outputURL, atomically: true, encoding: .utf8)
        return outputURL
    }
    
    private func setupVideoRecording(view: NSView,
                                   outputURL: URL,
                                   quality: VideoQuality,
                                   frameRate: Int) async throws {
        
        let writer = try AVAssetWriter(outputURL: outputURL, fileType: .mov)
        
        let videoSettings: [String: Any] = [
            AVVideoCodecKey: AVVideoCodecType.h264,
            AVVideoWidthKey: Int(view.bounds.width),
            AVVideoHeightKey: Int(view.bounds.height),
            AVVideoCompressionPropertiesKey: [
                AVVideoAverageBitRateKey: quality.bitRate
            ]
        ]
        
        let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: videoSettings)
        videoInput.expectsMediaDataInRealTime = true
        
        guard writer.canAdd(videoInput) else {
            throw ExportError.videoSetupFailed
        }
        
        writer.add(videoInput)
        
        guard writer.startWriting() else {
            throw ExportError.videoSetupFailed
        }
        
        writer.startSession(atSourceTime: .zero)
        videoRecorder = writer
    }
    
    private func finalizeVideoRecording(_ writer: AVAssetWriter) async throws -> URL {
        return try await withCheckedThrowingContinuation { continuation in
            writer.finishWriting {
                if writer.status == .completed {
                    continuation.resume(returning: writer.outputURL)
                } else {
                    continuation.resume(throwing: ExportError.videoFinalizationFailed)
                }
            }
        }
    }
    
    private func exportItem(_ item: ExportItem, template: ExportTemplate?) async throws -> URL {
        switch item.type {
        case .visualization(let view):
            return try await exportVisualization(view, format: item.imageFormat ?? .png)
        case .data(let data):
            return try await exportData(data, format: item.dataFormat ?? .json)
        case .report(let data, let views):
            return try await exportInteractiveReport(
                data: data,
                visualizations: views,
                template: template ?? .standardReport
            )
        }
    }
    
    private func uploadToiCloud(_ fileURL: URL, options: CloudUploadOptions) async throws -> String {
        // iCloud upload implementation
        let cloudURL = FileManager.default.url(forUbiquityContainerIdentifier: nil)?
            .appendingPathComponent("Documents")
            .appendingPathComponent(fileURL.lastPathComponent)
        
        guard let destinationURL = cloudURL else {
            throw ExportError.iCloudNotAvailable
        }
        
        try FileManager.default.copyItem(at: fileURL, to: destinationURL)
        return destinationURL.absoluteString
    }
    
    private func uploadToDropbox(_ fileURL: URL, options: CloudUploadOptions) async throws -> String {
        // Dropbox API implementation would go here
        throw ExportError.serviceNotImplemented
    }
    
    private func uploadToGoogleDrive(_ fileURL: URL, options: CloudUploadOptions) async throws -> String {
        // Google Drive API implementation would go here
        throw ExportError.serviceNotImplemented
    }
    
    private func executeScheduledExport(_ schedule: ExportSchedule) async throws {
        // Execute scheduled export based on configuration
        let items = schedule.itemsToExport
        let _ = try await batchExport(items, template: schedule.template)
    }
    
    private func recordExportSuccess(type: ExportType, format: String, outputURL: URL) async throws {
        let record = ExportRecord(
            id: UUID().uuidString,
            type: type,
            format: format,
            outputURL: outputURL,
            timestamp: Date(),
            success: true,
            error: nil
        )
        
        exportHistory.insert(record, at: 0)
        
        // Keep only last 100 records
        if exportHistory.count > 100 {
            exportHistory.removeLast(exportHistory.count - 100)
        }
        
        saveExportHistory()
    }
    
    private func recordExportFailure(error: Error) async throws {
        let record = ExportRecord(
            id: UUID().uuidString,
            type: .data, // Default type for failed exports
            format: "unknown",
            outputURL: URL(fileURLWithPath: ""),
            timestamp: Date(),
            success: false,
            error: error.localizedDescription
        )
        
        exportHistory.insert(record, at: 0)
        saveExportHistory()
    }
    
    private func createTempURL(extension: String, fileName: String? = nil) -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let name = fileName ?? UUID().uuidString
        return tempDir.appendingPathComponent("\(name).\(`extension`)")
    }
    
    // MARK: - Format-Specific Export Methods
    
    private func exportAsPNG(_ bitmapRep: NSBitmapImageRep, to url: URL, options: ImageExportOptions) throws {
        let data = bitmapRep.representation(using: .png, properties: [:])
        try data?.write(to: url)
    }
    
    private func exportAsJPEG(_ bitmapRep: NSBitmapImageRep, to url: URL, options: ImageExportOptions) throws {
        let properties: [NSBitmapImageRep.PropertyKey: Any] = [
            .compressionFactor: options.jpegQuality
        ]
        let data = bitmapRep.representation(using: .jpeg, properties: properties)
        try data?.write(to: url)
    }
    
    private func exportAsPDF(_ view: NSView, to url: URL, options: ImageExportOptions) throws {
        let pdfData = view.dataWithPDF(inside: view.bounds)
        try pdfData.write(to: url)
    }
    
    private func exportAsSVG(_ view: NSView, to url: URL, options: ImageExportOptions) throws {
        // SVG export implementation would require converting NSView to SVG
        throw ExportError.formatNotSupported
    }
    
    private func exportAsJSON<T: Codable>(_ data: T, to url: URL, options: DataExportOptions) throws {
        let encoder = JSONEncoder()
        if options.prettyPrinted {
            encoder.outputFormatting = .prettyPrinted
        }
        let jsonData = try encoder.encode(data)
        try jsonData.write(to: url)
    }
    
    private func exportAsCSV<T: Codable>(_ data: T, to url: URL, options: DataExportOptions) throws {
        // CSV export implementation
        throw ExportError.formatNotSupported
    }
    
    private func exportAsExcel<T: Codable>(_ data: T, to url: URL, options: DataExportOptions) throws {
        // Excel export implementation would require external library
        throw ExportError.formatNotSupported
    }
    
    private func exportAsXML<T: Codable>(_ data: T, to url: URL, options: DataExportOptions) throws {
        // XML export implementation
        throw ExportError.formatNotSupported
    }
    
    private func exportAsGraphML<T: Codable>(_ data: T, to url: URL, options: DataExportOptions) throws {
        // GraphML export for graph data
        throw ExportError.formatNotSupported
    }
    
    private func exportViewAsImageData(_ view: NSView, format: ImageFormat) async throws -> Data {
        guard let bitmapRep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
            throw ExportError.bitmapCreationFailed
        }
        
        view.cacheDisplay(in: view.bounds, to: bitmapRep)
        
        guard let data = bitmapRep.representation(using: .png, properties: [:]) else {
            throw ExportError.dataConversionFailed
        }
        
        return data
    }
    
    private func generateInteractiveJavaScript() -> String {
        return """
        <script>
        // Interactive features for exported reports
        function toggleVisualization(id) {
            const element = document.getElementById(id);
            element.style.display = element.style.display === 'none' ? 'block' : 'none';
        }
        
        function exportData(format) {
            // Client-side export functionality
            console.log('Exporting data as', format);
        }
        
        // Add zoom and pan functionality to visualizations
        document.addEventListener('DOMContentLoaded', function() {
            const visualizations = document.querySelectorAll('.visualization');
            visualizations.forEach(addInteractivity);
        });
        
        function addInteractivity(element) {
            let scale = 1;
            let panX = 0;
            let panY = 0;
            
            element.addEventListener('wheel', function(e) {
                e.preventDefault();
                scale += e.deltaY * -0.01;
                scale = Math.min(Math.max(0.1, scale), 4.0);
                updateTransform();
            });
            
            function updateTransform() {
                element.style.transform = `scale(${scale}) translate(${panX}px, ${panY}px)`;
            }
        }
        </script>
        """
    }
}

// MARK: - Supporting Types

enum ExportError: LocalizedError {
    case exportInProgress
    case recordingInProgress
    case noActiveRecording
    case bitmapCreationFailed
    case dataConversionFailed
    case videoSetupFailed
    case videoFinalizationFailed
    case formatNotSupported
    case serviceNotImplemented
    case iCloudNotAvailable
    
    var errorDescription: String? {
        switch self {
        case .exportInProgress:
            return "An export operation is already in progress"
        case .recordingInProgress:
            return "Video recording is already in progress"
        case .noActiveRecording:
            return "No active video recording to stop"
        case .bitmapCreationFailed:
            return "Failed to create bitmap representation"
        case .dataConversionFailed:
            return "Failed to convert data to target format"
        case .videoSetupFailed:
            return "Failed to setup video recording"
        case .videoFinalizationFailed:
            return "Failed to finalize video recording"
        case .formatNotSupported:
            return "Export format not yet supported"
        case .serviceNotImplemented:
            return "Cloud service not yet implemented"
        case .iCloudNotAvailable:
            return "iCloud is not available on this device"
        }
    }
}

enum ImageFormat: String, CaseIterable, Codable {
    case png
    case jpeg
    case pdf
    case svg
    
    var fileExtension: String {
        return rawValue
    }
}

enum DataFormat: String, CaseIterable, Codable {
    case json
    case csv
    case excel = "xlsx"
    case xml
    case graphML = "graphml"
    
    var fileExtension: String {
        return rawValue
    }
}

enum VideoQuality: String, CaseIterable {
    case low
    case medium
    case high
    case ultra
    
    var bitRate: Int {
        switch self {
        case .low: return 1_000_000
        case .medium: return 5_000_000
        case .high: return 10_000_000
        case .ultra: return 20_000_000
        }
    }
}

enum ExportResolution {
    case standard
    case retina
    case ultra
    case custom(CGFloat)
    
    var scaleFactor: CGFloat {
        switch self {
        case .standard: return 1.0
        case .retina: return 2.0
        case .ultra: return 3.0
        case .custom(let factor): return factor
        }
    }
}

enum ExportType: String, Codable {
    case image
    case data
    case video
    case report
    case document
}

enum CloudServiceType {
    case iCloud
    case dropbox
    case googleDrive
}

struct ExportFormat {
    let type: ExportType
    let formats: [Any]
}

struct CloudService {
    let name: String
    let type: CloudServiceType
    var isEnabled: Bool
}

struct ExportTemplate: Codable, Identifiable {
    let id: String
    let name: String
    let configuration: ExportConfiguration
    let createdAt: Date
    
    static let standardReport = ExportTemplate(
        id: "standard-report",
        name: "Standard Report",
        configuration: ExportConfiguration.standardReport,
        createdAt: Date()
    )
    
    static let dataAnalysis = ExportTemplate(
        id: "data-analysis",
        name: "Data Analysis",
        configuration: ExportConfiguration.dataAnalysis,
        createdAt: Date()
    )
    
    static let presentation = ExportTemplate(
        id: "presentation",
        name: "Presentation",
        configuration: ExportConfiguration.presentation,
        createdAt: Date()
    )
    
    static let technical = ExportTemplate(
        id: "technical",
        name: "Technical Documentation",
        configuration: ExportConfiguration.technical,
        createdAt: Date()
    )
}

struct ExportConfiguration: Codable {
    let htmlTemplate: String
    let includeInteractivity: Bool
    let includeData: Bool
    let includeMetadata: Bool
    let customCSS: String?
    let customJS: String?
    
    static let standardReport = ExportConfiguration(
        htmlTemplate: """
        <!DOCTYPE html>
        <html>
        <head>
            <title>Universal AI Tools Report</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                .header { background: #007AFF; color: white; padding: 20px; }
                .content { padding: 20px; }
                .visualization { margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Data Analysis Report</h1>
                <p>Generated on {{date}}</p>
            </div>
            <div class="content">
                {{content}}
            </div>
        </body>
        </html>
        """,
        includeInteractivity: true,
        includeData: true,
        includeMetadata: true,
        customCSS: nil,
        customJS: nil
    )
    
    static let dataAnalysis = ExportConfiguration(
        htmlTemplate: "<!-- Data Analysis Template -->",
        includeInteractivity: false,
        includeData: true,
        includeMetadata: false,
        customCSS: nil,
        customJS: nil
    )
    
    static let presentation = ExportConfiguration(
        htmlTemplate: "<!-- Presentation Template -->",
        includeInteractivity: true,
        includeData: false,
        includeMetadata: false,
        customCSS: nil,
        customJS: nil
    )
    
    static let technical = ExportConfiguration(
        htmlTemplate: "<!-- Technical Documentation Template -->",
        includeInteractivity: false,
        includeData: true,
        includeMetadata: true,
        customCSS: nil,
        customJS: nil
    )
}

struct ExportRecord: Codable, Identifiable {
    let id: String
    let type: ExportType
    let format: String
    let outputURL: URL
    let timestamp: Date
    let success: Bool
    let error: String?
}

struct ImageExportOptions {
    var jpegQuality: Float = 0.9
    var includeTransparency: Bool = true
    var backgroundColor: NSColor = .clear
    var watermark: NSImage? = nil
    var watermarkPosition: WatermarkPosition = .bottomRight
    var dpi: Int = 300
}

struct DataExportOptions {
    var prettyPrinted: Bool = true
    var includeMetadata: Bool = false
    var dateFormat: String = "yyyy-MM-dd'T'HH:mm:ss.SSSZ"
    var numberFormat: NumberFormatter? = nil
}

struct ReportExportOptions {
    var includeRawData: Bool = false
    var embedVisualizations: Bool = true
    var interactiveFeatures: Bool = true
    var customTheme: String? = nil
}

struct CloudUploadOptions {
    var folderPath: String = "Universal AI Tools Exports"
    var makePublic: Bool = false
    var includeMetadata: Bool = true
    var compressionEnabled: Bool = false
}

enum WatermarkPosition {
    case topLeft, topRight, bottomLeft, bottomRight, center
}

enum ExportItemType {
    case visualization(NSView)
    case data(Codable)
    case report([String: Any], [NSView])
}

struct ExportItem {
    let type: ExportItemType
    let imageFormat: ImageFormat?
    let dataFormat: DataFormat?
}

struct ExportJob {
    let id: String
    let items: [ExportItem]
    let template: ExportTemplate?
    let startTime: Date
}

struct ExportSchedule {
    let id: String
    let interval: TimeInterval
    let itemsToExport: [ExportItem]
    let template: ExportTemplate?
    var timer: Timer?
}