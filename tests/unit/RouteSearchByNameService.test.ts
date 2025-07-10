import { RouteSearchByNameService } from '../../src/services/RouteSearchByNameService.js';
import { RouteHtmlFetcher } from '../../src/utils/RouteHtmlFetcher.js';
import { RouteHtmlParser } from '../../src/utils/RouteHtmlParser.js';
import { TokenLimiter } from '../../src/utils/TokenLimiter.js';
import { RequestValidator } from '../../src/utils/RequestValidator.js';
import { RouteSearchByNameRequest } from '../../src/types/index.js';

// モックの設定
jest.mock('../../src/utils/RouteHtmlFetcher.js');
jest.mock('../../src/utils/RouteHtmlParser.js');
jest.mock('../../src/utils/TokenLimiter.js');
jest.mock('../../src/utils/RequestValidator.js');

const mockedFetcher = RouteHtmlFetcher as jest.MockedClass<typeof RouteHtmlFetcher>;
const mockedParser = RouteHtmlParser as jest.MockedClass<typeof RouteHtmlParser>;
const mockedTokenLimiter = TokenLimiter as jest.MockedClass<typeof TokenLimiter>;
const mockedValidator = RequestValidator as jest.MockedClass<typeof RequestValidator>;

describe('RouteSearchByNameService', () => {
  let service: RouteSearchByNameService;
  let mockFetcher: jest.Mocked<RouteHtmlFetcher>;
  let mockParser: jest.Mocked<RouteHtmlParser>;
  let mockTokenLimiter: jest.Mocked<TokenLimiter>;
  let mockValidator: jest.Mocked<RequestValidator>;

  const validRequest: RouteSearchByNameRequest = {
    language: 'ja',
    max_tokens: 1024,
    from_station: '浄土寺(京都市バス)',
    to_station: '烏丸御池(京都バス)',
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
      fetchByName: jest.fn(),
    } as any;

    mockParser = {
      parseHtml: jest.fn(),
    } as any;

    mockTokenLimiter = {
      calculateTokens: jest.fn(),
      applyLimit: jest.fn(),
      destroy: jest.fn(),
    } as any;

    mockValidator = {
      validateRouteSearchRequest: jest.fn(),
    } as any;

    // モックコンストラクタの設定
    mockedFetcher.mockImplementation(() => mockFetcher);
    mockedParser.mockImplementation(() => mockParser);
    mockedTokenLimiter.mockImplementation(() => mockTokenLimiter);
    mockedValidator.mockImplementation(() => mockValidator);

    // デフォルトのモック戻り値設定
    mockFetcher.fetchByName.mockResolvedValue(mockHtmlResponse);
    mockParser.parseHtml.mockReturnValue(mockParseResult);
    mockTokenLimiter.calculateTokens.mockReturnValue(1000); // デフォルトトークン数
    mockTokenLimiter.applyLimit.mockReturnValue(mockLimitResult);

    service = new RouteSearchByNameService(
      mockFetcher,
      mockParser,
      mockTokenLimiter,
      mockValidator
    );
  });

  describe('constructor', () => {
    it('should create instance with default dependencies', () => {
      const defaultService = new RouteSearchByNameService();
      expect(defaultService).toBeInstanceOf(RouteSearchByNameService);
    });

    it('should create instance with custom dependencies', () => {
      const customService = new RouteSearchByNameService(
        mockFetcher,
        mockParser,
        mockTokenLimiter,
        mockValidator
      );
      expect(customService).toBeInstanceOf(RouteSearchByNameService);
    });
  });

  describe('searchRoute', () => {
    it('should successfully search route by station names', async () => {
      const result = await service.searchRoute(validRequest);

      expect(mockValidator.validateRouteSearchRequest).toHaveBeenCalledWith(validRequest);
      expect(mockFetcher.fetchByName).toHaveBeenCalledWith(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
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

      expect(mockFetcher.fetchByName).toHaveBeenCalledWith(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'arrival',
        'ja'
      );
    });

    it('should handle first datetime_type', async () => {
      const firstRequest = { ...validRequest, datetime_type: 'first' as const };
      
      await service.searchRoute(firstRequest);

      expect(mockFetcher.fetchByName).toHaveBeenCalledWith(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'first',
        'ja'
      );
    });

    it('should handle last datetime_type', async () => {
      const lastRequest = { ...validRequest, datetime_type: 'last' as const };
      
      await service.searchRoute(lastRequest);

      expect(mockFetcher.fetchByName).toHaveBeenCalledWith(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
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
      const validationError = new Error('Invalid station name');
      mockValidator.validateRouteSearchRequest.mockImplementation(() => {
        throw validationError;
      });

      await expect(service.searchRoute(validRequest)).rejects.toThrow('Invalid station name');
    });

    it('should throw stop not found error when no routes found', async () => {
      mockParser.parseHtml.mockReturnValue({ routes: [], truncated: false });

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Stop not found: 浄土寺(京都市バス) -> 烏丸御池(京都バス)',
        code: 404,
        details: {
          from_station: '浄土寺(京都市バス)',
          to_station: '烏丸御池(京都バス)',
          cause: 'stop_not_found'
        }
      });
    });

    it('should handle timeout error', async () => {
      const timeoutError = new Error('timeout');
      mockFetcher.fetchByName.mockRejectedValue(timeoutError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Service temporarily unavailable - timeout',
        code: 503,
        details: {
          cause: 'upstream_timeout'
        }
      });
    });

    it('should handle ECONNABORTED error as timeout', async () => {
      const abortError = new Error('Request aborted');
      (abortError as any).code = 'ECONNABORTED';
      mockFetcher.fetchByName.mockRejectedValue(abortError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Service temporarily unavailable - timeout',
        code: 503
      });
    });

    it('should handle ETIMEDOUT error as timeout', async () => {
      const timeoutError = new Error('Connection timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      mockFetcher.fetchByName.mockRejectedValue(timeoutError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Service temporarily unavailable - timeout',
        code: 503
      });
    });

    it('should handle network error ENOTFOUND', async () => {
      const networkError = new Error('getaddrinfo ENOTFOUND');
      (networkError as any).code = 'ENOTFOUND';
      mockFetcher.fetchByName.mockRejectedValue(networkError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Network error: getaddrinfo ENOTFOUND',
        code: 503,
        details: {
          cause: 'network_error',
          original_message: 'getaddrinfo ENOTFOUND'
        }
      });
    });

    it('should handle network error ECONNREFUSED', async () => {
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ECONNREFUSED';
      mockFetcher.fetchByName.mockRejectedValue(networkError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Network error: Connection refused',
        code: 503,
        details: {
          cause: 'network_error'
        }
      });
    });

    it('should handle network error ENETUNREACH', async () => {
      const networkError = new Error('Network unreachable');
      (networkError as any).code = 'ENETUNREACH';
      mockFetcher.fetchByName.mockRejectedValue(networkError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Network error: Network unreachable',
        code: 503
      });
    });

    it('should re-throw known errors (400, 404, 503)', async () => {
      const knownError = new Error('Service error 400');
      mockFetcher.fetchByName.mockRejectedValue(knownError);

      await expect(service.searchRoute(validRequest)).rejects.toThrow('Service error 400');
    });

    it('should convert unknown errors to internal errors', async () => {
      const unknownError = new Error('Unknown error');
      mockFetcher.fetchByName.mockRejectedValue(unknownError);

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Internal server error: Unknown error',
        code: 500,
        details: {
          cause: 'internal_error',
          original_message: 'Unknown error'
        }
      });
    });

    it('should handle non-Error thrown values', async () => {
      mockFetcher.fetchByName.mockRejectedValue('string error');

      await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
        message: 'Internal server error: Unknown error occurred',
        code: 500,
        details: {
          cause: 'internal_error',
          original_message: 'Unknown error occurred'
        }
      });
    });
  });

  describe('private methods behavior', () => {
    it('should detect timeout errors from various indicators', async () => {
      const timeoutErrors = [
        { message: 'Request timeout', code: undefined },
        { message: 'Connection econnaborted', code: undefined },
        { message: 'ECONNABORTED error', code: 'ECONNABORTED' },
        { message: 'Some error', code: 'ECONNABORTED' },
        { message: 'Some error', code: 'ETIMEDOUT' }
      ];

      for (const errorData of timeoutErrors) {
        const error = new Error(errorData.message);
        if (errorData.code) {
          (error as any).code = errorData.code;
        }
        mockFetcher.fetchByName.mockRejectedValue(error);

        await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
          code: 503,
          message: 'Service temporarily unavailable - timeout'
        });
      }
    });

    it('should detect network errors from various indicators', async () => {
      const networkErrors = [
        { message: 'getaddrinfo enotfound example.com', code: 'ENOTFOUND' },
        { message: 'connect ECONNREFUSED', code: 'ECONNREFUSED' },
        { message: 'Network is unreachable', code: 'ENETUNREACH' },
        { message: 'Some ENOTFOUND message', code: undefined },
        { message: 'network error occurred', code: undefined }
      ];

      for (const errorData of networkErrors) {
        const error = new Error(errorData.message);
        if (errorData.code) {
          (error as any).code = errorData.code;
        }
        mockFetcher.fetchByName.mockRejectedValue(error);

        await expect(service.searchRoute(validRequest)).rejects.toMatchObject({
          code: 503,
          details: {
            cause: 'network_error'
          }
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