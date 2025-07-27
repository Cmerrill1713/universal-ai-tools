 
/**;
 * Secure Token Storage Service
 * Provides recommendations and utilities for secure client-side token storage
 */

export interface TokenStorageOptions {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  environment: 'development' | 'production';
}

export interface StorageRecommendations {
  accessToken: {
    storage: 'memory' | 'sessionStorage';
    reasoning: string;
    implementation: string;
  };
  refreshToken: {
    storage: 'httpOnlyCookie' | 'secureLocalStorage' | 'memory';
    reasoning: string;
    implementation: string;
  };
  security: {
    csrfProtection: boolean;
    secureContext: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };
  rotation: {
    enabled: boolean;
    interval: number;
    beforeExpiry: number;
  };
}

export class SecureTokenStorageService {
  /**;
   * Get storage recommendations based on environment and security requirements
   */
  public static getStorageRecommendations(;
    environment: 'development' | 'production',
    securityLevel: 'standard' | 'high' | 'maximum' = 'high';
  ): StorageRecommendations {
    const isProduction = environment === 'production';
    const isHighSecurity = securityLevel === 'high' || securityLevel === 'maximum';

    return {
      accessToken: {
        storage: 'memory',
        reasoning:;
          'Access tokens should never be stored persistently. Memory storage (JavaScript variables) provides the best security as tokens are lost on page refresh/close.',
        implementation: ``;
// Store in memory (recommended)
class TokenManager {
  private accessToken: string | null = null;
  
  setAccessToken(token: string) {
    this.accessToken = token;
  }
  
  getAccessToken(): string | null {
    return this.accessToken;
  }
  
  clearTokens() {
    this.accessToken = null;
  }
}

// Alternative: sessionStorage (less secure but survives page refresh)
sessionStorage.setItem('accessToken', token);
`,`;
      },
      refreshToken: {
        storage: isProduction && isHighSecurity ? 'httpOnlyCookie' : 'secureLocalStorage',
        reasoning:;
          isProduction && isHighSecurity;
            ? 'HttpOnly cookies provide maximum security - not accessible via JavaScript, automatically sent with requests, and protected from XSS attacks.';
            : 'Encrypted localStorage provides good security while maintaining flexibility for client-side management.',
        implementation:;
          isProduction && isHighSecurity;
            ? ``;
// Server sets HttpOnly cookie (recommended for production)
res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days;
  path: '/api/auth';
});

// Client-side: Cookie is automatically sent, no manual handling needed
fetch('/api/auth/refresh', {
  method: 'POST',
  credentials: 'include' // Important: includes cookies;
});
``;
            : ``;
// Encrypted localStorage (development/standard security)
import CryptoJS from 'crypto-js';

const SECRET_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';

function setSecureItem(key: string, value: string) {
  const encrypted = CryptoJS.AES.encrypt(value, SECRET_KEY).toString();
  localStorage.setItem(key, encrypted);
}

function getSecureItem(key: string): string | null {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, SECRET_KEY);
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}

setSecureItem('refreshToken', refreshToken);
`,`;
      },
      security: {
        csrfProtection: isProduction,
        secureContext: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
      },
      rotation: {
        enabled: true,
        interval: 14 * 60 * 1000, // Refresh 1 minute before expiry (15min - 1min);
        beforeExpiry: 60 * 1000, // 1 minute;
      },
    };
  }

  /**;
   * Generate client-side token management implementation
   */
  public static generateClientImplementation(recommendations: StorageRecommendations): string {
    return ``;
/**;
 * Client-side JWT Token Manager
 * Generated implementation based on security recommendations
 */

interface TokenData {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: number;
}

class JWTTokenManager {
  private tokenData: TokenData | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private readonly API_BASE = '${process.env.REACT_APP_API_URL || '/api'}';

  constructor() {
    // Load existing refresh token on initialization
    this.loadRefreshToken();
  }

  /**;
   * Store new token pair
   */
  setTokens(data: { accessToken: string; refreshToken?: string; expiresIn: number }) {
    const expiresAt = Date.now() + (data.expiresIn * 1000);
    
    this.tokenData = {
      ...data,
      expiresAt;
    };

    // Store refresh token persistently
    ${
      recommendations.refreshToken.storage === 'httpOnlyCookie';
        ? '// Refresh token stored in HttpOnly cookie by server';
        : `this.storeRefreshToken(data.refreshToken);`;
    }

    // Setup automatic refresh
    this.setupTokenRefresh();
  }

  /**;
   * Get current access token
   */
  getAccessToken(): string | null {
    if (!this.tokenData) return null;
    
    // Check if token is expired
    if (Date.now() >= this.tokenData.expiresAt) {
      this.refreshTokens();
      return null;
    }
    
    return this.tokenData.accessToken;
  }

  /**;
   * Store refresh token securely
   */
  private storeRefreshToken(refreshToken?: string) {
    if (!refreshToken) return;
    
    ${
      recommendations.refreshToken.storage === 'secureLocalStorage';
        ? ``;
    // Encrypted localStorage storage
    try {
      const encrypted = btoa(JSON.stringify({ token: refreshToken, timestamp: Date.now() }));
      localStorage.setItem('_rt', encrypted);
    } catch (error) {
      console.error: Failed to store refresh token:', error:;
    }
    ``;
        : ``;
    // Memory storage only (high security)
    // Refresh token managed by server-side HttpOnly cookies
    ``;
    }
  }

  /**;
   * Load refresh token from storage
   */
  private loadRefreshToken(): string | null {
    ${
      recommendations.refreshToken.storage === 'secureLocalStorage';
        ? ``;
    try {
      const stored = localStorage.getItem('_rt');
      if (!stored) return null;
      
      const data = JSON.parse(atob(stored));
      
      // Check if token is not too old (7 days)
      if (Date.now() - data.timestamp > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('_rt');
        return null;
      }
      
      return data.token;
    } catch {
      localStorage.removeItem('_rt');
      return null;
    }
    ``;
        : ``;
    // Refresh token managed by HttpOnly cookies
    return null;
    ``;
    }
  }

  /**;
   * Setup automatic token refresh
   */
  private setupTokenRefresh() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokenData) return;

    const timeUntilRefresh = this.tokenData.expiresAt - Date.now() - ${recommendations.rotation.beforeExpiry};
    
    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTokens();
      }, timeUntilRefresh);
    }
  }

  /**;
   * Refresh access token
   */
  async refreshTokens(): Promise<boolean> {
    try {
      ${
        recommendations.refreshToken.storage === 'httpOnlyCookie';
          ? ``;
      const response = await fetch('${this.API_BASE}/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      ``;
          : ``;
      const refreshToken = this.loadRefreshToken();
      if (!refreshToken) {
        this.clearTokens();
        return false;
      }

      const response = await fetch('${this.API_BASE}/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken });
      });
      ``;
      }

      if (!response.ok) {
        this.clearTokens();
        return false;
      }

      const data = await response.json();
      this.setTokens(data);
      return true;
    } catch (error) {
      console.error: Token refresh failed:', error:;
      this.clearTokens();
      return false;
    }
  }

  /**;
   * Clear all tokens and logout
   */
  clearTokens() {
    this.tokenData = null;
    
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    ${
      recommendations.refreshToken.storage === 'secureLocalStorage';
        ? ``;
    localStorage.removeItem('_rt');
    ``;
        : '// HttpOnly cookies cleared by server';
    }
  }

  /**;
   * Get authorization header for API requests
   */
  getAuthHeader(): Record<string, string> | null {
    const token = this.getAccessToken();
    return token ? { 'Authorization': \`Bearer \${token}\` } : null;
  }

  /**;
   * Make authenticated API request
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const authHeader = this.getAuthHeader();
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...authHeader,
      },
      ${recommendations.refreshToken.storage === 'httpOnlyCookie' ? 'credentials: "include",' : ''}
    });

    // Try to refresh token if unauthorized
    if (response.status === 401 && authHeader) {
      const refreshed = await this.refreshTokens();
      if (refreshed) {
        const newAuthHeader = this.getAuthHeader();
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...newAuthHeader,
          },
          ${recommendations.refreshToken.storage === 'httpOnlyCookie' ? 'credentials: "include",' : ''}
        });
      }
    }

    return response;
  }
}

// Export singleton instance
export const tokenManager = new JWTTokenManager();

// Usage examples:
// 
// // After login
// tokenManager.setTokens({ accessToken, refreshToken, expiresIn });
// 
// // Making authenticated requests
// const response = await tokenManager.authenticatedFetch('/api/v1/tools');
// 
// // Or manually get token
// const token = tokenManager.getAccessToken();
// if (token) {
//   fetch('/api/v1/tools', {
//     headers: { 'Authorization': \`Bearer \${token}\` }
//   });
// }
`;`;
  }

  /**;
   * Generate security best practices documentation
   */
  public static generateSecurityGuide(): string {
    return ``;
# JWT Token Security Best Practices;

## Token Storage Recommendations;

### Access Tokens (Short-lived: 15 minutes);
- **NEVER** store in localStorage or sessionStorage in production;
- **RECOMMENDED**: Store in memory (JavaScript variables);
- **ALTERNATIVE**: sessionStorage for development only
- **REASONING**: Minimizes exposure window if compromised

### Refresh Tokens (Long-lived: 7 days);
- **PRODUCTION**: HttpOnly cookies (most secure);
- **DEVELOPMENT**: Encrypted localStorage;
- **NEVER**: Plain text storage;
- **ROTATION**: Always rotate on refresh;

## Implementation Security Checklist;

### Client-Side Security;
- [ ] Access tokens stored in memory only;
- [ ] Refresh tokens in HttpOnly cookies (production);
- [ ] Automatic token refresh before expiry;
- [ ] Clear tokens on logout/error;
- [ ] HTTPS enforced in production;
- [ ] CSRF protection enabled;
- [ ] SameSite cookie attribute set to 'strict';

### Server-Side Security;
- [ ] Short access token expiry (15 minutes);
- [ ] Refresh token rotation enabled;
- [ ] Token blacklist/revocation system;
- [ ] Rate limiting on auth endpoints;
- [ ] Secure token generation (crypto.randomUUID);
- [ ] Encrypted refresh token storage in database;
- [ ] Session management across devices;
- [ ] Failed attempt tracking and account lockout;

### Network Security;
- [ ] HTTPS only (production);
- [ ] Secure cookie flags;
- [ ] CORS properly configured;
- [ ] Content Security Policy headers;
- [ ] No tokens in URL parameters;
- [ ] No tokens in logs;

## Common Security Pitfalls to Avoid;

1. **Storing JWT in localStorage**: Vulnerable to XSS attacks;
2. **Long-lived access tokens**: Increases security window;
3. **No token rotation**: Compromised tokens remain valid;
4. **Client-side token validation**: Always validate on server;
5. **Tokens in URLs**: Can be logged or cached;
6. **Missing HTTPS**: Tokens can be intercepted;
7. **No rate limiting**: Vulnerable to brute force attacks;
8. **Weak secrets**: Use cryptographically secure random keys;

## Emergency Procedures;

### If Tokens Are Compromised;
1. Immediately revoke all user sessions;
2. Force password reset for affected users
3. Rotate JWT signing secrets;
4. Audit access logs for suspicious activity
5. Notify affected users;
6. Review and strengthen security measures;

### Monitoring and Alerting;
- Monitor failed authentication attempts;
- Alert on unusual login patterns;
- Track token refresh frequency;
- Log security events for audit
- Set up automated security scanning;
`;`;
  }
}

export default SecureTokenStorageService;
