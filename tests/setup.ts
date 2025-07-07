// Jest test setup
// Global test configuration and mocks

// Extend Jest matchers if needed
expect.extend({});

// Global test timeout
jest.setTimeout(10000);

// Mock console methods in tests to reduce noise
global.console = {
  ...console,
  // Uncomment next line to disable console.log in tests
  // log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}; 