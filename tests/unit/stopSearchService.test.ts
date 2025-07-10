import { StopSearchService } from '../../src/services/StopSearchService.js';
import { StopSearchRequest } from '../../src/types/index.js';
import { TokenLimiter } from '../../src/utils/TokenLimiter.js';

describe('StopSearchService', () => {
  let service: StopSearchService;

  beforeEach(() => {
    service = new StopSearchService();
  });

  // U-5: 部分一致ヒット
  describe('search', () => {
    it('should find stops containing "銀閣"', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 512,
        query: '銀閣'
      };

      const response = await service.search(request);
      
      expect(response.candidates.length).toBeGreaterThan(0);
      expect(response.candidates.some(c => c.name.includes('銀閣寺'))).toBe(true);
      expect(response.truncated).toBe(false);
    });

    // U-6: 大文字小文字/全半角
    it('should handle case insensitive and full/half-width characters', async () => {
      const requestJa: StopSearchRequest = {
        language: 'ja',
        max_tokens: 512,
        query: 'ginkaku'
      };

      const requestEn: StopSearchRequest = {
        language: 'en',
        max_tokens: 512,
        query: 'Ginkaku'
      };

      const responseJa = await service.search(requestJa);
      const responseEn = await service.search(requestEn);
      
      expect(responseJa.candidates.length).toBeGreaterThan(0);
      expect(responseEn.candidates.length).toBeGreaterThan(0);
    });

    // U-7: max_tokens 遵守
    it('should respect max_tokens limit', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 50, // Very small limit
        query: 'a' // Should match many stops
      };

      const response = await service.search(request);
      
      // TokenLimiterを使ってトークン数をチェック（文字列長ではない）
      const tokenLimiter = new TokenLimiter();
      const actualTokens = tokenLimiter.calculateTokens(response);
      expect(actualTokens).toBeLessThanOrEqual(request.max_tokens);
      
      if (response.truncated) {
        expect(response.candidates.length).toBeGreaterThan(0);
      }
    });

    it('should return candidates sorted by relevance', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 512,
        query: '京都'
      };

      const response = await service.search(request);
      
      expect(response.candidates.length).toBeGreaterThan(1);
      // First candidate should be more relevant (exact match preferred)
      const firstCandidate = response.candidates[0];
      expect(firstCandidate.name).toContain('京都');
    });
  });

  describe('error handling', () => {
    it('should handle empty query', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 512,
        query: ''
      };

      const response = await service.search(request);
      expect(response.candidates).toEqual([]);
    });

    it('should handle query with no matches', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 512,
        query: 'xyz999nonexistent'
      };

      const response = await service.search(request);
      expect(response.candidates).toEqual([]);
      expect(response.truncated).toBe(false);
    });
  });
}); 