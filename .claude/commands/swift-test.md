# Generate Swift Tests

Generate comprehensive XCTest unit tests for $ARGUMENTS:

1. Read the file at $ARGUMENTS to understand the implementation
2. Create a corresponding test file in the Tests directory
3. Include tests for:
   - All public methods
   - Edge cases and error conditions
   - Async operations using XCTestExpectation
   - Mock dependencies where appropriate
4. Use descriptive test names following pattern: test_methodName_condition_expectedResult
5. Add setup() and tearDown() methods if needed
6. Aim for >80% code coverage
7. Include performance tests for critical paths using measure {}
8. Add integration tests if the component interacts with other services