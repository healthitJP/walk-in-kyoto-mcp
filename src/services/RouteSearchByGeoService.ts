import { RouteHtmlFetcher } from '../utils/RouteHtmlFetcher';
import { RouteHtmlParser } from '../utils/RouteHtmlParser';
import { TokenLimiter } from '../utils/TokenLimiter';
import { RequestValidator } from '../utils/RequestValidator';
import { 
  RouteSearchByGeoRequest, 
  RouteSearchResponse
} from '../types';

/**
 * Tool 3: search_route_by_geo の実装
 * 緯度経度指定でのルート検索サービス
 * 単一責任原則：緯度経度ベースのルート検索オーケストレーション
 */
export class RouteSearchByGeoService {
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
   * 緯度経度指定でルート検索を実行
   */
  async searchRoute(request: RouteSearchByGeoRequest): Promise<RouteSearchResponse> {
    try {
      // 入力検証
      this.validator.validateRouteSearchByGeoRequest(request);

              // HTML取得
        const [fromLat, fromLng] = request.from_latlng.split(',').map(Number);
        const [toLat, toLng] = request.to_latlng.split(',').map(Number);
        
        const html = await this.fetcher.fetchByCoordinates(
          fromLat,
          fromLng,
          toLat,
          toLng,
          request.datetime,
          request.datetime_type,
          request.language
        );

      // HTML解析
      const parseResult = this.parser.parseHtml(html, request.language);

      // 位置が見つからない場合のエラーハンドリング
      if (parseResult.routes.length === 0) {
        // HTMLを確認して「見つかりません」などのメッセージがあるかチェック
        if (this.isLocationNotFoundError(html)) {
          throw this.createLocationNotFoundError(request.from_latlng, request.to_latlng);
        }
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

        // その他のエラーは内部エラーとして処理
        throw this.createInternalError(error.message);
      }

      throw this.createInternalError('Unknown error occurred');
    }
  }

  /**
   * HTMLから位置が見つからないエラーかどうかを判定
   */
  private isLocationNotFoundError(html: string): boolean {
    const notFoundIndicators = [
      '該当する結果が見つかりませんでした',
      '検索結果がありません',
      'No results found',
      'location not found',
      '位置情報が見つかりません',
      '範囲外',
      'out of range'
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
           error.message.includes('Location not found') ||
           error.message.includes('Invalid') ||
           error.message.includes('Missing required parameter') ||
           (error as any).code === 404 ||
           (error as any).code === 503;
  }

  /**
   * タイムアウトエラーかどうかを判定
   */
  private isTimeoutError(error: Error): boolean {
    return error.message.includes('timeout') || 
           error.message.includes('ECONNABORTED') ||
           (error as any).code === 'ECONNABORTED';
  }

  /**
   * 位置が見つからないエラーを作成
   */
  private createLocationNotFoundError(fromLatLng: string, toLatLng: string): Error {
    const error = new Error('Location not found');
    (error as any).code = 404;
    (error as any).details = {
      from_latlng: fromLatLng,
      to_latlng: toLatLng,
      cause: 'location_not_found'
    };
    return error;
  }

  /**
   * タイムアウトエラーを作成
   */
  private createTimeoutError(): Error {
    const error = new Error('Service temporarily unavailable');
    (error as any).code = 503;
    (error as any).details = {
      cause: 'upstream_timeout'
    };
    return error;
  }

  /**
   * 内部エラーを作成
   */
  private createInternalError(message: string): Error {
    const error = new Error('Internal server error');
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