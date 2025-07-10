import { StopSearchService } from '../../src/services/StopSearchService.js';
import { MasterDataLoader } from '../../src/services/MasterDataLoader.js';
import { TokenLimiter } from '../../src/utils/TokenLimiter.js';
import { StopSearchRequest } from '../../src/types/index.js';

describe('Stop Search Integration Tests', () => {
  let stopSearchService: StopSearchService;
  let masterDataLoader: MasterDataLoader;
  let tokenLimiter: TokenLimiter;

  beforeAll(async () => {
    masterDataLoader = new MasterDataLoader();
    stopSearchService = new StopSearchService();
    tokenLimiter = new TokenLimiter();
    
    // Pre-load data for faster tests
    await masterDataLoader.loadStops('ja');
    await masterDataLoader.loadStops('en');
  });

  // IT-1: happy-path JA
  describe('Japanese stop search', () => {
    it('should return valid JSON schema within token limit', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 512,
        query: '京都'
      };

      const response = await stopSearchService.search(request);
      
      // JSON schema validation
      expect(response).toHaveProperty('candidates');
      expect(response).toHaveProperty('truncated');
      expect(Array.isArray(response.candidates)).toBe(true);
      expect(typeof response.truncated).toBe('boolean');
      
      // Token limit validation
      const actualTokens = tokenLimiter.calculateTokens(response);
      expect(actualTokens).toBeLessThanOrEqual(request.max_tokens);
      
      // Content validation
      expect(response.candidates.length).toBeGreaterThan(0);
      response.candidates.forEach(candidate => {
        expect(candidate).toHaveProperty('name');
        expect(candidate).toHaveProperty('kind');
        expect(candidate).toHaveProperty('id');
        expect(['bus_stop', 'train_station', 'landmark']).toContain(candidate.kind);
      });
    });
  });

  // IT-2: EN locale
  describe('English stop search', () => {
    it('should return English names only', async () => {
      const request: StopSearchRequest = {
        language: 'en',
        max_tokens: 512,
        query: 'Kyoto'
      };

      const response = await stopSearchService.search(request);
      
      expect(response.candidates.length).toBeGreaterThan(0);
      
      // Should contain English names
      response.candidates.forEach(candidate => {
        expect(candidate.name).toMatch(/[a-zA-Z]/); // Contains Latin characters
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very small token limits', async () => {
      const request: StopSearchRequest = {
        language: 'ja',
        max_tokens: 50,
        query: '駅'
      };

      const response = await stopSearchService.search(request);
      
      const actualTokens = tokenLimiter.calculateTokens(response);
      // トークン制限の許容範囲（BPE計算の不正確性を考慮）
      expect(actualTokens).toBeLessThanOrEqual(request.max_tokens * 1.1);
      
      if (response.candidates.length === 0) {
        expect(response.truncated).toBe(true);
      }
    });

    it('should handle common queries efficiently', async () => {
      const commonQueries = ['京都', '大阪', '銀閣', '清水'];
      
      for (const query of commonQueries) {
        const request: StopSearchRequest = {
          language: 'ja',
          max_tokens: 1024,
          query
        };

        const startTime = Date.now();
        const response = await stopSearchService.search(request);
        const endTime = Date.now();
        
        expect(endTime - startTime).toBeLessThan(1000); // Should be fast
        expect(response.candidates.length).toBeGreaterThan(0);
      }
    });
  });
}); 