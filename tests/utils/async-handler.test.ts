import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { asyncHandler } from '../../src/utils/async-handler';
import type { Request, Response, NextFunction } from 'express';

describe('asyncHandler', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = jest.fn();
  });

  it('should handle successful async operations', async () => {
    const asyncFn = async (req: any, res: any, next: any) => {
      return 'success';
    };
    const wrappedHandler = asyncHandler(asyncFn);

    await wrappedHandler(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should catch and pass async errors to next', async () => {
    const error = new Error('Async error');
    const asyncFn = async (req: any, res: any, next: any) => {
      throw error;
    };
    const wrappedHandler = asyncHandler(asyncFn);

    await wrappedHandler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle synchronous errors in async functions', async () => {
    const error = new Error('Sync error in async function');
    const asyncFn = async (req: any, res: any, next: any) => {
      throw error;
    };
    const wrappedHandler = asyncHandler(asyncFn);

    await wrappedHandler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should handle functions that return non-promises', async () => {
    const syncFn = async (req: any, res: any, next: any) => {
      return 'sync result';
    };
    const wrappedHandler = asyncHandler(syncFn);

    await wrappedHandler(mockReq, mockRes, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should preserve function context and parameters', async () => {
    const asyncFn = async (req: any, res: any, next: any) => {
      expect(req).toBe(mockReq);
      expect(res).toBe(mockRes);
      expect(next).toBe(mockNext);
      return 'context preserved';
    };
    const wrappedHandler = asyncHandler(asyncFn);

    await wrappedHandler(mockReq, mockRes, mockNext);
  });

  it('should handle Promise rejection chains', async () => {
    const error = new Error('Chain error');
    const asyncFn = (req: any, res: any, next: any) => 
      Promise.reject(error);
    const wrappedHandler = asyncHandler(asyncFn);

    await wrappedHandler(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });
});