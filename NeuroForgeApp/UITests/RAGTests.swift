import XCTest

final class RAGTests: XCTestCase {
    func testRAGIngestAndSearch_ifPresent() throws {
        let app = XCUIApplication()
        app.launchEnvironment["API_BASE"] = "http://localhost:8014"
        app.launchEnvironment["QA_MODE"] = "1"
        app.launch()

        let ingest = app.buttons["ingest_button"]
        let search = app.textFields["rag_search_input"]

        if !(ingest.exists && search.exists) { throw XCTSkip("RAG UI not present") }

        let tmp = NSTemporaryDirectory()
        try "Ada Lovelace wrote the first algorithm for a machine (1843)."
            .write(toFile: (tmp as NSString).appendingPathComponent("ada.txt"), atomically: true, encoding: .utf8)
        try "Grace Hopper helped create COBOL."
            .write(toFile: (tmp as NSString).appendingPathComponent("hopper.txt"), atomically: true, encoding: .utf8)
        try "Alan Turing worked on Enigma."
            .write(toFile: (tmp as NSString).appendingPathComponent("turing.txt"), atomically: true, encoding: .utf8)

        ingest.click()

        search.click()
        search.typeText("Who wrote the first algorithm for a machine?")
        app.typeKey(.return, modifierFlags: [])
        let results = app.tables["rag_results_list"]
        XCTAssertTrue(results.waitForExistence(timeout: 12))
    }
}

