import { RouteSearchByGeoService } from '../../src/services/RouteSearchByGeoService.js';
import { RouteHtmlFetcher } from '../../src/utils/RouteHtmlFetcher.js';
import { RouteHtmlParser } from '../../src/utils/RouteHtmlParser.js';
import { TokenLimiter } from '../../src/utils/TokenLimiter.js';
import { RequestValidator } from '../../src/utils/RequestValidator.js';
import { RouteSearchByGeoRequest } from '../../src/types/index.js';

// モックの設定
jest.mock('../../src/utils/RouteHtmlFetcher.js');
jest.mock('../../src/utils/RouteHtmlParser.js');
jest.mock('../../src/utils/TokenLimiter.js');
jest.mock('../../src/utils/RequestValidator.js');

const mockedFetcher = RouteHtmlFetcher as jest.MockedClass<typeof RouteHtmlFetcher>;
const mockedParser = RouteHtmlParser as jest.MockedClass<typeof RouteHtmlParser>;
const mockedTokenLimiter = TokenLimiter as jest.MockedClass<typeof TokenLimiter>;
const mockedValidator = RequestValidator as jest.MockedClass<typeof RequestValidator>;

describe('RouteSearchByGeoService', () => {
  let service: RouteSearchByGeoService;
  let mockFetcher: jest.Mocked<RouteHtmlFetcher>;
  let mockParser: jest.Mocked<RouteHtmlParser>;
  let mockTokenLimiter: jest.Mocked<TokenLimiter>;
  let mockValidator: jest.Mocked<RequestValidator>;

  const validRequest: RouteSearchByGeoRequest = {
    language: 'ja',
    max_tokens: 1024,
    from_latlng: '35.02527,135.79189',
    to_latlng: '35.01070,135.75972',
    datetime: '2025-01-15T09:30:00',
    datetime_type: 'departure'
  };

  const mockHtmlResponse = `
    <html>
      <body>
        <div class="route-results">
          <div class="route-item">テストルート1</div>
          <div class="route-item">テストルート2</div>
        </div>
      </body>
    </html>
  `;

  const mockParseResult = {
    routes: [
      {
        summary: {
          depart: '2025-01-15T09:30',
          arrive: '2025-01-15T10:15',
          duration_min: 45,
          transfers: 1,
          fare_jpy: 230
        },
        legs: [
          {
            mode: 'bus' as const,
            line: 'テスト路線1',
            from: '出発地1',
            to: '到着地1',
            duration_min: 20,
            stops: 5,
            fare_jpy: 230
          },
          {
            mode: 'walk' as const,
            duration_min: 25,
            distance_km: 2.0
          }
        ]
      },
      {
        summary: {
          depart: '2025-01-15T09:45',
          arrive: '2025-01-15T10:30',
          duration_min: 45,
          transfers: 0,
          fare_jpy: 250
        },
        legs: [
          {
            mode: 'bus' as const,
            line: 'テスト路線2',
            from: '出発地2',
            to: '到着地2',
            duration_min: 45,
            stops: 8,
            fare_jpy: 250
          }
        ]
      }
    ],
    truncated: false
  };

  const mockLimitResult = {
    data: mockParseResult,
    truncated: false
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // モックインスタンスの作成
    mockFetcher = {
      fetchByCoordinates: jest.fn(),
    } as any;

    mockParser = {
      parseHtml: jest.fn(),
    } as any;

    mockTokenLimiter = {
      applyLimit: jest.fn(),
      destroy: jest.fn(),
    } as any;

    mockValidator = {
      validateRouteSearchByGeoRequest: jest.fn(),
    } as any;

    // モックコンストラクタの設定
    mockedFetcher.mockImplementation(() => mockFetcher);
    mockedParser.mockImplementation(() => mockParser);
    mockedTokenLimiter.mockImplementation(() => mockTokenLimiter);
    mockedValidator.mockImplementation(() => mockValidator);

    // デフォルトのモック戻り値設定
    mockFetcher.fetchByCoordinates.mockResolvedValue(mockHtmlResponse);
    mockParser.parseHtml.mockReturnValue(mockParseResult);
    mockTokenLimiter.applyLimit.mockReturnValue(mockLimitResult);

    service = new RouteSearchByGeoService(
      mockFetcher,
      mockParser,
      mockTokenLimiter,
      mockValidator
    );
  });

  describe('constructor', () => {
    it('should create instance with default dependencies', () => {
      const defaultService = new RouteSearchByGeoService();
      expect(defaultService).toBeInstanceOf(RouteSearchByGeoService);
    });

    it('should create instance with custom dependencies', () => {
      const customService = new RouteSearchByGeoService(
        mockFetcher,
        mockParser,
        mockTokenLimiter,
        mockValidator
      );
      expect(customService).toBeInstanceOf(RouteSearchByGeoService);
    });
  });

  describe('searchRoute', () => {
    it('should successfully search route by coordinates', async () => {
      const result = await service.searchRoute(validRequest);

      expect(mockValidator.validateRouteSearchByGeoRequest).toHaveBeenCalledWith(validRequest);
      expect(mockFetcher.fetchByCoordinates).toHaveBeenCalledWith(
        35.02527,
        135.79189,
        35.01070,
        135.75972,
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );
      expect(mockParser.parseHtml).toHaveBeenCalledWith(mockHtmlResponse, 'ja');
      expect(mockTokenLimiter.applyLimit).toHaveBeenCalledWith(mockParseResult, 1024);

      expect(result).toEqual({
        routes: mockParseResult.routes,
        truncated: false
      });
    });

    it('should handle arrival datetime_type', async () => {
      const arrivalRequest = { ...validRequest, datetime_type: 'arrival' as const };
      
      await service.searchRoute(arrivalRequest);

      expect(mockFetcher.fetchByCoordinates).toHaveBeenCalledWith(
        35.02527,
        135.79189,
        35.01070,
        135.75972,
        '2025-01-15T09:30:00',
        'arrival',
        'ja'
      );
    });

    it('should handle first datetime_type', async () => {
      const firstRequest = { ...validRequest, datetime_type: 'first' as const };
      
      await service.searchRoute(firstRequest);

      expect(mockFetcher.fetchByCoordinates).toHaveBeenCalledWith(
        35.02527,
        135.79189,
        35.01070,
        135.75972,
        '2025-01-15T09:30:00',
        'first',
        'ja'
      );
    });

    it('should handle last datetime_type', async () => {
      const lastRequest = { ...validRequest, datetime_type: 'last' as const };
      
      await service.searchRoute(lastRequest);

      expect(mockFetcher.fetchByCoordinates).toHaveBeenCalledWith(
        35.02527,
        135.79189,
        35.01070,
        135.75972,
        '2025-01-15T09:30:00',
        'last',
        'ja'
      );
    });

    it('should handle token limit truncation', async () => {
      const truncatedResult = {
        data: { routes: [mockParseResult.routes[0]] },
        truncated: true
      };
      mockTokenLimiter.applyLimit.mockReturnValue(truncatedResult);

      const result = await service.searchRoute(validRequest);

      expect(result).toEqual({
        routes: truncatedResult.data.routes,
        truncated: true
      });
    });

    it('should throw validation error from validator', async () => {
      const validationError = new Error('Invalid coordinates');
      mockValidator.validateRouteSearchByGeoRequest.mockImplementation(() => {
        throw validationError;
      });

      await expect(service.searchRoute(validRequest)).rejects.toThrow('Invalid coordinates');
    });

    it('should throw location not found error when no routes and HTML indicates not found', async () => {
      const notFoundHtml = '<html><body>該当する結果が見つかりませんでした</body></html>';
      mockFetcher.fetchByCoordinates.mockResolvedValue(notFoundHtml);
      mockParser.parseHtml.mockReturnValue({ routes: [], truncated: false });

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        code: 404,
        message: 'Location not found',
        details: {
          from_latlng: '35.02527,135.79189',
          to_latlng: '35.01070,135.75972',
          cause: 'location_not_found'
        }
      });
    });

    it('should handle timeout error', async () => {
      const timeoutError = new Error('timeout');
      mockFetcher.fetchByCoordinates.mockRejectedValue(timeoutError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        code: 503,
        message: 'Service temporarily unavailable',
        details: {
          cause: 'upstream_timeout'
        }
      });
    });

    it('should handle ECONNABORTED error as timeout', async () => {
      const abortError = new Error('Request aborted');
      (abortError as any).code = 'ECONNABORTED';
      mockFetcher.fetchByCoordinates.mockRejectedValue(abortError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        code: 503,
        message: 'Service temporarily unavailable',
        details: {
          cause: 'upstream_timeout'
        }
      });
    });

    it('should re-throw known errors (400, 404, 503)', async () => {
      const knownError = new Error('Service error 404');
      mockFetcher.fetchByCoordinates.mockRejectedValue(knownError);

      await expect(service.searchRoute(validRequest)).rejects.toThrow('Service error 404');
    });

    it('should convert unknown errors to internal errors', async () => {
      const unknownError = new Error('Unknown error');
      mockFetcher.fetchByCoordinates.mockRejectedValue(unknownError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        code: 500,
        message: 'Internal server error',
        details: {
          cause: 'internal_error',
          original_message: 'Unknown error'
        }
      });
    });

    it('should handle non-Error thrown values', async () => {
      mockFetcher.fetchByCoordinates.mockRejectedValue('string error');

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        code: 500,
        message: 'Internal server error',
        details: {
          cause: 'internal_error',
          original_message: 'Unknown error occurred'
        }
      });
    });
  });

  describe('private methods behavior', () => {
    it('should detect location not found from various HTML indicators', async () => {
      const testCases = [
        '該当する結果が見つかりませんでした',
        '検索結果がありません', 
        'No results found',
        'location not found',
        '位置情報が見つかりません',
        '範囲外',
        'out of range'
      ];

      for (const indicator of testCases) {
        const notFoundHtml = `<html><body>${indicator}</body></html>`;
        mockFetcher.fetchByCoordinates.mockResolvedValue(notFoundHtml);
        mockParser.parseHtml.mockReturnValue({ routes: [], truncated: false });

        await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
          code: 404,
          message: 'Location not found'
        });
      }
    });

    it('should detect timeout errors from various indicators', async () => {
      const timeoutErrors = [
        { message: 'Request timeout', code: undefined },
        { message: 'Connection timeout', code: undefined },
        { message: 'ECONNABORTED error', code: 'ECONNABORTED' },
        { message: 'Some error', code: 'ECONNABORTED' }
      ];

      for (const errorData of timeoutErrors) {
        const error = new Error(errorData.message);
        if (errorData.code) {
          (error as any).code = errorData.code;
        }
        mockFetcher.fetchByCoordinates.mockRejectedValue(error);

        await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
          code: 503,
          message: 'Service temporarily unavailable'
        });
      }
    });
  });

  describe('dispose', () => {
    it('should call destroy on tokenLimiter', () => {
      service.dispose();
      expect(mockTokenLimiter.destroy).toHaveBeenCalled();
    });
  });
}); 