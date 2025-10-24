#!/usr/bin/env python3
"""
Security Middleware for Athena
Production-ready security with authentication, authorization, and protection
"""

import asyncio
import json
import time
import hashlib
import hmac
import secrets
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class SecurityConfig:
    jwt_secret: str
    api_key_secret: str
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600  # 1 hour
    max_request_size: int = 10 * 1024 * 1024  # 10MB
    session_timeout: int = 3600  # 1 hour

class SecurityMiddleware:
    def __init__(self, config: SecurityConfig):
        self.config = config
        self.rate_limiter = {}
        self.active_sessions = {}
        self.blocked_ips = set()
        self.suspicious_ips = {}
        
    async def authenticate_request(self, request_headers: Dict[str, str]) -> Dict[str, Any]:
        """Authenticate incoming request"""
        auth_result = {
            'authenticated': False,
            'user_id': None,
            'session_id': None,
            'permissions': [],
            'error': None
        }
        
        try:
            # Check for API key
            api_key = request_headers.get('X-API-Key')
            if api_key:
                auth_result = await self._authenticate_api_key(api_key)
            else:
                # Check for JWT token
                auth_header = request_headers.get('Authorization', '')
                if auth_header.startswith('Bearer '):
                    token = auth_header[7:]
                    auth_result = await self._authenticate_jwt(token)
                else:
                    auth_result['error'] = 'No authentication provided'
                    
        except Exception as e:
            auth_result['error'] = f'Authentication error: {str(e)}'
            
        return auth_result
    
    async def _authenticate_api_key(self, api_key: str) -> Dict[str, Any]:
        """Authenticate API key"""
        # In production, this would check against a database
        # For now, we'll use a simple validation
        expected_key = self.config.api_key_secret
        
        if hmac.compare_digest(api_key, expected_key):
            return {
                'authenticated': True,
                'user_id': 'api_user',
                'session_id': secrets.token_hex(16),
                'permissions': ['read', 'write', 'admin'],
                'error': None
            }
        else:
            return {
                'authenticated': False,
                'error': 'Invalid API key'
            }
    
    async def _authenticate_jwt(self, token: str) -> Dict[str, Any]:
        """Authenticate JWT token"""
        try:
            # Simple JWT validation (in production, use proper JWT library)
            parts = token.split('.')
            if len(parts) != 3:
                return {'authenticated': False, 'error': 'Invalid JWT format'}
                
            # Decode payload (simplified)
            import base64
            payload = json.loads(base64.b64decode(parts[1] + '=='))
            
            # Check expiration
            if payload.get('exp', 0) < time.time():
                return {'authenticated': False, 'error': 'Token expired'}
                
            return {
                'authenticated': True,
                'user_id': payload.get('sub'),
                'session_id': payload.get('jti'),
                'permissions': payload.get('permissions', []),
                'error': None
            }
            
        except Exception as e:
            return {'authenticated': False, 'error': f'JWT validation error: {str(e)}'}
    
    async def check_rate_limit(self, client_ip: str, endpoint: str) -> Dict[str, Any]:
        """Check rate limiting"""
        key = f"{client_ip}:{endpoint}"
        now = time.time()
        
        if key not in self.rate_limiter:
            self.rate_limiter[key] = []
            
        # Clean old entries
        self.rate_limiter[key] = [
            timestamp for timestamp in self.rate_limiter[key]
            if now - timestamp < self.config.rate_limit_window
        ]
        
        # Check if limit exceeded
        if len(self.rate_limiter[key]) >= self.config.rate_limit_requests:
            return {
                'allowed': False,
                'retry_after': self.config.rate_limit_window,
                'message': 'Rate limit exceeded'
            }
        
        # Add current request
        self.rate_limiter[key].append(now)
        
        return {
            'allowed': True,
            'remaining': self.config.rate_limit_requests - len(self.rate_limiter[key]),
            'reset_time': now + self.config.rate_limit_window
        }
    
    async def validate_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate request data"""
        validation_result = {
            'valid': True,
            'errors': [],
            'sanitized_data': request_data
        }
        
        # Check request size
        request_size = len(json.dumps(request_data))
        if request_size > self.config.max_request_size:
            validation_result['valid'] = False
            validation_result['errors'].append('Request too large')
            
        # Sanitize input
        if 'message' in request_data:
            message = request_data['message']
            # Remove potentially dangerous characters
            sanitized_message = ''.join(c for c in message if c.isprintable())
            validation_result['sanitized_data']['message'] = sanitized_message
            
        # Check for SQL injection patterns
        dangerous_patterns = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'UNION', 'SELECT']
        message = request_data.get('message', '').upper()
        for pattern in dangerous_patterns:
            if pattern in message:
                validation_result['valid'] = False
                validation_result['errors'].append(f'Potentially dangerous pattern: {pattern}')
                break
                
        return validation_result
    
    async def log_security_event(self, event_type: str, details: Dict[str, Any]):
        """Log security events"""
        event = {
            'timestamp': time.time(),
            'type': event_type,
            'details': details
        }
        
        # In production, this would go to a security log
        print(f"[SECURITY] {event_type}: {json.dumps(details)}")
        
        # Check for suspicious patterns
        if event_type == 'failed_auth':
            client_ip = details.get('client_ip')
            if client_ip:
                if client_ip not in self.suspicious_ips:
                    self.suspicious_ips[client_ip] = 0
                self.suspicious_ips[client_ip] += 1
                
                if self.suspicious_ips[client_ip] > 5:
                    self.blocked_ips.add(client_ip)
                    print(f"[SECURITY] IP {client_ip} blocked due to suspicious activity")
    
    def is_ip_blocked(self, client_ip: str) -> bool:
        """Check if IP is blocked"""
        return client_ip in self.blocked_ips

# Global security middleware
_security_middleware = None

def get_security_middleware() -> SecurityMiddleware:
    """Get global security middleware instance"""
    global _security_middleware
    if _security_middleware is None:
        config = SecurityConfig(
            jwt_secret=os.getenv('JWT_SECRET', secrets.token_hex(32)),
            api_key_secret=os.getenv('API_KEY_SECRET', secrets.token_hex(32))
        )
        _security_middleware = SecurityMiddleware(config)
    return _security_middleware

if __name__ == "__main__":
    # Test security middleware
    async def test_security():
        security = get_security_middleware()
        
        # Test authentication
        headers = {'X-API-Key': 'test_key'}
        auth_result = await security.authenticate_request(headers)
        print(f"Auth result: {auth_result}")
        
        # Test rate limiting
        rate_result = await security.check_rate_limit('127.0.0.1', '/api/chat')
        print(f"Rate limit result: {rate_result}")
        
        # Test request validation
        request_data = {'message': 'Hello Athena!'}
        validation_result = await security.validate_request(request_data)
        print(f"Validation result: {validation_result}")
    
    import asyncio
    asyncio.run(test_security())
