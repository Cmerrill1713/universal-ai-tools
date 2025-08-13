import XCTest
import UIKit
@testable import UniversalAICompanion

class ImageCacheManagerTests: XCTestCase {
    var cacheManager: ImageCacheManager!

    override func setUp() {
        super.setUp()
        cacheManager = ImageCacheManager()
    }

    override func tearDown() {
        cacheManager = nil
        super.tearDown()
    }

    func testImageCaching() {
        // Create a test image
        let testImage = UIImage(systemName: "star.fill")!
        let testKey = "test_star_image"

        // Store image in cache
        cacheManager.store(testImage, for: testKey)

        // Retrieve image from cache
        let cachedImage = cacheManager.image(for: testKey)

        // Assert image is cached and matches original
        XCTAssertNotNil(cachedImage, "Image should be cached")
        XCTAssertTrue(compareImages(testImage, cachedImage!), "Cached image should match original")
    }

    func testImageOverwriting() {
        let testKey = "overwrite_test_image"

        // First image
        let image1 = UIImage(systemName: "star.fill")!
        cacheManager.store(image1, for: testKey)

        // Second image
        let image2 = UIImage(systemName: "heart.fill")!
        cacheManager.store(image2, for: testKey)

        // Retrieve image
        let cachedImage = cacheManager.image(for: testKey)

        // Assert latest image is cached
        XCTAssertNotNil(cachedImage, "Image should be cached")
        XCTAssertTrue(compareImages(image2, cachedImage!), "Latest image should be cached")
    }

    func testMemoryCacheLimit() {
        // Store more images than memory limit
        for i in 0..<150 {
            let image = createTestImage(withColor: .systemBlue, size: CGSize(width: 100, height: 100))
            cacheManager.store(image, for: "image_\(i)")
        }

        // Check that total number of cached images is limited
        let cachedImagesCount = (0..<150)
            .compactMap { cacheManager.image(for: "image_\($0)") }
            .count

        XCTAssertLessThanOrEqual(cachedImagesCount, 100, "Cache should limit number of images")
    }

    func testDiskCaching() {
        let testImage = UIImage(systemName: "star.fill")!
        let testKey = "disk_cache_test_image"

        // Store image
        cacheManager.store(testImage, for: testKey)

        // Create a new cache manager to test disk persistence
        let newCacheManager = ImageCacheManager()
        let retrievedImage = newCacheManager.image(for: testKey)

        // Assert image is retrieved from disk
        XCTAssertNotNil(retrievedImage, "Image should be retrievable from disk cache")
        XCTAssertTrue(compareImages(testImage, retrievedImage!), "Disk cached image should match original")
    }

    func testPrefetching() {
        let testURLs = [
            URL(string: "https://example.com/image1.jpg")!,
            URL(string: "https://example.com/image2.jpg")!
        ]

        let expectation = XCTestExpectation(description: "Prefetch images")

        cacheManager.prefetch(urls: testURLs)

        // Wait for a short time to allow prefetching
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            expectation.fulfill()
        }

        wait(for: [expectation], timeout: 5.0)
    }

    // Utility method to compare images
    private func compareImages(_ image1: UIImage, _ image2: UIImage) -> Bool {
        let data1 = image1.pngData()
        let data2 = image2.pngData()
        return data1 == data2
    }

    // Utility method to create test images
    private func createTestImage(withColor color: UIColor, size: CGSize) -> UIImage {
        UIGraphicsBeginImageContextWithOptions(size, false, 0)
        color.setFill()
        UIRectFill(CGRect(origin: .zero, size: size))
        let image = UIGraphicsGetImageFromCurrentImageContext()!
        UIGraphicsEndImageContext()
        return image
    }
}

// Mock URLSession for testing network image loading
class MockURLSession: URLSession {
    var mockData: [URL: Data] = [:]

    func setMockData(url: URL, data: Data) {
        mockData[url] = data
    }

    override func data(from url: URL) async throws -> (Data, URLResponse) {
        guard let data = mockData[url] else {
            throw URLError(.badURL)
        }

        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: nil,
            headerFields: nil
        )!

        return (data, response)
    }
}
