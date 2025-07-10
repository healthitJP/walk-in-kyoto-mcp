import { RouteHtmlFetcher } from '../utils/RouteHtmlFetcher.js';
import { RouteHtmlParser } from '../utils/RouteHtmlParser.js';
import { TokenLimiter } from '../utils/TokenLimiter.js';
import { RequestValidator } from '../utils/RequestValidator.js';
import { 
  RouteSearchByNameRequest, 
  RouteSearchResponse
} from '../types/index.js';

/**
 * Tool 2: search_route_by_name の実装
 * 駅名・バス停名ベースでの乗換検索サービス
 * 単一責任原則：ルート検索のオーケストレーション
 */
export class RouteSearchByNameService {
  private readonly fetcher: RouteHtmlFetcher;
  private readonly parser: RouteHtmlParser;
  private readonly tokenLimiter: TokenLimiter;
  private readonly validator: RequestValidator;

  constructor(
    fetcher?: RouteHtmlFetcher,
    parser?: RouteHtmlParser,
    tokenLimiter?: TokenLimiter,
    validator?: RequestValidator
  ) {
    this.fetcher = fetcher || new RouteHtmlFetcher();
    this.parser = parser || new RouteHtmlParser();
    this.tokenLimiter = tokenLimiter || new TokenLimiter();
    this.validator = validator || new RequestValidator();
  }

  /**
   * 駅名指定でルート検索を実行
   */
  async searchRoute(request: RouteSearchByNameRequest): Promise<RouteSearchResponse> {
    try {
      // 入力検証
      this.validator.validateRouteSearchRequest(request);

      // HTML取得
              const html = await this.fetcher.fetchByName(
          request.from_station,
          request.to_station,
          request.datetime,
          request.datetime_type,
          request.language
        );

      // HTML解析
      const parseResult = this.parser.parseHtml(html, request.language);
      

      if (parseResult.routes.length > 0) {

      }

      // 駅が見つからない場合のエラーハンドリング
      if (parseResult.routes.length === 0) {

        throw this.createStopNotFoundError(request.from_station, request.to_station);
      
      }

      // トークン制限適用
      const limitResult = this.tokenLimiter.applyLimit(parseResult, request.max_tokens);

      return {
        routes: limitResult.data.routes,
        truncated: limitResult.truncated
      };

    } catch (error) {
      if (error instanceof Error) {
        // 既知のエラータイプの場合はそのまま再スロー
        if (this.isKnownError(error)) {
          throw error;
        }

        // タイムアウトエラーの処理
        if (this.isTimeoutError(error)) {
          throw this.createTimeoutError();
        }

        // ネットワークエラーの処理
        if (this.isNetworkError(error)) {
          throw this.createNetworkError(error.message);
        }

        // その他のエラーは内部エラーとして処理
        throw this.createInternalError(error.message);
      }

      throw this.createInternalError('Unknown error occurred');
    }
  }

  /**
   * HTMLから駅が見つからないエラーかどうかを判定
   */
  private isStopNotFoundError(html: string): boolean {
    const notFoundIndicators = [
      '該当する結果が見つかりませんでした',
      '検索結果がありません',
      'No results found',
      'not found',
      '見つかりません'
    ];

    const lowerHtml = html.toLowerCase();
    return notFoundIndicators.some(indicator => 
      lowerHtml.includes(indicator.toLowerCase())
    );
  }

  /**
   * 既知のエラータイプかどうかを判定
   */
  private isKnownError(error: Error): boolean {
    return error.message.includes('400') || 
           error.message.includes('404') || 
           error.message.includes('503') ||
           error.message.includes('Stop not found') ||
           error.message.includes('Invalid') ||
           error.message.includes('Missing required parameter') ||
           (error as any).code === 404 ||
           (error as any).code === 503;
  }

  /**
   * タイムアウトエラーかどうかを判定
   */
  private isTimeoutError(error: Error): boolean {
    const errorCode = (error as any).code;
    const errorMessage = error.message.toLowerCase();
    
    return errorMessage.includes('timeout') || 
           errorMessage.includes('econnaborted') ||
           errorCode === 'ECONNABORTED' ||
           errorCode === 'ETIMEDOUT';
  }

  /**
   * ネットワークエラーかどうかを判定
   */
  private isNetworkError(error: Error): boolean {
    const errorCode = (error as any).code;
    const errorMessage = error.message.toLowerCase();
    
    return errorCode === 'ENOTFOUND' || 
           errorCode === 'ECONNREFUSED' ||
           errorCode === 'ENETUNREACH' ||
           errorMessage.includes('enotfound') ||
           errorMessage.includes('network error');
  }

  /**
   * 駅が見つからないエラーを作成
   */
  private createStopNotFoundError(fromStation: string, toStation: string): Error {
    const error = new Error(`Stop not found: ${fromStation} -> ${toStation}`);
    (error as any).code = 404;
    (error as any).details = {
      from_station: fromStation,
      to_station: toStation,
      cause: 'stop_not_found'
    };
    return error;
  }

  /**
   * タイムアウトエラーを作成
   */
  private createTimeoutError(): Error {
    const error = new Error('Service temporarily unavailable - timeout');
    (error as any).code = 503;
    (error as any).details = {
      cause: 'upstream_timeout'
    };
    return error;
  }

  /**
   * ネットワークエラーを作成
   */
  private createNetworkError(message: string): Error {
    const error = new Error(`Network error: ${message}`);
    (error as any).code = 503;
    (error as any).details = {
      cause: 'network_error',
      original_message: message
    };
    return error;
  }

  /**
   * 内部エラーを作成
   */
  private createInternalError(message: string): Error {
    const error = new Error(`Internal server error: ${message}`);
    (error as any).code = 500;
    (error as any).details = {
      cause: 'internal_error',
      original_message: message
    };
    return error;
  }

  /**
   * リソースのクリーンアップ
   */
  dispose(): void {
    this.tokenLimiter.destroy();
  }
} 