/**
 * Logger Utility Tests
 */

import { LogContext, log, logger } from '../logger';
import winston from 'winston';

// Mock winston logger
jest.mock('winston', () => {
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn(),
  };
  
  return {
    createLogger: jest.fn(() => mockLogger),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      errors: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
      simple: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
      File: jest.fn(),
    },
  };
});

describe('Logger', () => {
  const mockLogger = logger as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('log methods', () => {
    it('should log info messages', () => {
      log.info('Test info message', LogContext.SERVER, { test: true });
      
      expect(mockLogger.info).toHaveBeenCalledWith('Test info message', {
        context: LogContext.SERVER,
        test: true,
      });
    });

    it('should log error messages', () => {
      log.error('Test error message', LogContext.SERVER, { error: 'test' });
      
      expect(mockLogger.error).toHaveBeenCalledWith('Test error message', {
        context: LogContext.SERVER,
        error: 'test',
      });
    });

    it('should log warning messages', () => {
      log.warn('Test warning message', LogContext.SERVER, { warning: 'test' });
      
      expect(mockLogger.warn).toHaveBeenCalledWith('Test warning message', {
        context: LogContext.SERVER,
        warning: 'test',
      });
    });

    it('should log debug messages', () => {
      log.debug('Test debug message', LogContext.SERVER, { debug: true });
      
      expect(mockLogger.debug).toHaveBeenCalledWith('Test debug message', {
        context: LogContext.SERVER,
        debug: true,
      });
    });
  });

  describe('LogContext', () => {
    it('should have all required contexts', () => {
      expect(LogContext.SERVER).toBeDefined();
      expect(LogContext.API).toBeDefined();
      expect(LogContext.AI).toBeDefined();
      expect(LogContext.AGENT).toBeDefined();
      expect(LogContext.MEMORY).toBeDefined();
      expect(LogContext.SYSTEM).toBeDefined();
      expect(LogContext.AUTH).toBeDefined();
      expect(LogContext.WEBSOCKET).toBeDefined();
      expect(LogContext.DATABASE).toBeDefined();
      expect(LogContext.DSPY).toBeDefined();
    });
  });
});