import { RouteSearchByNameService } from '../../src/services/RouteSearchByNameService';
import { RouteHtmlFetcher } from '../../src/utils/RouteHtmlFetcher';
import { RouteHtmlParser } from '../../src/utils/RouteHtmlParser';
import { TokenLimiter } from '../../src/utils/TokenLimiter';
import { RequestValidator } from '../../src/utils/RequestValidator';
import { RouteSearchByNameRequest } from '../../src/types';

/**
 * E2E (End-to-End) Tests
 * 実際のWebサーバーにHTTPリクエストを送信してテストを行います
 * 
 * 注意: これらのテストは外部サービスに依存するため、
 * ネットワークの状況やサービスの可用性によって結果が変わる可能性があります
 */
describe('E2E Route Search Tests', () => {
  let service: RouteSearchByNameService;
  let fetcher: RouteHtmlFetcher;
  let parser: RouteHtmlParser;

  beforeEach(() => {
    fetcher = new RouteHtmlFetcher();
    parser = new RouteHtmlParser();
    service = new RouteSearchByNameService(
      fetcher,
      parser,
      new TokenLimiter(),
      new RequestValidator()
    );
  });

  afterEach(() => {
    service.dispose();
  });

  describe('Real Web Server Tests', () => {
    it('should fetch HTML from real web server and parse to JSON', async () => {
      // タイムアウトを長めに設定
      jest.setTimeout(60000);

      try {
        // 実際のHTMLを取得
        const html = await fetcher.fetchByName(
          '浄土寺',
          '京都駅前',
          '2025-07-07T07:35:00',
          'departure',
          'ja'
        );
        // HTMLをJSONに変換
        const parseResult = parser.parseHtml(html);
        if (parseResult.routes.length > 0) {
        }

        // 基本的な検証
        expect(html).toBeDefined();
        expect(html.length).toBeGreaterThan(0);
        expect(parseResult).toBeDefined();
        expect(Array.isArray(parseResult.routes)).toBe(true);

      } catch (error) {
        throw error;
      }
    }, 60000);

    it('should handle the exact same parameters that failed in MCP CLI', async () => {
      // タイムアウトを長めに設定
      jest.setTimeout(60000);

      const request: RouteSearchByNameRequest = {
        language: 'ja',
        max_tokens: 2000,
        from_station: '浄土寺(京都市バス)',
        to_station: '京都駅前(京都市バス)',
        datetime_type: 'departure',
        datetime: '2025-07-07T07:35:00'
      };

      try {
        const result = await service.searchRoute(request);
        // 基本的な検証
        expect(result).toBeDefined();
        expect(result.routes).toBeDefined();
        expect(Array.isArray(result.routes)).toBe(true);
        expect(typeof result.truncated).toBe('boolean');

      } catch (error) {
        throw error;
      }
    }, 60000);

    it('should test individual components step by step', async () => {
      jest.setTimeout(60000);

      try {
        // Step 1: Request Validation
        const validator = new RequestValidator();
        const request: RouteSearchByNameRequest = {
          language: 'ja',
          max_tokens: 2000,
          from_station: '浄土寺(京都市バス)',
          to_station: '京都駅前(京都市バス)',
          datetime_type: 'departure',
          datetime: '2025-07-07T07:35:00'
        };
        
        validator.validateRouteSearchRequest(request);
        // Step 2: HTTP Fetch
        const html = await fetcher.fetchByName(
          request.from_station,
          request.to_station,
          request.datetime,
          request.datetime_type === 'first' || request.datetime_type === 'last' ? 'departure' : request.datetime_type,
          request.language
        );
        // Step 3: HTML Parsing
        const parseResult = parser.parseHtml(html);
        // Step 4: Token Limiting
        const tokenLimiter = new TokenLimiter();
        const limitResult = tokenLimiter.applyLimit(parseResult, request.max_tokens);
        // All steps passed
        expect(html).toBeDefined();
        expect(parseResult).toBeDefined();
        expect(limitResult).toBeDefined();

      } catch (error) {
        throw error;
      }
    }, 60000);

    it('should test with simpler station names', async () => {
      jest.setTimeout(60000);

      const request: RouteSearchByNameRequest = {
        language: 'ja',
        max_tokens: 2000,
        from_station: '浄土寺',  // より簡単な駅名
        to_station: '京都駅',    // より簡単な駅名
        datetime_type: 'departure',
        datetime: '2025-07-07T07:35:00'
      };

      try {
        const result = await service.searchRoute(request);
        expect(result).toBeDefined();
        expect(result.routes).toBeDefined();

      } catch (error) {
        throw error;
      }
    }, 60000);
  });

  describe('Network Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      jest.setTimeout(10000);

      // 短いタイムアウトでテスト
      const shortTimeoutFetcher = new RouteHtmlFetcher({ timeout: 1 }); // 1ms timeout
      const testService = new RouteSearchByNameService(
        shortTimeoutFetcher,
        parser,
        new TokenLimiter(),
        new RequestValidator()
      );

      const request: RouteSearchByNameRequest = {
        language: 'ja',
        max_tokens: 2000,
        from_station: '浄土寺',
        to_station: '京都駅',
        datetime_type: 'departure',
        datetime: '2025-07-07T07:35:00'
      };

      await expect(testService.searchRoute(request)).rejects.toThrow();
    });

    it('should handle invalid URLs gracefully', async () => {
      jest.setTimeout(10000);

      // 無効なベースURLでテスト
      const invalidUrlFetcher = new RouteHtmlFetcher({ baseUrl: 'https://invalid-url-that-does-not-exist.com' });
      const testService = new RouteSearchByNameService(
        invalidUrlFetcher,
        parser,
        new TokenLimiter(),
        new RequestValidator()
      );

      const request: RouteSearchByNameRequest = {
        language: 'ja',
        max_tokens: 2000,
        from_station: '浄土寺',
        to_station: '京都駅',
        datetime_type: 'departure',
        datetime: '2025-07-07T07:35:00'
      };

      await expect(testService.searchRoute(request)).rejects.toThrow();
    });
  });
}); 