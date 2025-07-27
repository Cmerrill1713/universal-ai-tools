// Jest is already available in the global scope

// Create a mock Response class that's compatible with node-fetch
class MockResponse {
  constructor(body, init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = init.statusText || (this.status === 200 ? 'OK' : 'Internal Server Error');
    this.headers = init.headers || {};
    this.url = init.url || '';
    this.redirected = false;
    this.type = 'basic';
    this.bodyUsed = false;

    // node-fetch specific properties
    this.size = 0;

    // Create mock readable stream for body
    if (body) {
      const encoder = new TextEncoder();
      const data = typeof body === 'string' ? body : JSON.stringify(body);
      const uint8Array = encoder.encode(data);

      this.body = {
        getReader: () => ({
          read: jest
            .fn()
            .mockResolvedValueOnce({ value: uint8Array, done: false })
            .mockResolvedValueOnce({ done: true }),
          releaseLock: jest.fn(),
        }),
      };
    }
  }

  async json() {
    if (typeof this._body === 'string') {
      return JSON.parse(this._body);
    }
    return this._body;
  }

  async text() {
    if (typeof this._body === 'object') {
      return JSON.stringify(this._body);
    }
    return String(this._body);
  }

  async buffer() {
    const text = await this.text();
    return Buffer.from(text);
  }

  async arrayBuffer() {
    const buffer = await this.buffer();
    return buffer.buffer;
  }

  async blob() {
    const text = await this.text();
    return new Blob([text]);
  }

  clone() {
    return new MockResponse(this._body, {
      status: this.status,
      statusText: this.statusText,
      headers: this.headers,
    });
  }
}

// Create the main mock fetch function
const mockFetch = jest.fn();

// Helper to create mock responses
mockFetch.Response = MockResponse;
mockFetch.createMockResponse = (data, status = 200) => {
  return new MockResponse(data, { status });
};

// Set default implementation
mockFetch.mockImplementation(() => Promise.resolve(new MockResponse('{}', { status: 200 })));

module.exports = mockFetch;
module.exports.default = mockFetch;
module.exports.MockResponse = MockResponse;
module.exports.createMockResponse = (data, status) => new MockResponse(data, { status });
