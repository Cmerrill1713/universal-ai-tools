/**
 * Test Fixtures and Mock Data for Autonomous Code Generation Tests
 * Provides comprehensive test data for all supported languages and scenarios
 */

// TypeScript Code Samples
export const mockTypeScriptCode = `
interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

class UserService {
  private users: Map<string, User> = new Map();

  async createUser(userData: Omit<User, 'id' | 'createdAt'>): Promise<User> {
    const user: User = {
      id: Math.random().toString(36).substring(7),
      ...userData,
      createdAt: new Date()
    };
    
    this.users.set(user.id, user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) return null;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
}
`;

// JavaScript Code Samples
export const mockJavaScriptCode = `
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthController {
  constructor(userService) {
    this.userService = userService;
  }

  async register(req, res) {
    try {
      const { username, email, password } = req.body;
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user
      const user = await this.userService.createUser({
        username,
        email,
        password: hashedPassword
      });
      
      res.status(201).json({ 
        success: true, 
        user: { id: user.id, username: user.username, email: user.email } 
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { username, password } = req.body;
      
      const user = await this.userService.findByUsername(username);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ success: true, token });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = AuthController;
`;

// Python Code Samples
export const mockPythonCode = `
from typing import List, Optional, Dict, Any
from datetime import datetime
import hashlib
import secrets

class UserManager:
    def __init__(self):
        self.users: Dict[str, Dict[str, Any]] = {}
        self.sessions: Dict[str, str] = {}

    def create_user(self, username: str, email: str, password: str) -> Dict[str, Any]:
        """Create a new user with hashed password."""
        if username in self.users:
            raise ValueError("Username already exists")
        
        # Generate salt and hash password
        salt = secrets.token_hex(16)
        password_hash = hashlib.pbkdf2_hmac('sha256', 
                                           password.encode('utf-8'), 
                                           salt.encode('utf-8'), 
                                           100000)
        
        user_id = secrets.token_urlsafe(16)
        user_data = {
            'id': user_id,
            'username': username,
            'email': email,
            'password_hash': password_hash.hex(),
            'salt': salt,
            'created_at': datetime.utcnow().isoformat(),
            'last_login': None
        }
        
        self.users[username] = user_data
        return {k: v for k, v in user_data.items() if k not in ['password_hash', 'salt']}

    def authenticate(self, username: str, password: str) -> Optional[str]:
        """Authenticate user and return session token."""
        user = self.users.get(username)
        if not user:
            return None
        
        # Verify password
        password_hash = hashlib.pbkdf2_hmac('sha256',
                                           password.encode('utf-8'),
                                           user['salt'].encode('utf-8'),
                                           100000)
        
        if password_hash.hex() != user['password_hash']:
            return None
        
        # Create session
        session_token = secrets.token_urlsafe(32)
        self.sessions[session_token] = username
        
        # Update last login
        user['last_login'] = datetime.utcnow().isoformat()
        
        return session_token

    def get_user_by_session(self, session_token: str) -> Optional[Dict[str, Any]]:
        """Get user data by session token."""
        username = self.sessions.get(session_token)
        if not username:
            return None
        
        user = self.users.get(username)
        if user:
            return {k: v for k, v in user.items() if k not in ['password_hash', 'salt']}
        return None

    def logout(self, session_token: str) -> bool:
        """Logout user by removing session."""
        if session_token in self.sessions:
            del self.sessions[session_token]
            return True
        return False
`;

// Mock Repository Structure
export const mockRepositoryStructure = {
  name: 'test-secure-api',
  description: 'Test repository for secure API patterns',
  primaryLanguage: 'typescript',
  languages: ['typescript', 'javascript'],
  framework: 'express',
  size: 1500000, // bytes
  contributors: 5,
  lastUpdated: '2025-01-01T00:00:00Z',
  files: [
    {
      path: 'src/controllers/AuthController.ts',
      language: 'typescript',
      size: 2500,
      lastModified: '2025-01-01T00:00:00Z'
    },
    {
      path: 'src/services/UserService.ts',
      language: 'typescript',
      size: 1800,
      lastModified: '2025-01-01T00:00:00Z'
    },
    {
      path: 'src/middleware/authMiddleware.ts',
      language: 'typescript',
      size: 800,
      lastModified: '2025-01-01T00:00:00Z'
    },
    {
      path: 'tests/auth.test.ts',
      language: 'typescript',
      size: 3200,
      lastModified: '2025-01-01T00:00:00Z'
    }
  ]
};

// Mock Security Vulnerabilities
export const mockSecurityVulnerabilities = [
  {
    id: 'vuln-1',
    type: 'injection',
    severity: 'high',
    title: 'SQL Injection Vulnerability',
    description: 'User input is directly concatenated into SQL query without sanitization',
    location: { line: 25, column: 15, file: 'userService.ts' },
    cweId: 'CWE-89',
    owasp: 'A03:2021 - Injection',
    category: 'injection',
    evidence: 'const query = "SELECT * FROM users WHERE id = " + userId;',
    fixable: true,
    exploitability: 'high',
    impact: 'high',
    confidenceLevel: 0.95
  },
  {
    id: 'vuln-2',
    type: 'crypto',
    severity: 'medium',
    title: 'Weak Cryptographic Hash',
    description: 'Using MD5 for password hashing is cryptographically weak',
    location: { line: 42, column: 8, file: 'authService.ts' },
    cweId: 'CWE-327',
    owasp: 'A02:2021 - Cryptographic Failures',
    category: 'crypto',
    evidence: 'const hash = crypto.createHash("md5").update(password).digest("hex");',
    fixable: true,
    exploitability: 'medium',
    impact: 'high',
    confidenceLevel: 0.88
  },
  {
    id: 'vuln-3',
    type: 'secrets',
    severity: 'critical',
    title: 'Hardcoded API Key',
    description: 'API key is hardcoded in source code',
    location: { line: 10, column: 20, file: 'config.ts' },
    cweId: 'CWE-798',
    owasp: 'A07:2021 - Identification and Authentication Failures',
    category: 'secrets',
    evidence: 'const apiKey = "sk-1234567890abcdef";',
    fixable: true,
    exploitability: 'high',
    impact: 'critical',
    confidenceLevel: 0.99
  }
];

// Mock Quality Issues
export const mockQualityIssues = [
  {
    type: 'complexity',
    severity: 'medium',
    description: 'Function has high cyclomatic complexity (15)',
    location: { line: 35, column: 1, file: 'dataProcessor.ts' },
    suggestion: 'Break down into smaller functions',
    impact: 'maintainability'
  },
  {
    type: 'duplication',
    severity: 'low',
    description: 'Duplicate code block found in multiple locations',
    location: { line: 50, column: 5, file: 'utils.ts' },
    suggestion: 'Extract common functionality into shared utility',
    impact: 'maintainability'
  },
  {
    type: 'naming',
    severity: 'low',
    description: 'Variable name "d" is not descriptive',
    location: { line: 22, column: 10, file: 'calculator.ts' },
    suggestion: 'Use descriptive variable names like "data" or "result"',
    impact: 'readability'
  }
];

// Mock Code Patterns
export const mockCodePatterns = [
  {
    id: 'pattern-1',
    type: 'architectural',
    name: 'Controller-Service Pattern',
    signature: 'class Controller { constructor(service) }',
    complexity: 0.6,
    qualityScore: 0.85,
    frequency: 12,
    filePath: 'src/controllers',
    lineStart: 1,
    lineEnd: 50,
    usageContext: 'HTTP request handling',
    relatedPatterns: ['dependency-injection', 'error-handling'],
    documentation: 'Standard controller pattern with service injection'
  },
  {
    id: 'pattern-2',
    type: 'security',
    name: 'JWT Authentication Middleware',
    signature: '(req, res, next) => { jwt.verify() }',
    complexity: 0.4,
    qualityScore: 0.9,
    frequency: 8,
    filePath: 'src/middleware',
    lineStart: 10,
    lineEnd: 35,
    usageContext: 'Authentication and authorization',
    relatedPatterns: ['error-handling', 'async-middleware'],
    documentation: 'JWT token validation middleware'
  }
];

// Mock Test Cases for Different Languages
export const mockTestCases = {
  typescript: {
    input: 'Create a type-safe API endpoint for user registration',
    expectedKeywords: ['interface', 'async', 'Promise', 'express', 'Request', 'Response'],
    securityRequirements: ['input validation', 'password hashing', 'XSS prevention'],
    qualityRequirements: ['type safety', 'error handling', 'documentation']
  },
  javascript: {
    input: 'Create a middleware for request rate limiting',
    expectedKeywords: ['function', 'middleware', 'req', 'res', 'next'],
    securityRequirements: ['DOS prevention', 'IP tracking', 'configurable limits'],
    qualityRequirements: ['error handling', 'configurable', 'documentation']
  },
  python: {
    input: 'Create a data processing pipeline with error handling',
    expectedKeywords: ['def', 'try', 'except', 'yield', 'typing'],
    securityRequirements: ['input sanitization', 'safe imports', 'resource limits'],
    qualityRequirements: ['type hints', 'docstrings', 'error handling']
  }
};

// Mock Performance Benchmarks
export const mockPerformanceBenchmarks = {
  codeGeneration: {
    expectedMaxTime: 5000, // 5 seconds
    acceptableTime: 3000,   // 3 seconds
    excellentTime: 1000     // 1 second
  },
  astParsing: {
    expectedMaxTime: 200,   // 200ms
    acceptableTime: 100,    // 100ms
    excellentTime: 50       // 50ms
  },
  securityScan: {
    expectedMaxTime: 1000,  // 1 second
    acceptableTime: 500,    // 500ms
    excellentTime: 200      // 200ms
  },
  qualityAssessment: {
    expectedMaxTime: 800,   // 800ms
    acceptableTime: 400,    // 400ms
    excellentTime: 150      // 150ms
  }
};

// Mock Configuration for Tests
export const mockTestConfig = {
  database: {
    url: 'postgresql://test:test@localhost:5432/test_autonomous_code',
    maxConnections: 5,
    timeout: 5000
  },
  redis: {
    url: 'redis://localhost:6379/1',
    timeout: 1000
  },
  services: {
    mockMode: true,
    timeout: 10000,
    retries: 2
  },
  security: {
    enableRealScanning: false,
    mockVulnerabilities: true,
    testApiKeys: true
  },
  quality: {
    enableRealAssessment: false,
    mockMetrics: true,
    strictMode: false
  }
};

// Export utility functions for test data generation
export const generateMockUser = (overrides: Partial<any> = {}) => ({
  id: `user-${Math.random().toString(36).substring(7)}`,
  username: `testuser-${Date.now()}`,
  email: `test-${Date.now()}@example.com`,
  createdAt: new Date().toISOString(),
  ...overrides
});

export const generateMockGenerationRequest = (overrides: Partial<any> = {}) => ({
  prompt: 'Generate a test function',
  language: 'typescript',
  generationType: 'completion' as const,
  userId: generateMockUser().id,
  sessionId: `session-${Date.now()}`,
  enableSecurityValidation: true,
  enableQualityValidation: true,
  enablePerformanceValidation: true,
  ...overrides
});

export const generateMockVulnerability = (overrides: Partial<any> = {}) => ({
  id: `vuln-${Math.random().toString(36).substring(7)}`,
  type: 'injection',
  severity: 'medium',
  title: 'Test Vulnerability',
  description: 'This is a test vulnerability',
  location: { line: 10, column: 5 },
  cweId: 'CWE-89',
  owasp: 'A03:2021',
  category: 'injection',
  evidence: 'Test evidence',
  fixable: true,
  exploitability: 'medium',
  impact: 'medium',
  confidenceLevel: 0.8,
  ...overrides
});