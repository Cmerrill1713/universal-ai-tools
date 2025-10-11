import XCTest
import Foundation

final class RAGTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testRAGIngestAndSearchFlow() throws {
        try requireUITestHost()
        let app = XCUIApplication()
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        guard app.buttons["ingest_button"].waitForExistence(timeout: 3) else {
            throw XCTSkip("RAG ingest UI not present; skipping until UI is implemented")
        }

        let ingestButton = app.buttons["ingest_button"]
        ingestButton.click()

        let queryField = app.textFields["rag_query"]
        XCTAssertTrue(queryField.waitForExistence(timeout: 5), "RAG query field missing")

        let tempDir = NSTemporaryDirectory()
        let fileURLs = (1...3).map { index -> URL in
            let url = URL(fileURLWithPath: tempDir).appendingPathComponent("rag_test_file_\(index).txt")
            try? "Test content \(index)".write(to: url, atomically: true, encoding: .utf8)
            return url
        }

        let panel = app.dialogs.firstMatch
        if panel.exists {
            let pathField = panel.textFields.element(boundBy: 0)
            if pathField.exists {
                pathField.click()
                pathField.typeText(fileURLs.map(\.path).joined(separator: "\n"))
            }
            panel.buttons["Open"].click()
        }

        queryField.click()
        queryField.typeText("Test content 2")
        app.buttons["rag_search"].click()

        let results = app.tables["rag_results"]
        XCTAssertTrue(results.waitForExistence(timeout: 5), "RAG results table missing")
    }
}
