// Empty module for mocking
import { jest } from '@jest/globals';
export default {};
export const mockOrchestrator = {
    process: jest.fn().mockResolvedValue({}),
    optimize: jest.fn().mockResolvedValue({}),
    analyze: jest.fn().mockResolvedValue({}),
};
export const createOrchestrator = jest.fn().mockReturnValue(mockOrchestrator);
//# sourceMappingURL=empty-module.js.map