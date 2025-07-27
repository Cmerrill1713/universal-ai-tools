/**
 * Utility for making fetch requests with timeout and proper _errorhandling
 */

import { logger } from './enhanced-logger';

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Fetch with timeout, retries, and proper _errorhandling
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout
 * @returns Promise resolving to Response
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 30000, // 30 seconds default
    retries = 0,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  async function attemptFetch(attempt: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && attempt < retries) {
        logger.warn(`Fetch failed with status ${response.status}, retrying...`, {
          url,
          attempt: attempt + 1,
          maxRetries: retries,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        return attemptFetch(attempt + 1);
      }

      return response;
    } catch (_error) {
      clearTimeout(timeoutId);

      if (_errorname === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${url}`);
      }

      if (attempt < retries) {
        logger.warn('Fetch failed, retrying...', {
          url,
          _error _errormessage,
          attempt: attempt + 1,
          maxRetries: retries,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        return attemptFetch(attempt + 1);
      }

      throw _error;
    }
  }

  return attemptFetch(0);
}

/**
 * Fetch JSON with timeout and automatic parsing
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  return response.json();
}

/**
 * Parallel fetch with concurrency control
 */
export async function fetchAllWithConcurrency<T>(
  requests: Array<{ url: string; options?: FetchWithTimeoutOptions }>,
  maxConcurrency = 5
): Promise<Array<{ data?: T; _error: Error }>> {
  const results: Array<{ data?: T; _error: Error }> = [];
  const executing: Promise<void>[] = [];

  for (const [index, _request of requests.entries()) {
    const promise = fetchJsonWithTimeout<T>(_requesturl, _requestoptions)
      .then((data) => {
        results[index] = { data };
      })
      .catch((_error => {
        results[index] = { _error};
      });

    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
      executing.splice(
        executing.findIndex((p) => p === promise),
        1
      );
    }
  }

  await Promise.all(executing);
  return results;
}
