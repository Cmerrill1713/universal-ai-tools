import Foundation
import UIKit
import SwiftUI
import Combine

// MARK: - Image Cache Manager

class ImageCacheManager: ObservableObject {
    static let shared = ImageCacheManager()
    
    private let cache = NSCache<NSString, UIImage>()
    private let diskCacheURL: URL
    private let memoryLimit: Int = 50 * 1024 * 1024 // 50MB
    private let diskLimit: Int = 200 * 1024 * 1024 // 200MB
    private var cancellables = Set<AnyCancellable>()
    
    init() {
        // Configure memory cache
        cache.totalCostLimit = memoryLimit
        cache.countLimit = 100
        
        // Setup disk cache directory
        let cacheDirectory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        diskCacheURL = cacheDirectory.appendingPathComponent("ImageCache")
        
        // Create directory if needed
        try? FileManager.default.createDirectory(at: diskCacheURL, withIntermediateDirectories: true)
        
        // Clean old cache on init
        cleanDiskCache()
        
        // Listen for memory warnings
        NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { [weak self] _ in
                self?.clearMemoryCache()
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Public Methods
    
    func image(for key: String) -> UIImage? {
        let cacheKey = NSString(string: key)
        
        // Check memory cache first
        if let cachedImage = cache.object(forKey: cacheKey) {
            return cachedImage
        }
        
        // Check disk cache
        if let diskImage = loadFromDisk(key: key) {
            // Store in memory cache for faster access
            cache.setObject(diskImage, forKey: cacheKey, cost: diskImage.pngData()?.count ?? 0)
            return diskImage
        }
        
        return nil
    }
    
    func store(_ image: UIImage, for key: String) {
        let cacheKey = NSString(string: key)
        let cost = image.pngData()?.count ?? 0
        
        // Store in memory cache
        cache.setObject(image, forKey: cacheKey, cost: cost)
        
        // Store on disk asynchronously
        Task {
            await saveToDisk(image: image, key: key)
        }
    }
    
    func prefetch(urls: [URL]) {
        for url in urls {
            Task {
                await loadImage(from: url)
            }
        }
    }
    
    @MainActor
    func loadImage(from url: URL) async -> UIImage? {
        let key = url.absoluteString
        
        // Check cache first
        if let cachedImage = image(for: key) {
            return cachedImage
        }
        
        // Download image
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let image = UIImage(data: data) {
                store(image, for: key)
                return image
            }
        } catch {
            print("Failed to load image from \(url): \(error)")
        }
        
        return nil
    }
    
    // MARK: - Private Methods
    
    private func loadFromDisk(key: String) -> UIImage? {
        let fileURL = diskCacheURL.appendingPathComponent(key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? key)
        
        guard FileManager.default.fileExists(atPath: fileURL.path),
              let data = try? Data(contentsOf: fileURL),
              let image = UIImage(data: data) else {
            return nil
        }
        
        return image
    }
    
    private func saveToDisk(image: UIImage, key: String) async {
        let fileURL = diskCacheURL.appendingPathComponent(key.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? key)
        
        guard let data = image.jpegData(compressionQuality: 0.8) else { return }
        
        do {
            try data.write(to: fileURL)
        } catch {
            print("Failed to save image to disk: \(error)")
        }
    }
    
    private func clearMemoryCache() {
        cache.removeAllObjects()
    }
    
    private func cleanDiskCache() {
        Task {
            let fileManager = FileManager.default
            let resourceKeys: [URLResourceKey] = [.contentAccessDateKey, .totalFileAllocatedSizeKey]
            
            guard let enumerator = fileManager.enumerator(
                at: diskCacheURL,
                includingPropertiesForKeys: resourceKeys,
                options: [.skipsHiddenFiles]
            ) else { return }
            
            var totalSize = 0
            var fileURLs: [(url: URL, accessDate: Date, size: Int)] = []
            
            // Collect file info
            for case let fileURL as URL in enumerator {
                guard let resourceValues = try? fileURL.resourceValues(forKeys: Set(resourceKeys)),
                      let accessDate = resourceValues.contentAccessDate,
                      let size = resourceValues.totalFileAllocatedSize else {
                    continue
                }
                
                totalSize += size
                fileURLs.append((url: fileURL, accessDate: accessDate, size: size))
            }
            
            // Remove old files if over limit
            if totalSize > diskLimit {
                // Sort by access date (oldest first)
                fileURLs.sort { $0.accessDate < $1.accessDate }
                
                var currentSize = totalSize
                for file in fileURLs {
                    guard currentSize > diskLimit else { break }
                    
                    try? fileManager.removeItem(at: file.url)
                    currentSize -= file.size
                }
            }
        }
    }
}

// MARK: - Cached Image View

struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    @ViewBuilder let content: (Image) -> Content
    @ViewBuilder let placeholder: () -> Placeholder
    
    @State private var image: UIImage?
    @State private var isLoading = false
    
    var body: some View {
        Group {
            if let image = image {
                content(Image(uiImage: image))
            } else if isLoading {
                placeholder()
            } else {
                placeholder()
                    .onAppear {
                        loadImage()
                    }
            }
        }
    }
    
    private func loadImage() {
        guard let url = url else { return }
        
        isLoading = true
        
        Task {
            if let loadedImage = await ImageCacheManager.shared.loadImage(from: url) {
                await MainActor.run {
                    self.image = loadedImage
                    self.isLoading = false
                }
            } else {
                await MainActor.run {
                    self.isLoading = false
                }
            }
        }
    }
}

// MARK: - Usage Example

extension CachedAsyncImage where Placeholder == ProgressView<EmptyView, EmptyView> {
    init(url: URL?, @ViewBuilder content: @escaping (Image) -> Content) {
        self.init(url: url, content: content) {
            ProgressView()
        }
    }
}