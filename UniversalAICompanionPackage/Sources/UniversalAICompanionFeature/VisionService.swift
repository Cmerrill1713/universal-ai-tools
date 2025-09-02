import AVFoundation
import Vision
import CoreImage
import UIKit
import SwiftUI
import Combine

/// Comprehensive vision service for camera capture and image analysis
@Observable
@MainActor
final class VisionService: NSObject {
    // MARK: - Properties
    
    /// Current capture session
    private var captureSession: AVCaptureSession?
    
    /// Photo output for capturing still images
    private var photoOutput: AVCapturePhotoOutput?
    
    /// Video data output for real-time processing
    private var videoOutput: AVCaptureVideoDataOutput?
    
    /// Preview layer for camera display
    var previewLayer: AVCaptureVideoPreviewLayer?
    
    /// Current camera position
    var currentCameraPosition: AVCaptureDevice.Position = .back
    
    /// Capture state
    var isCapturing = false
    var isProcessing = false
    
    /// Last captured image
    var capturedImage: UIImage?
    
    /// Analysis results
    var analysisResults: VisionAnalysisResult?
    
    /// Error state
    var currentError: VisionError?
    
    // MARK: - Vision Processing
    
    private let visionQueue = DispatchQueue(label: "com.universal.vision", qos: .userInitiated)
    private var visionRequests: [VNRequest] = []
    
    // MARK: - Initialization
    
    override init() {
        super.init()
        setupVisionRequests()
    }
    
    // MARK: - Camera Setup
    
    /// Initialize camera capture session
    func setupCamera() async throws {
        // Check camera authorization
        let authorized = await checkCameraAuthorization()
        guard authorized else {
            throw VisionError.cameraNotAuthorized
        }
        
        // Create capture session
        let session = AVCaptureSession()
        session.sessionPreset = .photo
        
        // Add camera input
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera, 
                                                   for: .video, 
                                                   position: currentCameraPosition) else {
            throw VisionError.cameraNotAvailable
        }
        
        let input = try AVCaptureDeviceInput(device: camera)
        guard session.canAddInput(input) else {
            throw VisionError.cameraSetupFailed
        }
        session.addInput(input)
        
        // Add photo output
        let photoOutput = AVCapturePhotoOutput()
        guard session.canAddOutput(photoOutput) else {
            throw VisionError.cameraSetupFailed
        }
        session.addOutput(photoOutput)
        self.photoOutput = photoOutput
        
        // Add video output for real-time processing
        let videoOutput = AVCaptureVideoDataOutput()
        videoOutput.setSampleBufferDelegate(self, queue: visionQueue)
        guard session.canAddOutput(videoOutput) else {
            throw VisionError.cameraSetupFailed
        }
        session.addOutput(videoOutput)
        self.videoOutput = videoOutput
        
        // Create preview layer
        let previewLayer = AVCaptureVideoPreviewLayer(session: session)
        previewLayer.videoGravity = .resizeAspectFill
        self.previewLayer = previewLayer
        
        self.captureSession = session
        
        // Start session on background queue
        Task.detached {
            session.startRunning()
        }
        
        isCapturing = true
    }
    
    /// Stop camera capture
    func stopCamera() {
        captureSession?.stopRunning()
        isCapturing = false
    }
    
    /// Switch between front and back cameras
    func switchCamera() async throws {
        guard let session = captureSession else { return }
        
        session.beginConfiguration()
        
        // Remove existing input
        if let currentInput = session.inputs.first as? AVCaptureDeviceInput {
            session.removeInput(currentInput)
        }
        
        // Toggle camera position
        currentCameraPosition = currentCameraPosition == .back ? .front : .back
        
        // Add new input
        guard let camera = AVCaptureDevice.default(.builtInWideAngleCamera,
                                                   for: .video,
                                                   position: currentCameraPosition) else {
            session.commitConfiguration()
            throw VisionError.cameraNotAvailable
        }
        
        let input = try AVCaptureDeviceInput(device: camera)
        if session.canAddInput(input) {
            session.addInput(input)
        }
        
        session.commitConfiguration()
    }
    
    // MARK: - Photo Capture
    
    /// Capture a still photo
    func capturePhoto() {
        guard let photoOutput = photoOutput else { return }
        
        let settings = AVCapturePhotoSettings()
        settings.flashMode = .auto
        
        photoOutput.capturePhoto(with: settings, delegate: self)
    }
    
    // MARK: - Vision Analysis
    
    /// Setup Vision framework requests
    private func setupVisionRequests() {
        // Object detection
        let objectDetection = VNDetectRectanglesRequest { request, error in
            self.handleDetectionResults(request: request, error: error)
        }
        objectDetection.maximumObservations = 10
        
        // Text recognition
        let textRecognition = VNRecognizeTextRequest { request, error in
            self.handleTextRecognition(request: request, error: error)
        }
        textRecognition.recognitionLevel = .accurate
        textRecognition.usesLanguageCorrection = true
        
        // Face detection
        let faceDetection = VNDetectFaceRectanglesRequest { request, error in
            self.handleFaceDetection(request: request, error: error)
        }
        
        // Barcode detection
        let barcodeDetection = VNDetectBarcodesRequest { request, error in
            self.handleBarcodeDetection(request: request, error: error)
        }
        
        visionRequests = [objectDetection, textRecognition, faceDetection, barcodeDetection]
    }
    
    /// Analyze an image using Vision framework
    func analyzeImage(_ image: UIImage) async throws -> VisionAnalysisResult {
        guard let cgImage = image.cgImage else {
            throw VisionError.invalidImage
        }
        
        isProcessing = true
        defer { isProcessing = false }
        
        return try await withCheckedThrowingContinuation { continuation in
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            
            visionQueue.async { [weak self] in
                guard let self = self else { return }
                
                do {
                    try handler.perform(self.visionRequests)
                    
                    // Compile results
                    let result = VisionAnalysisResult(
                        objects: self.detectedObjects,
                        text: self.recognizedText,
                        faces: self.detectedFaces,
                        barcodes: self.detectedBarcodes,
                        imageSize: image.size
                    )
                    
                    Task { @MainActor in
                        self.analysisResults = result
                    }
                    
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: VisionError.analysisFailedo(error.localizedDescription))
                }
            }
        }
    }
    
    // MARK: - Vision Handlers
    
    private var detectedObjects: [DetectedObject] = []
    private var recognizedText: [RecognizedText] = []
    private var detectedFaces: [DetectedFace] = []
    private var detectedBarcodes: [DetectedBarcode] = []
    
    private func handleDetectionResults(request: VNRequest, error: Error?) {
        guard let results = request.results as? [VNRectangleObservation] else { return }
        
        detectedObjects = results.map { observation in
            DetectedObject(
                boundingBox: observation.boundingBox,
                confidence: observation.confidence
            )
        }
    }
    
    private func handleTextRecognition(request: VNRequest, error: Error?) {
        guard let results = request.results as? [VNRecognizedTextObservation] else { return }
        
        recognizedText = results.compactMap { observation in
            guard let topCandidate = observation.topCandidates(1).first else { return nil }
            return RecognizedText(
                text: topCandidate.string,
                confidence: topCandidate.confidence,
                boundingBox: observation.boundingBox
            )
        }
    }
    
    private func handleFaceDetection(request: VNRequest, error: Error?) {
        guard let results = request.results as? [VNFaceObservation] else { return }
        
        detectedFaces = results.map { observation in
            DetectedFace(
                boundingBox: observation.boundingBox,
                confidence: observation.confidence
            )
        }
    }
    
    private func handleBarcodeDetection(request: VNRequest, error: Error?) {
        guard let results = request.results as? [VNBarcodeObservation] else { return }
        
        detectedBarcodes = results.compactMap { observation in
            guard let payload = observation.payloadStringValue else { return nil }
            return DetectedBarcode(
                payload: payload,
                symbology: observation.symbology.rawValue,
                boundingBox: observation.boundingBox,
                confidence: observation.confidence
            )
        }
    }
    
    // MARK: - Authorization
    
    private func checkCameraAuthorization() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            return true
        case .notDetermined:
            return await AVCaptureDevice.requestAccess(for: .video)
        default:
            return false
        }
    }
}

// MARK: - Photo Capture Delegate

extension VisionService: AVCapturePhotoCaptureDelegate {
    nonisolated func photoOutput(_ output: AVCapturePhotoOutput, 
                                 didFinishProcessingPhoto photo: AVCapturePhoto, 
                                 error: Error?) {
        guard error == nil,
              let data = photo.fileDataRepresentation(),
              let image = UIImage(data: data) else {
            return
        }
        
        Task { @MainActor in
            self.capturedImage = image
            
            // Automatically analyze captured photo
            do {
                _ = try await self.analyzeImage(image)
            } catch {
                self.currentError = error as? VisionError ?? .analysisFailedo(error.localizedDescription)
            }
        }
    }
}

// MARK: - Video Capture Delegate

extension VisionService: AVCaptureVideoDataOutputSampleBufferDelegate {
    nonisolated func captureOutput(_ output: AVCaptureOutput, 
                                  didOutput sampleBuffer: CMSampleBuffer, 
                                  from connection: AVCaptureConnection) {
        // Process video frames for real-time analysis if needed
        // This is called on the visionQueue
    }
}

// MARK: - Data Models

struct VisionAnalysisResult: Identifiable, Sendable {
    let id = UUID()
    let objects: [DetectedObject]
    let text: [RecognizedText]
    let faces: [DetectedFace]
    let barcodes: [DetectedBarcode]
    let imageSize: CGSize
    let timestamp = Date()
}

struct DetectedObject: Identifiable, Sendable {
    let id = UUID()
    let boundingBox: CGRect
    let confidence: Float
}

struct RecognizedText: Identifiable, Sendable {
    let id = UUID()
    let text: String
    let confidence: Float
    let boundingBox: CGRect
}

struct DetectedFace: Identifiable, Sendable {
    let id = UUID()
    let boundingBox: CGRect
    let confidence: Float
}

struct DetectedBarcode: Identifiable, Sendable {
    let id = UUID()
    let payload: String
    let symbology: String
    let boundingBox: CGRect
    let confidence: Float
}

// MARK: - Errors

enum VisionError: LocalizedError {
    case cameraNotAuthorized
    case cameraNotAvailable
    case cameraSetupFailed
    case invalidImage
    case analysisFailedo(String)
    
    var errorDescription: String? {
        switch self {
        case .cameraNotAuthorized:
            return "Camera access not authorized. Please enable in Settings."
        case .cameraNotAvailable:
            return "Camera is not available on this device."
        case .cameraSetupFailed:
            return "Failed to setup camera session."
        case .invalidImage:
            return "Invalid image format."
        case .analysisFailedo(let message):
            return "Analysis failed: \(message)"
        }
    }
}