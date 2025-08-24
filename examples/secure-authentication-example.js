/**
 * SECURITY EXAMPLE: Proper Authentication Pattern
 * 
 * This file demonstrates the CORRECT way to handle API keys and authentication
 * following the patterns established in CLAUDE.md and the project's security guidelines.
 * 
 * ❌ NEVER DO THIS:
 * const API_KEY = 'sk-1234567890abcdef...'; // Hardcoded secret
 * 
 * ✅ ALWAYS DO THIS:
 * Use the SecretsManager service to retrieve keys from Supabase Vault at runtime
 */

// Example of secure API key management for client-side applications
class SecureAuthenticationExample {
    constructor() {
        this.apiKey = null;
        this.authToken = null;
        this.initialized = false;
    }

    /**
     * SECURITY PATTERN: Secure initialization with proper authentication flow
     * This method demonstrates how to securely authenticate users and obtain API keys
     * without exposing sensitive credentials in client-side code.
     */
    async initialize() {
        try {
            // Step 1: Authenticate user through proper OAuth/JWT flow
            const authResult = await this.authenticateUser();
            if (!authResult.success) {
                throw new Error('User authentication failed');
            }

            // Step 2: Request API credentials from secure backend endpoint
            // The backend uses SecretsManager to retrieve keys from Supabase Vault
            const credentials = await this.requestCredentials(authResult.token);
            
            // Step 3: Store temporary credentials securely
            this.apiKey = credentials.apiKey; // Temporary, scoped API key
            this.authToken = authResult.token;
            this.initialized = true;

            console.log('✅ Secure authentication completed');
            return { success: true };

        } catch (error) {
            console.error('❌ Authentication failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * SECURITY PATTERN: Proper user authentication
     * In production, this would integrate with OAuth providers, 
     * enterprise SSO, or other secure authentication methods.
     */
    async authenticateUser() {
        // Example: OAuth flow with your identity provider
        // This is where you'd integrate with:
        // - Google OAuth
        // - Microsoft Azure AD
        // - Auth0
        // - Your organization's SSO
        // - Supabase Auth with proper PKCE flow
        
        return new Promise((resolve) => {
            // Simulated authentication - replace with real implementation
            setTimeout(() => {
                resolve({
                    success: true,
                    token: 'jwt_token_from_secure_auth_flow',
                    user: { id: 'user123', email: 'user@example.com' }
                });
            }, 1000);
        });
    }

    /**
     * SECURITY PATTERN: Backend API key retrieval
     * This method calls a secure backend endpoint that:
     * 1. Validates the user's JWT token
     * 2. Uses SecretsManager to retrieve API keys from Supabase Vault
     * 3. Returns temporary, scoped credentials
     */
    async requestCredentials(userToken) {
        const response = await fetch('/api/v1/auth/credentials', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scope: ['widget_creation', 'dashboard_access'], // Request specific permissions
                expires_in: 3600 // Request 1-hour expiry
            })
        });

        if (!response.ok) {
            throw new Error(`Credential request failed: ${response.status}`);
        }

        const credentials = await response.json();
        
        // The backend response contains temporary, scoped API keys
        // These keys are retrieved from Supabase Vault by the backend service
        return {
            apiKey: credentials.api_key, // Temporary API key from Vault
            expiresAt: credentials.expires_at,
            scope: credentials.scope
        };
    }

    /**
     * SECURITY PATTERN: Secure API calls with proper error handling
     */
    async makeSecureAPICall(endpoint, data) {
        if (!this.initialized) {
            throw new Error('Authentication required. Please call initialize() first.');
        }

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`, // Use proper Bearer token
                    'Content-Type': 'application/json',
                    'X-Request-ID': this.generateRequestId() // Add request tracking
                },
                body: JSON.stringify(data)
            });

            if (response.status === 401) {
                // Token expired - need to re-authenticate
                console.warn('Token expired, re-authenticating...');
                await this.initialize();
                // Retry the request once with new token
                return this.makeSecureAPICall(endpoint, data);
            }

            if (!response.ok) {
                throw new Error(`API call failed: ${response.status} ${response.statusText}`);
            }

            return await response.json();

        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    /**
     * SECURITY PATTERN: Token rotation and cleanup
     */
    async cleanup() {
        // Clear sensitive data from memory
        this.apiKey = null;
        this.authToken = null;
        this.initialized = false;
        
        // Clear any stored tokens
        localStorage.removeItem('temp_session');
        sessionStorage.clear();
        
        console.log('🧹 Security cleanup completed');
    }

    /**
     * Utility: Generate unique request IDs for tracking and security
     */
    generateRequestId() {
        return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

/**
 * SECURITY EXAMPLE: Backend Implementation Pattern
 * 
 * This is how the backend endpoint (/api/v1/auth/credentials) should be implemented
 * to securely retrieve API keys from Supabase Vault:
 */
const backendExample = `
// Backend: /api/v1/auth/credentials endpoint
import { SecretsManager } from '../services/secrets-manager';

export async function handleCredentialsRequest(req, res) {
    try {
        // 1. Validate JWT token
        const userToken = req.headers.authorization?.replace('Bearer ', '');
        const user = await validateJWTToken(userToken);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        // 2. Get secrets manager instance
        const secretsManager = SecretsManager.getInstance();
        
        // 3. Retrieve API keys from Supabase Vault (NOT environment variables!)
        const credentials = await secretsManager.getServiceCredentials([
            'openai_api_key',
            'anthropic_api_key',
            'widget_service_key'
        ]);
        
        // 4. Create temporary, scoped token
        const temporaryApiKey = await createScopedToken({
            user: user.id,
            scope: req.body.scope,
            expires_in: req.body.expires_in || 3600,
            underlying_credentials: credentials
        });
        
        // 5. Return temporary credentials
        res.json({
            api_key: temporaryApiKey,
            expires_at: new Date(Date.now() + (req.body.expires_in * 1000)),
            scope: req.body.scope
        });
        
    } catch (error) {
        console.error('Credentials request failed:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
`;

// Example usage
async function demonstrateSecurePattern() {
    console.log('🔒 Demonstrating secure authentication pattern...');
    
    const authExample = new SecureAuthenticationExample();
    
    // Step 1: Initialize with secure authentication
    const authResult = await authExample.initialize();
    
    if (!authResult.success) {
        console.error('❌ Authentication failed:', authResult.error);
        return;
    }
    
    // Step 2: Make secure API calls
    try {
        const result = await authExample.makeSecureAPICall('/api/widgets/create', {
            name: 'Example Widget',
            description: 'Created with secure authentication'
        });
        
        console.log('✅ Secure API call successful:', result);
        
    } catch (error) {
        console.error('❌ API call failed:', error);
    } finally {
        // Step 3: Always clean up
        await authExample.cleanup();
    }
}

/**
 * SECURITY CHECKLIST for client-side applications:
 * 
 * ✅ Never hardcode API keys, tokens, or secrets in client-side code
 * ✅ Use proper OAuth/JWT authentication flows  
 * ✅ Request temporary, scoped credentials from secure backend endpoints
 * ✅ Implement token rotation and expiry handling
 * ✅ Clear sensitive data from memory when done
 * ✅ Use HTTPS for all API communications
 * ✅ Implement proper error handling for authentication failures
 * ✅ Log security events for monitoring
 * ✅ Follow the principle of least privilege for API scopes
 * ✅ Use Supabase Vault for server-side secret management
 * 
 * ❌ Never store long-lived API keys in localStorage or sessionStorage
 * ❌ Never commit secrets to version control
 * ❌ Never use hardcoded credentials in production
 * ❌ Never trust client-side security alone
 */

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecureAuthenticationExample, demonstrateSecurePattern };
}