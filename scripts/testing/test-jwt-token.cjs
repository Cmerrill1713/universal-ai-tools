#!/usr/bin/env node

// JWT Token Generator for Testing Authentication
// Usage: node test-jwt-token.cjs

const crypto = require('crypto');

// Simple JWT implementation for testing
function base64URLEscape(str) {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64URLEncode(str) {
    return base64URLEscape(Buffer.from(str).toString('base64'));
}

function createJWT(payload, secret) {
    const header = {
        "alg": "HS256",
        "typ": "JWT"
    };

    const encodedHeader = base64URLEncode(JSON.stringify(header));
    const encodedPayload = base64URLEncode(JSON.stringify(payload));
    
    const data = encodedHeader + "." + encodedPayload;
    const signature = crypto.createHmac('sha256', secret).update(data).digest('base64');
    const encodedSignature = base64URLEscape(signature);
    
    return data + "." + encodedSignature;
}

// Configuration from environment
const JWT_SECRET = process.env.JWT_SECRET || 'local-only-secret-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'universal-ai-tools';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'universal-ai-tools-api';

// Create test JWT tokens
const now = Math.floor(Date.now() / 1000);
const exp = now + (24 * 60 * 60); // 24 hours from now

// Standard user token
const userClaims = {
    userId: "test-user-001",
    email: "test@universal-ai-tools.local",
    isAdmin: false,
    permissions: ["api_access", "chat", "agents"],
    deviceId: "test-device-001",
    deviceType: "desktop",
    trusted: true,
    isDemoToken: true,
    iat: now,
    exp: exp,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: "test-user-001",
    jti: "test-token-" + Math.random().toString(36).substring(7)
};

// Admin user token
const adminClaims = {
    userId: "admin-user-001",
    email: "admin@universal-ai-tools.local",
    isAdmin: true,
    permissions: ["api_access", "chat", "agents", "admin", "broadcast"],
    deviceId: "admin-device-001",
    deviceType: "desktop",
    trusted: true,
    isDemoToken: true,
    iat: now,
    exp: exp,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: "admin-user-001",
    jti: "admin-token-" + Math.random().toString(36).substring(7)
};

// Generate tokens
const userToken = createJWT(userClaims, JWT_SECRET);
const adminToken = createJWT(adminClaims, JWT_SECRET);

console.log('🔑 JWT Authentication Test Tokens Generated\n');
console.log('📋 Configuration:');
console.log(`   JWT_SECRET: ${JWT_SECRET.substring(0, 10)}...`);
console.log(`   JWT_ISSUER: ${JWT_ISSUER}`);
console.log(`   JWT_AUDIENCE: ${JWT_AUDIENCE}\n`);

console.log('👤 Standard User Token:');
console.log(`   User ID: ${userClaims.userId}`);
console.log(`   Email: ${userClaims.email}`);
console.log(`   Admin: ${userClaims.isAdmin}`);
console.log(`   Permissions: ${userClaims.permissions.join(', ')}`);
console.log(`   Token: ${userToken}\n`);

console.log('👑 Admin User Token:');
console.log(`   User ID: ${adminClaims.userId}`);
console.log(`   Email: ${adminClaims.email}`);
console.log(`   Admin: ${adminClaims.isAdmin}`);
console.log(`   Permissions: ${adminClaims.permissions.join(', ')}`);
console.log(`   Token: ${adminToken}\n`);

console.log('🧪 Test Commands:');
console.log('\n# Test Go WebSocket with user token:');
console.log(`curl -H "Authorization: Bearer ${userToken}" http://localhost:8080/status`);

console.log('\n# Test Rust LLM Router with user token:');
console.log(`curl -H "Authorization: Bearer ${userToken}" -H "Content-Type: application/json" -d '{"model":"test","prompt":"Hello, this is a test","max_tokens":50}' http://localhost:8003/v1/completions`);

console.log('\n# Test TypeScript server with user token:');
console.log(`curl -H "Authorization: Bearer ${userToken}" -H "Content-Type: application/json" -d '{"message":"Hello, test authentication"}' http://localhost:9999/api/chat`);

// Export tokens for shell use
console.log('\n📤 Environment Variables:');
console.log(`export USER_TOKEN="${userToken}"`);
console.log(`export ADMIN_TOKEN="${adminToken}"`);