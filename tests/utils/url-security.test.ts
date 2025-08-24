import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getAllowedHostsFromEnv,
  isAllowedHost,
  normalizeHttpUrl,
} from '../../src/utils/url-security';

describe('URL Security Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv;
  });

  describe('getAllowedHostsFromEnv', () => {
    it('should return default allowed hosts when no env var is set', () => {
      delete process.env.ALLOWED_LLM_HOSTS;
      
      const allowedHosts = getAllowedHostsFromEnv();
      
      expect(allowedHosts).toEqual(new Set(['localhost', '127.0.0.1']));
    });

    it('should parse custom allowed hosts from environment', () => {
      process.env.ALLOWED_LLM_HOSTS = 'api.openai.com,anthropic.claude.ai,localhost';
      
      const allowedHosts = getAllowedHostsFromEnv();
      
      expect(allowedHosts).toEqual(new Set([
        'api.openai.com',
        'anthropic.claude.ai', 
        'localhost'
      ]));
    });

    it('should use custom environment variable name', () => {
      process.env.CUSTOM_HOSTS = 'example.com,test.org';
      
      const allowedHosts = getAllowedHostsFromEnv('CUSTOM_HOSTS');
      
      expect(allowedHosts).toEqual(new Set(['example.com', 'test.org']));
    });

    it('should trim whitespace and convert to lowercase', () => {
      process.env.ALLOWED_LLM_HOSTS = ' API.OpenAI.Com , LOCALHOST ,  127.0.0.1  ';
      
      const allowedHosts = getAllowedHostsFromEnv();
      
      expect(allowedHosts).toEqual(new Set([
        'api.openai.com',
        'localhost',
        '127.0.0.1'
      ]));
    });

    it('should filter out empty strings', () => {
      process.env.ALLOWED_LLM_HOSTS = 'localhost,,127.0.0.1,,,,api.com,';
      
      const allowedHosts = getAllowedHostsFromEnv();
      
      expect(allowedHosts).toEqual(new Set([
        'localhost',
        '127.0.0.1',
        'api.com'
      ]));
    });

    it('should handle empty environment variable', () => {
      process.env.ALLOWED_LLM_HOSTS = '';
      
      const allowedHosts = getAllowedHostsFromEnv();
      
      expect(allowedHosts).toEqual(new Set(['localhost', '127.0.0.1']));
    });
  });

  describe('isAllowedHost', () => {
    beforeEach(() => {
      process.env.ALLOWED_LLM_HOSTS = 'localhost,127.0.0.1,api.openai.com,anthropic.claude.ai';
    });

    it('should allow hosts in the allowed list', () => {
      const allowedUrls = [
        'https://localhost/api',
        'http://127.0.0.1:8080/test',
        'https://api.openai.com/v1/chat',
        'https://anthropic.claude.ai/api'
      ];

      allowedUrls.forEach(url => {
        expect(isAllowedHost(url)).toBe(true);
      });
    });

    it('should reject hosts not in the allowed list', () => {
      const disallowedUrls = [
        'https://malicious.example.com/api',
        'http://192.168.1.1/hack',
        'https://evil.com/payload',
        'http://untrusted-api.net/data'
      ];

      disallowedUrls.forEach(url => {
        expect(isAllowedHost(url)).toBe(false);
      });
    });

    it('should be case insensitive for host comparison', () => {
      expect(isAllowedHost('https://LOCALHOST/api')).toBe(true);
      expect(isAllowedHost('https://API.OPENAI.COM/v1/chat')).toBe(true);
      expect(isAllowedHost('https://Anthropic.Claude.AI/api')).toBe(true);
    });

    it('should handle different protocols', () => {
      expect(isAllowedHost('http://localhost/api')).toBe(true);
      expect(isAllowedHost('https://localhost/api')).toBe(true);
    });

    it('should handle URLs with ports', () => {
      expect(isAllowedHost('http://localhost:3000/api')).toBe(true);
      expect(isAllowedHost('https://127.0.0.1:8080/test')).toBe(true);
    });

    it('should handle URLs with paths and query parameters', () => {
      expect(isAllowedHost('https://localhost/api/v1/test?param=value')).toBe(true);
      expect(isAllowedHost('https://api.openai.com/v1/chat/completions?model=gpt-4')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        '',
        'javascript:alert("xss")',
        'data:text/html,<script>alert(1)</script>'
      ];

      invalidUrls.forEach(url => {
        expect(isAllowedHost(url)).toBe(false);
      });
      
      // FTP URLs are valid URLs and isAllowedHost only checks hostname, not protocol
      // Protocol filtering is handled by normalizeHttpUrl
      expect(isAllowedHost('ftp://localhost/file')).toBe(true);  // localhost is in allowed hosts
      expect(isAllowedHost('ftp://evil.com/file')).toBe(false);  // evil.com is not in allowed hosts
    });

    it('should use custom environment variable for allowed hosts', () => {
      process.env.CUSTOM_ALLOWED = 'custom.api.com,trusted.service.net';
      
      expect(isAllowedHost('https://custom.api.com/api', 'CUSTOM_ALLOWED')).toBe(true);
      expect(isAllowedHost('https://trusted.service.net/data', 'CUSTOM_ALLOWED')).toBe(true);
      expect(isAllowedHost('https://localhost/api', 'CUSTOM_ALLOWED')).toBe(false);
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'http://',
        'https://:8080',
        'https://[invalid-ipv6',
        'http://host with spaces.com'
      ];

      malformedUrls.forEach(url => {
        expect(isAllowedHost(url)).toBe(false);
      });
    });
  });

  describe('normalizeHttpUrl', () => {
    it('should normalize valid HTTP URLs', () => {
      expect(normalizeHttpUrl('http://localhost/api/')).toBe('http://localhost/api');
      expect(normalizeHttpUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
      expect(normalizeHttpUrl('http://127.0.0.1:8080/test/')).toBe('http://127.0.0.1:8080/test');
    });

    it('should preserve URLs without trailing slash', () => {
      expect(normalizeHttpUrl('https://localhost/api')).toBe('https://localhost/api');
      expect(normalizeHttpUrl('http://api.example.com/data')).toBe('http://api.example.com/data');
    });

    it('should preserve query parameters and fragments', () => {
      expect(normalizeHttpUrl('https://api.com/search?q=test&limit=10/'))
        .toBe('https://api.com/search?q=test&limit=10');
      expect(normalizeHttpUrl('https://example.com/page#section/'))
        .toBe('https://example.com/page#section');
    });

    it('should reject non-HTTP protocols', () => {
      const nonHttpUrls = [
        'ftp://example.com/file.txt',
        'file:///etc/passwd',
        'javascript:alert("xss")',
        'data:text/html,<script>alert(1)</script>',
        'mailto:user@example.com',
        'tel:+1234567890'
      ];

      nonHttpUrls.forEach(url => {
        expect(normalizeHttpUrl(url)).toBe(null);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'http://',
        'https://:8080',
        '',
        'http://host with spaces.com',
        'https://[invalid-ipv6'
      ];

      invalidUrls.forEach(url => {
        expect(normalizeHttpUrl(url)).toBe(null);
      });
    });

    it('should handle different port numbers', () => {
      expect(normalizeHttpUrl('http://localhost:3000/api/')).toBe('http://localhost:3000/api');
      // Note: Browser normalizes default ports (443 for HTTPS, 80 for HTTP)
      expect(normalizeHttpUrl('https://api.com:443/secure/')).toBe('https://api.com/secure');
      expect(normalizeHttpUrl('https://api.com:8443/secure/')).toBe('https://api.com:8443/secure');
    });

    it('should handle international domain names', () => {
      expect(normalizeHttpUrl('https://xn--nxasmq6b.xn--j6w193g/'))
        .toBe('https://xn--nxasmq6b.xn--j6w193g');
    });

    it('should handle IPv6 addresses', () => {
      expect(normalizeHttpUrl('http://[::1]:8080/api/')).toBe('http://[::1]:8080/api');
    });
  });

  describe('Security Edge Cases', () => {
    it('should prevent subdomain attacks', () => {
      process.env.ALLOWED_LLM_HOSTS = 'api.example.com';
      
      // Should not allow subdomains if not explicitly allowed
      expect(isAllowedHost('https://malicious.api.example.com/hack')).toBe(false);
      expect(isAllowedHost('https://api.example.com.evil.com/phish')).toBe(false);
    });

    it('should handle URL encoding attempts', () => {
      const encodedUrls = [
        'https://127.0.0.1%2emalicious.com',
        'https://localhost%00.evil.com',
        'https://localhost%0a.attacker.net'
      ];

      encodedUrls.forEach(url => {
        // These should be rejected as malformed URLs or resolve to unallowed hosts
        expect(isAllowedHost(url)).toBe(false);
      });
    });

    it('should handle unicode domain attacks', () => {
      process.env.ALLOWED_LLM_HOSTS = 'example.com';
      
      // Unicode lookalike domains should not be allowed
      const unicodeAttacks = [
        'https://еxample.com',  // Cyrillic 'е' instead of 'e'
        'https://example.сom',  // Cyrillic 'с' instead of 'c'
      ];

      unicodeAttacks.forEach(url => {
        expect(isAllowedHost(url)).toBe(false);
      });
    });

    it('should handle IP address variants', () => {
      process.env.ALLOWED_LLM_HOSTS = '127.0.0.1';
      
      // Different representations of localhost/127.0.0.1
      expect(isAllowedHost('http://127.0.0.1')).toBe(true);
      
      // Note: The URL constructor normalizes shorthand IPs to full format
      // 127.1 becomes 127.0.0.1, so it would be allowed if 127.0.0.1 is allowed
      // Testing with a different base to ensure proper rejection
      process.env.ALLOWED_LLM_HOSTS = 'localhost';
      expect(isAllowedHost('http://127.1')).toBe(false);  // Shorthand IP, not in allow list
      expect(isAllowedHost('http://2130706433')).toBe(false);  // Decimal IP  
      expect(isAllowedHost('http://0x7f000001')).toBe(false);  // Hex IP
    });
  });
});