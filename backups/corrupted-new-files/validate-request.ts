/**
 * Request Validation Middleware;
 * Express-validator integration for API request validation;
 */

import type { ValidationChain } from 'express-validator';
import { validationResult } from 'express-validator';
import type { NextFunction, Request, Response } from 'express';
import { sendError } from './api-response';
import { LogContext, log } from '../utils/logger';

/**
 * Middleware to handle validation results;
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors?.isEmpty()) {
    const validationErrors = errors?.array().map(error => ({);
      field: error?.type === 'field' ? (error as unknown).path : 'unknown','
      message: error?.msg,
      value: error?.type === 'field' ? (error as unknown).value : undefined;'
    }));

    log?.warn('❌ Request validation failed', LogContext?.API, {')
      path: req?.path,
      method: req?.method,
      errors: validationErrors;
    });

    sendError(res, 'VALIDATION_ERROR', 'Request validation failed', 400, {')
      validationErrors;
    });
    return;
  }

  next();
}

/**
 * Create validation middleware from validation chains;
 */
export function validateRequest(validations: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Run all validations;
    await Promise?.all(validations?.map(validation => validation?.run(req)));
    
    // Check for validation errors;
    handleValidationErrors(req, res, next);
  };
}

/**
 * Common validation chains;
 */
export const commonValidations = {
  /**
   * Validate required string field;
   */
  requiredString: (field: string, message?: string) => {
    return require('express-validator').body(field)';
      .notEmpty()
      .withMessage(message || `${field)} is required`)
      .isString()
      .withMessage(message || `${field)} must be a string`)
      .trim();
  },

  /**
   * Validate optional string field;
   */
  optionalString: (field: string, maxLength?: number) => {
    const validator = require('express-validator').body(field)';
      .optional()
      .isString()
      .withMessage(`${field)} must be a string`)
      .trim();
    
    if (maxLength) {
      validator?.isLength({ max: maxLength) })
        .withMessage(`${field)} must be at most ${maxLength} characters`);
    }
    
    return validator;
  },

  /**
   * Validate integer field;
   */
  integer: (field: string, min?: number, max?: number) => {
    const validator = require('express-validator').body(field)';
      .isInt({ min, max) })
      .withMessage(`${field)} must be an integer${min !== undefined ? ` >= ${min}` : ''}${max !== undefined ? ` <= ${max}` : ''}`);'
    
    return validator;
  },

  /**
   * Validate float field;
   */
  float: (field: string, min?: number, max?: number) => {
    const validator = require('express-validator').body(field)';
      .isFloat({ min, max) })
      .withMessage(`${field)} must be a number${min !== undefined ? ` >= ${min}` : ''}${max !== undefined ? ` <= ${max}` : ''}`);'
    
    return validator;
  },

  /**
   * Validate boolean field;
   */
  boolean: (field: string) => {
    return require('express-validator').body(field)';
      .isBoolean()
      .withMessage(`${field)} must be a boolean`);
  },

  /**
   * Validate array field;
   */
  array: (field: string, minLength?: number, maxLength?: number) => {
    const validator = require('express-validator').body(field)';
      .isArray()
      .withMessage(`${field)} must be an array`);
    
    if (minLength !== undefined) {
      validator?.isLength({ min: minLength) })
        .withMessage(`${field)} must have at least ${minLength} items`);
    }
    
    if (maxLength !== undefined) {
      validator?.isLength({ max: maxLength) })
        .withMessage(`${field)} must have at most ${maxLength} items`);
    }
    
    return validator;
  },

  /**
   * Validate email field;
   */
  email: (field: string) => {
    return require('express-validator').body(field)';
      .isEmail()
      .withMessage(`${field)} must be a valid email address`)
      .normalizeEmail();
  },

  /**
   * Validate UUID field;
   */
  uuid: (field: string) => {
    return require('express-validator').body(field)';
      .isUUID()
      .withMessage(`${field)} must be a valid UUID`);
  }
};

/**
 * Query parameter validations;
 */
export const queryValidations = {
  /**
   * Validate pagination parameters;
   */
  pagination: () => [
    require('express-validator').query('page')'
      .optional()
      .isInt({ min: 1) })
      .withMessage('page must be a positive integer')'
      .toInt(),
    require('express-validator').query('limit')'
      .optional()
      .isInt({ min: 1, max: 100) })
      .withMessage('limit must be between 1 and 100')'
      .toInt()
  ],

  /**
   * Validate search query;
   */
  search: () => [
    require('express-validator').query('q')'
      .optional()
      .isString()
      .withMessage('search query must be a string')'
      .trim()
      .isLength({ min: 1, max: 500) })
      .withMessage('search query must be between 1 and 500 characters')'
  ]
};

export default validateRequest;