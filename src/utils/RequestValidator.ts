import { Language, DateTimeType, StopSearchRequest, RouteSearchByNameRequest, RouteSearchByGeoRequest } from '../types';

/**
 * MCP仕様に沿ったリクエストパラメータの検証を行う
 */
export class RequestValidator {
  
  /**
   * StopSearchRequestの検証
   * @param request 検証対象のリクエスト
   * @throws Error 検証エラー時
   */
  validateStopSearchRequest(request: StopSearchRequest): void {
    // 必須パラメータのチェック
    if (!request.language) {
      throw new Error('Missing required parameter: language');
    }
    
    if (request.max_tokens === undefined || request.max_tokens === null) {
      throw new Error('Missing required parameter: max_tokens');
    }
    
    if (request.query === undefined || request.query === null) {
      throw new Error('Missing required parameter: query');
    }

    // 言語の検証
    this.validateLanguage(request.language);
    
    // max_tokensの検証
    this.validateMaxTokens(request.max_tokens);
  }

  /**
   * RouteSearchByNameRequestの検証
   * @param request 検証対象のリクエスト
   * @throws Error 検証エラー時
   */
  validateRouteSearchRequest(request: RouteSearchByNameRequest): void {
    // 基本パラメータの検証
    this.validateCommonRouteParams(request);
    
    // 必須パラメータのチェック
    if (!request.from_station) {
      throw new Error('Missing required parameter: from_station');
    }
    
    if (!request.to_station) {
      throw new Error('Missing required parameter: to_station');
    }
  }

  /**
   * RouteSearchByGeoRequestの検証
   * @param request 検証対象のリクエスト
   * @throws Error 検証エラー時
   */
  validateRouteSearchByGeoRequest(request: RouteSearchByGeoRequest): void {
    // 基本パラメータの検証
    this.validateCommonRouteParams(request);
    
    // 必須パラメータのチェック
    if (!request.from_latlng) {
      throw new Error('Missing required parameter: from_latlng');
    }
    
    if (!request.to_latlng) {
      throw new Error('Missing required parameter: to_latlng');
    }

    // 緯度経度の検証
    this.validateLatLng(request.from_latlng);
    this.validateLatLng(request.to_latlng);
  }

  /**
   * 緯度経度文字列の検証
   * @param latlng "lat,lng"形式の文字列
   * @throws Error 検証エラー時
   */
  validateLatLng(latlng: string): void {
    // 形式チェック
    const parts = latlng.split(',');
    if (parts.length !== 2) {
      throw new Error('Invalid lat,lng format. Expected "lat,lng"');
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    // 数値チェック
    if (isNaN(lat) || isNaN(lng)) {
      throw new Error('Invalid lat,lng format. Values must be numbers');
    }

    // 緯度範囲チェック（-90 ～ 90）
    if (lat < -90 || lat > 90) {
      throw new Error('Invalid latitude. Must be between -90 and 90');
    }

    // 経度範囲チェック（-180 ～ 180）
    if (lng < -180 || lng > 180) {
      throw new Error('Invalid longitude. Must be between -180 and 180');
    }
  }

  /**
   * 言語の検証
   * @param language 検証対象の言語
   * @throws Error 検証エラー時
   */
  private validateLanguage(language: Language): void {
    if (language !== 'ja' && language !== 'en') {
      throw new Error('Invalid language. Must be "ja" or "en"');
    }
  }

  /**
   * max_tokensの検証
   * @param maxTokens 検証対象のトークン数
   * @throws Error 検証エラー時
   */
  private validateMaxTokens(maxTokens: number): void {
    if (typeof maxTokens !== 'number' || maxTokens <= 0) {
      throw new Error('max_tokens must be positive');
    }
  }

  /**
   * datetime_typeの検証
   * @param datetimeType 検証対象の日時種別
   * @throws Error 検証エラー時
   */
  private validateDateTimeType(datetimeType: DateTimeType): void {
    const validTypes: DateTimeType[] = ['departure', 'arrival', 'first', 'last'];
    if (!validTypes.includes(datetimeType)) {
      throw new Error('Invalid datetime_type. Must be one of: departure, arrival, first, last');
    }
  }

  /**
   * ISO-8601日時形式の検証
   * @param datetime 検証対象の日時文字列
   * @throws Error 検証エラー時
   */
  private validateDateTime(datetime: string): void {
    // ISO-8601形式の基本パターン（YYYY-MM-DDTHH:mm形式）
    const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d{3})?([+-]\d{2}:\d{2}|Z)?$/;
    
    if (!iso8601Pattern.test(datetime)) {
      throw new Error('Invalid datetime format. Expected ISO-8601 format (e.g., "2025-07-07T00:43")');
    }

    // 実際の日付として有効かチェック
    const date = new Date(datetime);
    if (isNaN(date.getTime())) {
      throw new Error('Invalid datetime. Date is not valid');
    }
  }

  /**
   * ルート検索リクエスト共通パラメータの検証
   * @param request 検証対象のリクエスト
   * @throws Error 検証エラー時
   */
  private validateCommonRouteParams(request: RouteSearchByNameRequest | RouteSearchByGeoRequest): void {
    // 必須パラメータのチェック
    if (!request.language) {
      throw new Error('Missing required parameter: language');
    }
    
    if (request.max_tokens === undefined || request.max_tokens === null) {
      throw new Error('Missing required parameter: max_tokens');
    }
    
    if (!request.datetime_type) {
      throw new Error('Missing required parameter: datetime_type');
    }
    
    if (!request.datetime) {
      throw new Error('Missing required parameter: datetime');
    }

    // 各パラメータの検証
    this.validateLanguage(request.language);
    this.validateMaxTokens(request.max_tokens);
    this.validateDateTimeType(request.datetime_type);
    this.validateDateTime(request.datetime);
  }
} 