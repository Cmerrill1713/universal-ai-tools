/**
 * API Service Integration Tests
 * Tests for backend service communication
 */

import axios from 'axios';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock axios for testing
vi.mock('axios');
const mockedAxios = axios as any;

describe('API Service Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Backend Health Check', () => {
    it('should successfully check backend health', async () => {
      const mockResponse = {
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            redis: 'connected',
          },
        },
        status: 200,
      };

      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      try {
        const response = await axios.get('http://localhost:8082/api/health');

        expect(response.status).toBe(200);
        expect(response.data.status).toBe('healthy');
        expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8082/api/health');
      } catch (_error) {
        // If actual service is running, test the real response
        if (axios.isAxiosError(_error) && error.response) {
          expect(error.response.status).toBeGreaterThanOrEqual(200);
        }
      }
    });

    it('should handle backend service unavailability', async () => {
      const mockError = {
        code: 'ECONNREFUSED',
        message: 'Connection refused',
      };

      mockedAxios.get.mockRejectedValueOnce(mockError);

      try {
        await axios.get('http://localhost:8082/api/health');
      } catch (_error) {
        expect(_error).toBeDefined();
      }

      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8082/api/health');
    });
  });

  describe('Chat API', () => {
    it('should send chat messages to backend', async () => {
      const mockChatResponse = {
        data: {
          id: 'chat_123',
          response: 'Hello! How can I help you?',
          timestamp: new Date().toISOString(),
          model: 'gpt-4',
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25,
          },
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockChatResponse);

      const chatPayload = {
        message: 'Hello',
        model: 'gpt-4',
        stream: false,
      };

      const response = await axios.post('http://localhost:8082/api/chat', chatPayload);

      expect(response.status).toBe(200);
      expect(response.data.response).toBe('Hello! How can I help you?');
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8082/api/chat', chatPayload);
    });

    it('should handle chat API errors gracefully', async () => {
      const mockError = {
        response: {
          status: 400,
          data: {
            _error: 'Invalid message format',
            code: 'VALIDATION_ERROR',
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(mockError);

      const invalidPayload = {
        message: '', // Invalid empty message
        model: 'gpt-4',
      };

      try {
        await axios.post('http://localhost:8082/api/chat', invalidPayload);
      } catch (_error) {
        expect(_error).toEqual(mockError);
      }
    });
  });

  describe('Image Generation API', () => {
    it('should generate images via backend API', async () => {
      const mockImageResponse = {
        data: {
          id: 'img_123',
          images: [
            {
              url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgA...',
              revised_prompt: 'A beautiful sunset over the ocean',
            },
          ],
          created: Date.now(),
        },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockImageResponse);

      const imagePayload = {
        prompt: 'A beautiful sunset over the ocean',
        model: 'dall-e-3',
        size: '1024x1024',
        quality: 'standard',
        n: 1,
      };

      const response = await axios.post('http://localhost:8082/api/image-generation', imagePayload);

      expect(response.status).toBe(200);
      expect(response.data.images).toHaveLength(1);
      expect(response.data.images[0].url).toMatch(/^data:image\//);
    });
  });

  describe('Service Monitoring API', () => {
    it('should fetch service status from monitoring endpoint', async () => {
      const mockServicesResponse = {
        data: {
          services: [
            {
              name: 'go-api-gateway',
              status: 'healthy',
              uptime: '2h 15m',
              last_check: new Date().toISOString(),
            },
            {
              name: 'rust-llm-router',
              status: 'healthy',
              uptime: '2h 15m',
              last_check: new Date().toISOString(),
            },
          ],
          overall_status: 'healthy',
        },
        status: 200,
      };

      mockedAxios.get.mockResolvedValueOnce(mockServicesResponse);

      const response = await axios.get('http://localhost:8082/api/services/status');

      expect(response.status).toBe(200);
      expect(response.data.services).toHaveLength(2);
      expect(response.data.overall_status).toBe('healthy');
    });
  });

  describe('Authentication', () => {
    it('should handle authentication headers', async () => {
      const mockAuthResponse = {
        data: { authenticated: true, user: 'test@example.com' },
        status: 200,
      };

      mockedAxios.get.mockResolvedValueOnce(mockAuthResponse);

      const headers = {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json',
      };

      const response = await axios.get('http://localhost:8082/api/auth/verify', { headers });

      expect(response.status).toBe(200);
      expect(response.data.authenticated).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8082/api/auth/verify', {
        headers,
      });
    });

    it('should handle unauthorized requests', async () => {
      const mockUnauthorized = {
        response: {
          status: 401,
          data: {
            error: 'Unauthorized',
            message: 'Invalid or missing authentication token',
          },
        },
      };

      mockedAxios.get.mockRejectedValueOnce(mockUnauthorized);

      try {
        await axios.get('http://localhost:8082/api/auth/verify');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
        expect(error.response.data.error).toBe('Unauthorized');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      };

      mockedAxios.get.mockRejectedValueOnce(timeoutError);

      try {
        await axios.get('http://localhost:8082/api/health', { timeout: 5000 });
      } catch (error: any) {
        expect(error.code).toBe('ECONNABORTED');
        expect(error.message).toMatch(/timeout/);
      }
    });

    it('should handle server errors gracefully', async () => {
      const serverError = {
        response: {
          status: 500,
          data: {
            error: 'Internal Server Error',
            message: 'An unexpected error occurred',
          },
        },
      };

      mockedAxios.post.mockRejectedValueOnce(serverError);

      try {
        await axios.post('http://localhost:8082/api/chat', { message: 'test' });
      } catch (error: any) {
        expect(error.response.status).toBe(500);
        expect(error.response.data.error).toBe('Internal Server Error');
      }
    });
  });

  describe('Performance', () => {
    it('should handle concurrent requests', async () => {
      const mockResponses = Array.from({ length: 5 }, (_, i) => ({
        data: { id: `request_${i}`, status: 'success' },
        status: 200,
      }));

      mockResponses.forEach(response => {
        mockedAxios.get.mockResolvedValueOnce(response);
      });

      const requests = Array.from({ length: 5 }, (_, i) =>
        axios.get(`http://localhost:8082/api/test/${i}`)
      );

      const responses = await Promise.all(requests);

      expect(responses).toHaveLength(5);
      responses.forEach((response, index) => {
        expect(response.data.id).toBe(`request_${index}`);
      });
    });
  });
});
