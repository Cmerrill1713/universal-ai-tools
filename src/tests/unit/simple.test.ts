/**
 * Simple test to verify Jest configuration
 */

describe('Jest Configuration Test', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test');
    expect(result).toBe('test');
  });

  it('should have access to Node.js globals', () => {
    expect(process).toBeDefined();
    expect(Buffer).toBeDefined();
  });
});
