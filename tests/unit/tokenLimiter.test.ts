import { TokenLimiter } from '../../src/utils/TokenLimiter.js';

describe('TokenLimiter', () => {
  let limiter: TokenLimiter;

  beforeEach(() => {
    limiter = new TokenLimiter();
  });

  // U-3: 文字数 < max_tokens
  describe('applyLimit', () => {
    it('should return unchanged data when under limit', () => {
      const data = { test: 'hello world' };
      const result = limiter.applyLimit(data, 150);
      
      expect(result.data).toEqual(data);
      expect(result.truncated).toBe(false);
      expect(JSON.stringify(result.data).length).toBeLessThanOrEqual(150);
    });

    // U-4: 超過切り詰め
    it('should truncate when over limit', () => {
      const largeData = {
        items: Array(50).fill('very long string that will exceed token limit when serialized to JSON')
      };
      
      const result = limiter.applyLimit(largeData, 128);
      
      expect(limiter.calculateTokens(result.data)).toBeLessThanOrEqual(128);
      expect(result.truncated).toBe(true);
    });

    it('should handle array truncation properly', () => {
      const arrayData = {
        candidates: [
          { name: 'Stop 1', id: 'B:001' },
          { name: 'Stop 2', id: 'B:002' },
          { name: 'Stop 3', id: 'B:003' },
          { name: 'Stop 4', id: 'B:004' },
          { name: 'Stop 5', id: 'B:005' }
        ]
      };
      
      // Use smaller limit to force truncation (full array is ~64 tokens)
      const result = limiter.applyLimit(arrayData, 50);
      
      expect(result.data.candidates.length).toBeLessThan(arrayData.candidates.length);
      expect(result.truncated).toBe(true);
      expect(limiter.calculateTokens(result.data)).toBeLessThanOrEqual(50);
    });
  });

  describe('calculateTokens', () => {
    it('should count tokens using tiktoken encoding', () => {
      const data = { test: 'hello' };
      const tokens = limiter.calculateTokens(data);
      
      // {"test":"hello"} should be encoded as 5 tokens with cl100k_base
      expect(tokens).toBe(5);
    });

    it('should count tokens correctly for larger data', () => {
      const data = { message: 'This is a longer text with more words' };
      const tokens = limiter.calculateTokens(data);
      
      // Should be significantly less than JSON string length due to BPE
      const jsonLength = JSON.stringify(data).length;
      expect(tokens).toBeLessThan(jsonLength);
      expect(tokens).toBeGreaterThan(0);
    });
  });
}); 