import * as cheerio from 'cheerio';
import { Route, RouteLeg, RouteSummary, RouteSearchResponse } from '../types';

/**
 * 生データの区間情報
 */
interface RawLegData {
  type: string;           // busstop, station, walk, etc.
  name: string;           // 地点名
  platform?: string;     // プラットフォーム情報
  mode: string;           // bus, train, walk
  line?: string;          // 路線名
  fare?: number;          // 運賃
  duration?: number;      // 所要時間
  stops?: number;         // 停留所数
  coords?: string;        // 緯度経度
}

/**
 * HTMLからルート情報を解析してJSONに変換するクラス
 * 単一責任原則：HTML解析・変換のみを担当
 */
export class RouteHtmlParser {
  
  /**
   * HTMLからルート検索結果を解析
   */
  parseHtml(html: string): RouteSearchResponse {
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

      const routes = this.extractRoutes($);
      
      return {
        routes,
        truncated: false // トークン制限は上位層で処理
      };
    } catch (error) {
      console.error('HTML parsing error:', error);
      return {
        routes: [],
        truncated: false
      };
    }
  }

  /**
   * HTMLからルート一覧を抽出
   */
  private extractRoutes($: cheerio.CheerioAPI): Route[] {
    const routes: Route[] = [];
    
    // デバッグログをstderrに出力（MCPプロトコルを破壊しないように）
    console.error('🔄 Starting route extraction...');
    
    // まずHTMLから正確な時刻情報を取得
    console.error('📊 First extracting accurate time data from HTML...');
    const htmlRoutes = this.extractRoutesFromHtml($);
    console.error(`📊 HTML routes found: ${htmlRoutes.length}`);
    
    // 次に生データから詳細な区間情報を取得
    console.error('📊 Then extracting detailed leg data from raw data...');
    const rawRoutes = this.extractRawRoutes($);
    console.error(`📊 Raw routes found: ${rawRoutes.length}`);
    
    // HTMLと生データの情報を統合
    if (htmlRoutes.length > 0 && rawRoutes.length > 0) {
      console.error('🔗 Merging HTML time data with raw leg data...');
      for (let i = 0; i < Math.min(htmlRoutes.length, rawRoutes.length); i++) {
        const mergedRoute = {
          summary: {
            // HTMLから正確な時刻と所要時間を使用
            depart: htmlRoutes[i].summary.depart,
            arrive: htmlRoutes[i].summary.arrive,
            duration_min: htmlRoutes[i].summary.duration_min,
            transfers: htmlRoutes[i].summary.transfers,
            // 生データから正確な運賃を使用（より信頼性が高い）
            fare_jpy: rawRoutes[i].summary.fare_jpy || htmlRoutes[i].summary.fare_jpy
          },
          // 生データから詳細な区間情報を使用
          legs: rawRoutes[i].legs.length > 0 ? rawRoutes[i].legs : htmlRoutes[i].legs
        };
        
        console.error(`✅ Merged route ${i}:`, {
          depart: mergedRoute.summary.depart,
          arrive: mergedRoute.summary.arrive,
          duration: mergedRoute.summary.duration_min,
          legs: mergedRoute.legs.length
        });
        
        routes.push(mergedRoute);
      }
      console.error('✅ Using merged data (HTML times + raw details)');
    } else if (htmlRoutes.length > 0) {
      routes.push(...htmlRoutes);
      console.error('✅ Using HTML-only data');
    } else if (rawRoutes.length > 0) {
      routes.push(...rawRoutes);
      console.error('✅ Using raw-only data (time may be inaccurate)');
    }

    console.error(`🎯 Total routes extracted: ${routes.length}`);
    return routes;
  }

  /**
   * form#resultInfo の生データから解析（高精度）
   */
  private extractRawRoutes($: cheerio.CheerioAPI): Route[] {
    const routes: Route[] = [];
    
    console.error('🔍 Looking for form#resultInfo input[name^="rt"]...');
    const elements = $('form#resultInfo input[name^="rt"]');
    console.error(`📊 Found ${elements.length} raw route elements`);
    
    elements.each((index, element) => {
      const rawData = $(element).attr('value');
      console.error(`📋 Raw data ${index}:`, rawData?.substring(0, 200) + '...');
      
      if (rawData) {
        try {
          const route = this.parseRawRouteData(rawData);
          if (route) {
            console.error(`✅ Parsed route ${index}:`, {
              depart: route.summary.depart,
              arrive: route.summary.arrive,
              duration: route.summary.duration_min
            });
            routes.push(route);
          } else {
            console.error(`❌ Failed to parse route ${index}: returned null`);
          }
        } catch (error) {
          console.error(`❌ Failed to parse raw route data ${index}:`, error);
        }
      }
    });

    return routes;
  }

  /**
   * 生データ文字列を解析してRouteオブジェクトに変換
   * フォーマット: type$name$platform$id$mode$line$$fare$duration1$duration2$hash$flag$stops$stationId$...
   */
  private parseRawRouteData(rawData: string): Route | null {
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
        const fare = parseInt(segments[i + 3]) || 0;
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

        const leg: RouteLeg = {
          mode,
          line,
          from: currentName,
          to: toName,
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
    console.error(`🔄 Raw route data processed, but will use HTML for time extraction`);
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

    console.error('🔍 Looking for detailed route information...');
    
    // 詳細表示の時刻情報を取得（より正確）
    const detailElements = $('td.time_1');
    console.error(`📊 Found ${detailElements.length} detailed time elements`);
    
    detailElements.each((index, element) => {
      try {
        const timeText = $(element).text(); // "05:31発 →06:09着"
        console.error(`📋 Detail route ${index}: time_1="${timeText}"`);
        
        // 同じ行または近くの行から所要時間と乗換回数、運賃を取得
        const $parentRow = $(element).closest('tr');
        const durationText = $parentRow.find('td.time_2').text(); // "所要時間：38分 (バス 31分、電車 0分、徒歩 7分）"
        const fareTransferText = $parentRow.find('td.time_3').text(); // "乗換：0回　運賃：230円"
        
        console.error(`📋 Detail route ${index}: duration="${durationText}" fareTransfer="${fareTransferText}"`);
        
        const route = this.parseDetailedRoute(timeText, durationText, fareTransferText, $);
        if (route) {
          console.error(`✅ Parsed detailed route ${index}:`, {
            depart: route.summary.depart,
            arrive: route.summary.arrive,
            duration: route.summary.duration_min,
            fare: route.summary.fare_jpy
          });
          routes.push(route);
        }
      } catch (error) {
        console.error(`❌ Failed to parse detailed route ${index}:`, error);
      }
    });

    // 詳細表示がない場合はテーブル行から抽出（フォールバック）
    if (routes.length === 0) {
      console.error('🔍 Falling back to table row extraction...');
      const elements = $('#result_list table tr[data-href]');
      console.error(`📊 Found ${elements.length} HTML route elements`);

      elements.each((index, element) => {
        try {
          const $row = $(element);
          const depArrText = $row.find('.dep_arr').text();
          const timeText = $row.find('.time').text();
          console.error(`📋 HTML route ${index}: dep_arr="${depArrText}" time="${timeText}"`);
          
          const route = this.parseRouteFromTableRow($, $row);
          if (route) {
            console.error(`✅ Parsed HTML route ${index}:`, {
              depart: route.summary.depart,
              arrive: route.summary.arrive,
              duration: route.summary.duration_min
            });
            routes.push(route);
          } else {
            console.error(`❌ Failed to parse HTML route ${index}: returned null`);
          }
        } catch (error) {
          console.error(`❌ Failed to parse route ${index} from HTML:`, error);
        }
      });
    }

    return routes;
  }

  /**
   * 詳細表示から正確なルート情報を解析
   */
  private parseDetailedRoute(timeText: string, durationText: string, fareTransferText: string, $: cheerio.CheerioAPI): Route | null {
    console.error(`🔍 Parsing detailed route: time="${timeText}", duration="${durationText}", fareTransfer="${fareTransferText}"`);

    // 時刻解析: "05:31発 →06:09着"
    const timeMatch = timeText.match(/(\d{2}:\d{2})発.*?(\d{2}:\d{2})着/);
    if (!timeMatch) {
      console.error(`⚠️ No time match found in: "${timeText}"`);
      return null;
    }

    const departTime = this.formatTime(timeMatch[1], $);
    const arriveTime = this.formatTime(timeMatch[2], $);
    console.error(`🕒 Extracted times: depart="${departTime}", arrive="${arriveTime}"`);

    // 所要時間解析: "所要時間：38分 (バス 31分、電車 0分、徒歩 7分）"
    const durationMatch = durationText.match(/所要時間[：:](\d+)分/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
    console.error(`⏱️ Extracted duration: ${duration} minutes`);

    // 乗換回数解析: "乗換：0回　運賃：230円"
    const transferMatch = fareTransferText.match(/乗換[：:](\d+)回/);
    const transfers = transferMatch ? parseInt(transferMatch[1]) : 0;

    // 運賃解析: "乗換：0回　運賃：230円"
    const fareMatch = fareTransferText.match(/運賃[：:](\d+)円/);
    const fare = fareMatch ? parseInt(fareMatch[1]) : 0;

    console.error(`💰 Extracted: transfers=${transfers}, fare=${fare}`);

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
   * テーブル行からルート情報を解析
   */
  private parseRouteFromTableRow($: cheerio.CheerioAPI, $row: cheerio.Cheerio<any>): Route | null {
    const depArrText = $row.find('.dep_arr').text();
    const timeText = $row.find('.time').text();
    const xferText = $row.find('.xfer').text();
    const fareText = $row.find('.fare').text();

    console.error(`🔍 Table row texts: dep_arr="${depArrText}", time="${timeText}", xfer="${xferText}", fare="${fareText}"`);

    // 時刻解析
    const timeMatch = depArrText.match(/(\d{2}:\d{2})発.*?(\d{2}:\d{2})着/);
    console.error(`🕒 Time regex match:`, timeMatch);
    
    if (!timeMatch) {
      console.error(`⚠️ No time match found in dep_arr text: "${depArrText}"`);
      return null;
    }

    const departTime = this.formatTime(timeMatch[1], $);
    const arriveTime = this.formatTime(timeMatch[2], $);
    console.error(`🕒 Formatted times: depart="${departTime}", arrive="${arriveTime}"`);

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
      console.error(`📅 Found search date: ${dtValue}`);
      
      if (dtValue && dtValue.includes('/')) {
        const [yearStr, monthStr, dayStr] = dtValue.split('/');
        year = parseInt(yearStr);
        month = monthStr.padStart(2, '0');
        day = dayStr.padStart(2, '0');
        console.error(`📅 Parsed date: ${year}-${month}-${day}`);
      } else {
        // フォールバック：今日の日付
        const today = new Date();
        year = today.getFullYear();
        month = String(today.getMonth() + 1).padStart(2, '0');
        day = String(today.getDate()).padStart(2, '0');
        console.error(`📅 Fallback to today: ${year}-${month}-${day}`);
      }
    } else {
      // フォールバック：今日の日付
      const today = new Date();
      year = today.getFullYear();
      month = String(today.getMonth() + 1).padStart(2, '0');
      day = String(today.getDate()).padStart(2, '0');
      console.error(`📅 No search date found, using today: ${year}-${month}-${day}`);
    }
    
    // HH:MM 形式の時刻を抽出
    const timeMatch = timeStr.match(/(\d{2}):(\d{2})/);
    if (timeMatch) {
      const formattedTime = `${year}-${month}-${day}T${timeMatch[1]}:${timeMatch[2]}`;
      console.error(`🕒 Formatted time: "${timeStr}" → "${formattedTime}"`);
      return formattedTime;
    }
    
    const fallbackTime = `${year}-${month}-${day}T${timeStr}`;
    console.error(`🕒 Fallback format: "${timeStr}" → "${fallbackTime}"`);
    return fallbackTime;
  }

  /**
   * 到着時刻から出発時刻を逆算
   */
  private calculateDepartTime(arriveTime: string, durationMin: number): string {
    const arriveDate = new Date(arriveTime);
    const departDate = new Date(arriveDate.getTime() - durationMin * 60 * 1000);
    
    return departDate.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
  }
} 