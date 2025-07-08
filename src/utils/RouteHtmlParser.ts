import * as cheerio from 'cheerio';
import { Route, RouteLeg, RouteSearchResponse } from '../types/index.js';
import { StationCoordinateResolver } from './StationCoordinateResolver.js';

/**
 * HTMLからルート情報を解析してJSONに変換するクラス
 * 単一責任原則：HTML解析・変換のみを担当
 */
export class RouteHtmlParser {
  private coordinateResolver: StationCoordinateResolver;

  constructor() {
    this.coordinateResolver = new StationCoordinateResolver();
  }
  
  /**
   * HTMLからルート検索結果を解析
   */
  parseHtml(html: string, language: 'ja' | 'en' = 'ja'): RouteSearchResponse {
    try {
      const $ = cheerio.load(html);
      
      // エラーメッセージの検出
      const bodyText = $('body').text();
      const hasErrorMessage = [
        '該当する結果が見つかりませんでした',
        '検索結果がありません',
        'No results found',
        'not found',
        '見つかりません'
      ].some(msg => bodyText.includes(msg));

      if (hasErrorMessage) {

        return {
          routes: [],
          truncated: false
        };
      }

      const routes = this.extractRoutes($, language);
      

      return {
        routes,
        truncated: false // トークン制限は上位層で処理
      };
    } catch (error) {

      return {
        routes: [],
        truncated: false
      };
    }
  }

  /**
   * HTMLからルート一覧を抽出
   */
  private extractRoutes($: cheerio.CheerioAPI, language: 'ja' | 'en' = 'ja'): Route[] {
    const routes: Route[] = [];
    
    // デバッグログをstderrに出力（MCPプロトコルを破壊しないように）
    // まずHTMLから正確な時刻情報を取得
    const htmlRoutes = this.extractRoutesFromHtml($);

    
    // 次に生データから詳細な区間情報を取得
    const rawRoutes = this.extractRawRoutes($, language);

    
    // HTMLと生データの情報を統合
    if (htmlRoutes.length > 0 && rawRoutes.length > 0) {

      for (let i = 0; i < Math.min(htmlRoutes.length, rawRoutes.length); i++) {
        // HTMLから取得したlegsが運賃情報を含む場合はそちらを優先、なければ生データを使用
        const htmlLegs = htmlRoutes[i].legs;
        const rawLegs = rawRoutes[i].legs;
        
        // HTMLのlegsに運賃情報があるかチェック
        const htmlHasFareInfo = htmlLegs.some(leg => leg.fare_jpy && leg.fare_jpy > 0);
        
        const mergedRoute = {
          summary: {
            // HTMLから正確な時刻と所要時間を使用
            depart: htmlRoutes[i].summary.depart,
            arrive: htmlRoutes[i].summary.arrive,
            duration_min: htmlRoutes[i].summary.duration_min,
            transfers: htmlRoutes[i].summary.transfers,
            // HTMLから正確な運賃を使用（生データには運賃情報なし）
            fare_jpy: htmlRoutes[i].summary.fare_jpy
          },
          // HTMLに運賃情報があればHTMLのlegsを使用、なければ生データと座標情報をマージ
          legs: htmlHasFareInfo ? htmlLegs : this.mergeLegsWithCoordinates(htmlLegs, rawLegs)
        };
        routes.push(mergedRoute);
      }
    } else if (htmlRoutes.length > 0) {

      routes.push(...htmlRoutes);
    } else if (rawRoutes.length > 0) {

      routes.push(...rawRoutes);
    } else {

    }
    

    return routes;
  }

  /**
   * HTMLのlegsと生データのlegsをマージして座標情報を補完
   */
  private mergeLegsWithCoordinates(htmlLegs: RouteLeg[], rawLegs: RouteLeg[]): RouteLeg[] {
    // HTMLのlegsがある場合はそれをベースに座標情報を補完
    if (htmlLegs.length > 0) {
      return htmlLegs.map((htmlLeg, index) => {
        const rawLeg = rawLegs[index];
        return {
          ...htmlLeg,
          // 座標情報が欠けている場合は生データから補完
          from_lat: htmlLeg.from_lat || rawLeg?.from_lat,
          from_lng: htmlLeg.from_lng || rawLeg?.from_lng,
          to_lat: htmlLeg.to_lat || rawLeg?.to_lat,
          to_lng: htmlLeg.to_lng || rawLeg?.to_lng,
        };
      });
    }
    // HTMLのlegsがない場合は生データをそのまま使用
    return rawLegs;
  }

  /**
   * form#resultInfo の生データから解析（高精度）
   */
  private extractRawRoutes($: cheerio.CheerioAPI, language: 'ja' | 'en' = 'ja'): Route[] {
    const routes: Route[] = [];
    const elements = $('form#resultInfo input[name^="rt"]');

    
    elements.each((index, element) => {
      const rawData = $(element).attr('value');

      
      if (rawData) {
        try {
          const route = this.parseRawRouteData(rawData, language);
          if (route) {

            routes.push(route);
          } else {

          }
        } catch (error) {

        }
      }
    });


    return routes;
  }

  /**
   * 生データ文字列を解析してRouteオブジェクトに変換
   * フォーマット: type$name$platform$id$mode$line$$fare$duration1$duration2$hash$flag$stops$stationId$...
   */
  private parseRawRouteData(rawData: string, language: 'ja' | 'en' = 'ja'): Route | null {
    const segments = rawData.split('$');
    if (segments.length < 10) return null;

    const legs: RouteLeg[] = [];
    let totalFare = 0;
    let totalDuration = 0;
    let transfers = 0;

    // データセグメントの位置を特定
    let i = 0;
    let currentType = '';
    let currentName = '';

    while (i < segments.length) {
      const segment = segments[i];

      if (segment === 'busstop' || segment === 'station' || segment === 'spot') {
        currentType = segment;
        currentName = segments[i + 1] || '';
        i += 4; // type, name, platform, id をスキップ
      } else if (segment === 'bus' || segment === 'train') {
        // バス・電車セグメント: mode$line$$fare$duration1$duration2$hash$flag$stops$stationId
        const mode = segment as 'bus' | 'train';
        const line = segments[i + 1] || '';
        // i+2は空文字（$$の間）
        // 生データには正確な運賃情報が含まれていないため運賃抽出を無効化
        const fare = 0;
        const duration1 = parseInt(segments[i + 4]) || 0; // 実際の乗車時間（秒）
        const duration2 = parseInt(segments[i + 5]) || 0; // 待ち時間含む？
        const stops = parseInt(segments[i + 8]) || 0;

        // 次の停留所名を取得
        let toName = '';
        let j = i + 10;
        while (j < segments.length && segments[j] !== 'walk' && segments[j] !== 'bus' && segments[j] !== 'train') {
          if (segments[j] === 'busstop' || segments[j] === 'station' || segments[j] === 'spot') {
            toName = segments[j + 1] || '';
            break;
          }
          j++;
        }

        // 緯度経度を取得
        const fromCoords = this.coordinateResolver.resolveCoordinates(currentName, language);
        const toCoords = this.coordinateResolver.resolveCoordinates(toName, language);

        const leg: RouteLeg = {
          mode,
          line,
          from: currentName,
          to: toName,
          from_lat: fromCoords?.lat,
          from_lng: fromCoords?.lng,
          to_lat: toCoords?.lat,
          to_lng: toCoords?.lng,
          duration_min: Math.floor(duration1 / 60), // 秒を分に変換
          stops,
          fare_jpy: fare
        };

        legs.push(leg);
        totalFare += fare;
        totalDuration += leg.duration_min;
        if (legs.length > 1) transfers++;

        i += 10; // セグメントをスキップ
      } else if (segment === 'walk') {
        // 徒歩セグメント: walk$distance$duration
        const distance = parseInt(segments[i + 1]) || 0;
        const duration = parseInt(segments[i + 2]) || 0;

        const leg: RouteLeg = {
          mode: 'walk',
          duration_min: Math.floor(duration / 60), // 秒を分に変換
          distance_km: distance / 1000 // メートルをキロメートルに変換
        };

        legs.push(leg);
        totalDuration += leg.duration_min;

        i += 3;
      } else {
        i++;
      }
    }

    // 生データからの時刻抽出は信頼性が低いため、HTMLから抽出する
    // この時点では空の値を返し、上位層でHTMLパースを優先させる
    console.error(`📊 Raw data segments:`, segments.slice(-5)); // 最後の5要素を表示

    if (legs.length === 0) return null;

    return {
      summary: {
        depart: '', // HTMLから抽出する
        arrive: '', // HTMLから抽出する
        duration_min: totalDuration, // 計算値だが、HTMLの値を優先
        transfers,
        fare_jpy: totalFare
      },
      legs
    };
  }

  /**
   * HTML構造から解析（フォールバック）
   */
  private extractRoutesFromHtml($: cheerio.CheerioAPI): Route[] {
    const routes: Route[] = [];
    // 詳細表示の時刻情報を取得（より正確）
    const detailElements = $('td.time_1');

    
    detailElements.each((index, element) => {
      try {
        const timeText = $(element).text(); // "05:31発 →06:09着"

        
        // この要素が属するルートコンテナを特定
        const $routeContainer = $(element).closest('div[id^="result-"]');
        const routeContainerId = $routeContainer.attr('id');

        
        // 同じ行または近くの行から所要時間と乗換回数、運賃を取得
        const $parentRow = $(element).closest('tr');
        const durationText = $parentRow.find('td.time_2').text(); // "所要時間：38分 (バス 31分、電車 0分、徒歩 7分）"
        const fareTransferText = $parentRow.find('td.time_3').text(); // "乗換：0回　運賃：230円"
        

        
        const route = this.parseDetailedRoute(timeText, durationText, fareTransferText, $, routeContainerId);
        if (route) {

          routes.push(route);
        } else {

        }
      } catch (error) {

      }
    });

    // 詳細表示がない場合はテーブル行から抽出（フォールバック）
    if (routes.length === 0) {

      const elements = $('#result_list table tr[data-href]');

      
      elements.each((index, element) => {
        try {
          const $row = $(element);
          const depArrText = $row.find('.dep_arr').text();
          const timeText = $row.find('.time').text();

          
          const route = this.parseRouteFromTableRow($, $row);
          if (route) {

            routes.push(route);
          } else {

          }
        } catch (error) {

        }
      });
    }


    return routes;
  }

  /**
   * 詳細表示から正確なルート情報を解析
   */
  private parseDetailedRoute(timeText: string, durationText: string, fareTransferText: string, $: cheerio.CheerioAPI, routeContainerId?: string): Route | null {
    // 時刻解析: "05:31発 →06:09着"
    const timeMatch = timeText.match(/(\d{2}:\d{2})発.*?(\d{2}:\d{2})着/);
    if (!timeMatch) {
      return null;
    }

    // 日付跨ぎを考慮した時刻処理
    const baseDate = this.getSearchDateFromHtml($);
    const departTime = this.formatTimeWithDateCrossing(timeMatch[1], baseDate);
    const arriveTime = this.formatTimeWithDateCrossing(timeMatch[2], baseDate, departTime);
    // 所要時間解析: "所要時間：38分 (バス 31分、電車 0分、徒歩 7分）"
    const durationMatch = durationText.match(/所要時間[：:](\d+)分/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
    // 乗換回数解析: "乗換：0回　運賃：230円"
    const transferMatch = fareTransferText.match(/乗換[：:](\d+)回/);
    const transfers = transferMatch ? parseInt(transferMatch[1]) : 0;

    // 運賃解析: "乗換：0回　運賃：230円"
    const fareMatch = fareTransferText.match(/運賃[：:](\d+)円/);
    const fare = fareMatch ? parseInt(fareMatch[1]) : 0;

    // 詳細なセグメント情報を抽出（特定のルートに限定）
    const legs = this.extractDetailedLegs($, routeContainerId);

    // legsが空の場合はフォールバック実装を使用
    const finalLegs = legs.length > 0 ? legs : [{
      mode: 'bus' as const, // デフォルトでバス
      duration_min: duration,
      fare_jpy: fare
    }];

    return {
      summary: {
        depart: departTime,
        arrive: arriveTime,
        duration_min: duration,
        transfers,
        fare_jpy: fare
      },
      legs: finalLegs
    };
  }

  /**
   * 詳細表示からセグメント別の正確な情報を抽出
   */
  private extractDetailedLegs($: cheerio.CheerioAPI, routeContainerId?: string): RouteLeg[] {
    const legs: RouteLeg[] = [];
    
    // 特定のルートが指定されている場合はそのルートの詳細のみを検索
    let detailRows;
    if (routeContainerId) {
      detailRows = $(`#${routeContainerId} table tr`);

    } else {
      // 詳細表示を検索（result-0, result-1など、または最初に見つかった詳細表示）
      detailRows = $('[id^="result-"] table tr, .block table tr');

    }
    
    // 詳細表示が見つからない場合は空の配列を返す
    if (detailRows.length === 0) {

      return legs;
    }
    
    let currentFromStation = '';
    let currentFromFare = 0;
    let currentFromTime = '';
    let pendingTransportInfo: { mode: string; line: string; duration: number; stops: number } | null = null;
    
    // 基準日付を取得
    const baseDate = this.getSearchDateFromHtml($);
    
    detailRows.each((index, element) => {
      const $row = $(element);
      
      // 地点行 (color-grクラス): 駅・バス停情報と運賃
      if ($row.hasClass('color-gr')) {

        
        // 駅名を抽出（ラベルとプラットフォーム情報を除去）
        const $stationBox = $row.find('.box-2').clone();
        // platform要素を除去
        $stationBox.find('.platform').remove();
        const stationFullText = $stationBox.text();
        const stationName = stationFullText
          .replace(/出発地|目的地|乗換|の印/g, '')
          .replace(/\([^)]*\)$/, '') // 末尾の括弧内情報を除去 (例: "(のりばA(東行き))")
          .replace(/\s*(のりば[^\s]*|[０-９\d]+番線[^\s]*)/g, '') // プラットフォーム情報を除去
          .replace(/\s*(北行き|南行き|東行き|西行き|上り|下り)$/, '') // 方向情報を除去
          .trim();
        
        const fareText = $row.find('.box-3 b').text();
        const fareMatch = fareText.match(/(\d+)円/);
        const stationFare = fareMatch ? parseInt(fareMatch[1]) : 0;
        
        // 時刻情報を抽出
        const stationTimes = this.extractTimesFromStationRow($, $row);
        let arrivalTime = '';
        let departureTime = '';
        
        try {
          if (stationTimes.arrivalTime) {
            arrivalTime = this.formatTimeWithDateCrossing(stationTimes.arrivalTime, baseDate, currentFromTime);
          }
          if (stationTimes.departureTime) {
            departureTime = this.formatTimeWithDateCrossing(stationTimes.departureTime, baseDate, arrivalTime || currentFromTime);
          }
        } catch (error) {
          // 時刻解析に失敗した場合は空文字列のまま処理を継続

        }

        
        // 保留中の移動情報がある場合、前のセグメントを作成
        if (pendingTransportInfo && currentFromStation) {

          
          const leg: RouteLeg = {
            mode: pendingTransportInfo.mode as 'bus' | 'train' | 'walk',
            line: pendingTransportInfo.line || undefined,
            from: currentFromStation,
            to: stationName,
            depart_time: currentFromTime || undefined,
            arrive_time: arrivalTime || undefined,
            duration_min: pendingTransportInfo.duration,
            stops: pendingTransportInfo.stops > 0 ? pendingTransportInfo.stops : undefined,
            // 出発駅の運賃をこのセグメントに適用
            fare_jpy: pendingTransportInfo.mode === 'walk' ? 0 : currentFromFare
          };
          
          legs.push(leg);
          pendingTransportInfo = null;
        }
        
        // 現在の駅を次のセグメントの出発駅として設定
        currentFromStation = stationName;
        currentFromFare = stationFare;
        // 出発時刻を更新（次のセグメントの開始時刻として使用）
        currentFromTime = departureTime || arrivalTime;
      }
      // 移動行: 交通手段情報
      else if ($row.find('.box-8').length > 0) {
        const transportText = $row.find('.box-8').text();
        const durationText = $row.find('.box-6 span').text() || $row.find('.box-6').text();
        const stopsText = $row.find('.box-9').text();
        

        
        // 所要時間を抽出
        const durationMatch = durationText.match(/(\d+)分/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
        
        // 停留所数・駅数を抽出
        const stopsMatch = stopsText.match(/(\d+)(停留所|駅)乗車/);
        const stops = stopsMatch ? parseInt(stopsMatch[1]) : 0;
        
        // 交通手段を判定
        let mode: string;
        let line = '';
        
        if (transportText.includes('徒歩')) {
          mode = 'walk';
          line = '徒歩';
        } else if (transportText.includes('バス') || transportText.includes('市バス')) {
          mode = 'bus';
          line = transportText;
        } else {
          mode = 'train';
          line = transportText;
        }
        

        
        // 移動情報を保留（次の駅情報と合わせてセグメントを作成するため）
        pendingTransportInfo = { mode, line, duration, stops };
      }
    });
    

    return legs;
  }

  /**
   * テーブル行からルート情報を解析
   */
  private parseRouteFromTableRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<any>): Route | null {
    const depArrText = $row.find('.dep_arr').text();
    const timeText = $row.find('.time').text();
    const xferText = $row.find('.xfer').text();
    const fareText = $row.find('.fare').text();
    // 時刻解析
    const timeMatch = depArrText.match(/(\d{2}:\d{2})発.*?(\d{2}:\d{2})着/);
    if (!timeMatch) {
      return null;
    }

    const departTime = this.formatTime(timeMatch[1], $);
    const arriveTime = this.formatTime(timeMatch[2], $);
    // 所要時間解析
    const durationMatch = timeText.match(/(\d+)分/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;

    // 乗換回数解析
    const transferMatch = xferText.match(/(\d+)回/);
    const transfers = transferMatch ? parseInt(transferMatch[1]) : 0;

    // 運賃解析
    const fareMatch = fareText.match(/(\d+)円/);
    const fare = fareMatch ? parseInt(fareMatch[1]) : 0;

    // 簡易的な区間情報（詳細は取得困難）
    const legs: RouteLeg[] = [{
      mode: 'bus', // アイコンから判定可能だが簡略化
      duration_min: duration,
      fare_jpy: fare
    }];

    return {
      summary: {
        depart: departTime,
        arrive: arriveTime,
        duration_min: duration,
        transfers,
        fare_jpy: fare
      },
      legs
    };
  }

  /**
   * 時刻を ISO-8601 形式にフォーマット
   */
  private formatTime(timeStr: string, $?: cheerio.CheerioAPI): string {
    let year: number, month: string, day: string;
    
    // HTMLから検索日付を取得（dt フィールドから "2025/07/7" 形式）
    if ($ && $('input[name="dt"]').length > 0) {
      const dtValue = $('input[name="dt"]').attr('value');
      if (dtValue && dtValue.includes('/')) {
        const [yearStr, monthStr, dayStr] = dtValue.split('/');
        year = parseInt(yearStr);
        month = monthStr.padStart(2, '0');
        day = dayStr.padStart(2, '0');
      } else {
        // フォールバック：今日の日付
        const today = new Date();
        year = today.getFullYear();
        month = String(today.getMonth() + 1).padStart(2, '0');
        day = String(today.getDate()).padStart(2, '0');
      }
    } else {
      // フォールバック：今日の日付
      const today = new Date();
      year = today.getFullYear();
      month = String(today.getMonth() + 1).padStart(2, '0');
      day = String(today.getDate()).padStart(2, '0');
    }
    
    // HH:MM 形式の時刻を抽出
    const timeMatch = timeStr.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      const formattedTime = `${year}-${month}-${day}T${timeMatch[1]}:${timeMatch[2]}`;
      return formattedTime;
    }
    
    const fallbackTime = `${year}-${month}-${day}T${timeStr}`;
    return fallbackTime;
  }

  /**
   * HTMLから検索基準日付を取得
   */
  private getSearchDateFromHtml($: cheerio.CheerioAPI): Date {
    const dtValue = $('input[name="dt"]').attr('value');
    if (dtValue && dtValue.includes('/')) {
      const [yearStr, monthStr, dayStr] = dtValue.split('/');
      return new Date(parseInt(yearStr), parseInt(monthStr) - 1, parseInt(dayStr));
    }
    // フォールバック：今日の日付
    return new Date();
  }

  /**
   * 日付跨ぎを考慮した時刻フォーマット
   */
  private formatTimeWithDateCrossing(timeStr: string, baseDate: Date, previousTime?: string): string {
    const timeMatch = timeStr.match(/(\d{2}):(\d{2})/);
    if (!timeMatch) {
      return '';
    }

    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    
    // 現在の日付から開始
    const currentDate = new Date(baseDate);
    
    // 前の時刻がある場合、日付跨ぎを判定
    if (previousTime) {
      const prevMatch = previousTime.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (prevMatch) {
        const prevYear = parseInt(prevMatch[1]);
        const prevMonth = parseInt(prevMatch[2]) - 1; // Dateは0ベース
        const prevDay = parseInt(prevMatch[3]);
        const prevHours = parseInt(prevMatch[4]);
        const prevMinutes = parseInt(prevMatch[5]);
        
        // 前の時刻の日付を設定
        const prevDate = new Date(prevYear, prevMonth, prevDay);
        
        // 深夜（0-5時）で前の時刻が夜（18時以降）の場合は翌日とみなす
        if (hours >= 0 && hours <= 5 && prevHours >= 18) {
          currentDate.setTime(prevDate.getTime());
          currentDate.setDate(currentDate.getDate() + 1);
        }
        // 通常の時刻比較による日付跨ぎ判定
        else {
          const prevTotalMinutes = prevHours * 60 + prevMinutes;
          const currentTotalMinutes = hours * 60 + minutes;
          
          // 現在の時刻が前の時刻より小さく、差が大きい場合（日付跨ぎ）
          if (currentTotalMinutes < prevTotalMinutes && (prevTotalMinutes - currentTotalMinutes) > 60) {
            currentDate.setTime(prevDate.getTime());
            currentDate.setDate(currentDate.getDate() + 1);
          } else {
            // 同日の場合は前の時刻の日付を使用
            currentDate.setTime(prevDate.getTime());
          }
        }
      }
    }
    
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${timeMatch[1]}:${timeMatch[2]}`;
  }

  /**
   * color-gr行から時刻情報を抽出
   */
  private extractTimesFromStationRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<any>): { departureTime?: string; arrivalTime?: string } {
    const timeElements = $row.find('.box-1 span');
    const times: { departureTime?: string; arrivalTime?: string } = {};
    
    timeElements.each((i, el) => {
      const timeText = $(el).text();
      const departureMatch = timeText.match(/(\d{2}:\d{2})発/);
      const arrivalMatch = timeText.match(/(\d{2}:\d{2})着/);
      
      if (departureMatch) {
        times.departureTime = departureMatch[1];
      }
      if (arrivalMatch) {
        times.arrivalTime = arrivalMatch[1];
      }
    });
    
    return times;
  }


} 