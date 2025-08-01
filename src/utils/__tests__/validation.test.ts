/**
 * Validation Utility Tests
 */

import { 
  ValidationError,
  sanitizeInput,
  validateApiKey,
  validateArrayLength,
  validateEmail,
  validateEnum,
  validateJson,
  validatePhone,
  validateRange,
  validateUrl
} from '../validation';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('user @example.com')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
      expect(validateUrl('https://api.example.com/v1/endpoint')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false);
      expect(validateUrl('ftp://example.com')).toBe(false);
      expect(validateUrl('//example.com')).toBe(false);
    });
  });

  describe('validatePhone', () => {
    it('should validate correct phone numbers', () => {
      expect(validatePhone('+1234567890')).toBe(true);
      expect(validatePhone('+44123456789')).toBe(true);
      expect(validatePhone('+12025551234')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhone('1234567890')).toBe(false);
      expect(validatePhone('+1')).toBe(false);
      expect(validatePhone('phone-number')).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should validate correct API key formats', () => {
      expect(validateApiKey('sk_test_abcd1234efgh5678')).toBe(true);
      expect(validateApiKey('pk_live_1234567890abcdef')).toBe(true);
      expect(validateApiKey('api_key_1234567890')).toBe(true);
    });

    it('should reject invalid API key formats', () => {
      expect(validateApiKey('short')).toBe(false);
      expect(validateApiKey('has spaces in it')).toBe(false);
      expect(validateApiKey('has-special-chars!')).toBe(false);
    });
  });

  describe('validateJson', () => {
    it('should validate and parse correct JSON', () => {
      expect(validateJson('{"key": "value"}')).toEqual({ key: 'value' });
      expect(validateJson('[1, 2, 3]')).toEqual([1, 2, 3]);
      expect(validateJson('null')).toBe(null);
    });

    it('should throw ValidationError for invalid JSON', () => {
      expect(() => validateJson('invalid json')).toThrow(ValidationError);
      expect(() => validateJson('{key: value}')).toThrow(ValidationError);
      expect(() => validateJson('{"unclosed": ')).toThrow(ValidationError);
    });
  });

  describe('validateEnum', () => {
    const enumValues = ['option1', 'option2', 'option3'];

    it('should validate values in enum', () => {
      expect(validateEnum('option1', enumValues)).toBe(true);
      expect(validateEnum('option2', enumValues)).toBe(true);
      expect(validateEnum('option3', enumValues)).toBe(true);
    });

    it('should reject values not in enum', () => {
      expect(validateEnum('option4', enumValues)).toBe(false);
      expect(validateEnum('', enumValues)).toBe(false);
      expect(validateEnum('OPTION1', enumValues)).toBe(false);
    });
  });

  describe('validateRange', () => {
    it('should validate numbers within range', () => {
      expect(validateRange(5, 1, 10)).toBe(true);
      expect(validateRange(1, 1, 10)).toBe(true);
      expect(validateRange(10, 1, 10)).toBe(true);
    });

    it('should reject numbers outside range', () => {
      expect(validateRange(0, 1, 10)).toBe(false);
      expect(validateRange(11, 1, 10)).toBe(false);
      expect(validateRange(-5, 1, 10)).toBe(false);
    });

    it('should handle decimal ranges', () => {
      expect(validateRange(0.5, 0, 1)).toBe(true);
      expect(validateRange(1.5, 0, 1)).toBe(false);
    });
  });

  describe('validateArrayLength', () => {
    it('should validate array lengths within range', () => {
      expect(validateArrayLength([1, 2, 3], 1, 5)).toBe(true);
      expect(validateArrayLength([], 0, 5)).toBe(true);
      expect(validateArrayLength([1, 2, 3, 4, 5], 1, 5)).toBe(true);
    });

    it('should reject array lengths outside range', () => {
      expect(validateArrayLength([], 1, 5)).toBe(false);
      expect(validateArrayLength([1, 2, 3, 4, 5, 6], 1, 5)).toBe(false);
    });

    it('should handle undefined max length', () => {
      expect(validateArrayLength([1, 2, 3], 1)).toBe(true);
      expect(validateArrayLength(Array(100).fill(0), 1)).toBe(true);
    });
  });

  describe('sanitizeInput', () => {
    it('should sanitize HTML tags', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
      expect(sanitizeInput('Hello <b>world</b>')).toBe('Hello world');
      expect(sanitizeInput('<div>Content</div>')).toBe('Content');
    });

    it('should preserve safe content', () => {
      expect(sanitizeInput('Hello World')).toBe('Hello World');
      expect(sanitizeInput('email@example.com')).toBe('email@example.com');
      expect(sanitizeInput('Price: $100.00')).toBe('Price: $100.00');
    });

    it('should handle special characters', () => {
      expect(sanitizeInput('Test & Co.')).toBe('Test &amp; Co.');
      expect(sanitizeInput('5 < 10')).toBe('5 &lt; 10');
      expect(sanitizeInput('"quoted"')).toBe('&quot;quoted&quot;');
    });
  });

  describe('ValidationError', () => {
    it('should create proper error instances', () => {
      const error = new ValidationError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ValidationError');
    });

    it('should include field information', () => {
      const error = new ValidationError('Invalid email', 'email');
      expect(error.field).toBe('email');
    });
  });

  describe('composite validation', () => {
    it('should validate complex objects', () => {
      const validateUser = (user: any) => {
        const errors: string[] = [];
        
        if (!validateEmail(user.email)) {
          errors.push('Invalid email');
        }
        
        if (!validateRange(user.age, 18, 120)) {
          errors.push('Age must be between 18 and 120');
        }
        
        if (!validateEnum(user.role, ['user', 'admin', 'moderator'])) {
          errors.push('Invalid role');
        }
        
        return errors.length === 0 ? { valid: true } : { valid: false, errors };
      };

      const validUser = {
        email: 'user@example.com',
        age: 25,
        role: 'user'
      };
      
      const invalidUser = {
        email: 'invalid-email',
        age: 150,
        role: 'superuser'
      };

      expect(validateUser(validUser)).toEqual({ valid: true });
      expect(validateUser(invalidUser)).toEqual({
        valid: false,
        errors: ['Invalid email', 'Age must be between 18 and 120', 'Invalid role']
      });
    });
  });
});