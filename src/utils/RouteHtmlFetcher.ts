import axios, { AxiosRequestConfig } from 'axios';
import { RouteSearchParams, Master, LandmarkData } from '../types';
import { loadMaster, loadLandmarkData } from '../data';

/**
 * HTML取得のオプション
 */
interface FetchOptions {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
}

/**
 * 近隣駅のランキング構造
 */
interface StationRanking {
  len: number;
  name: string;
  lat: number;
  lng: number;
  ekidiv: string;
  extra: number;
}

/**
 * 歩くまち京都サイトからルート検索HTMLを取得するクラス
 * 単一責任原則：HTTPリクエストのみを担当
 */
export class RouteHtmlFetcher {
  private baseUrl: string;
  private timeout: number;
  private retries: number;
  private master: Master | null = null;
  private landmarkData: LandmarkData | null = null;

  // 京都付近での緯度と経度の距離比率
  private readonly LAT_LNG_RATIO = 912.8816392747891 / 1109.4063947762538;
  
  // 例外処理用の定数
  private readonly ARASHIYAMA_NEAR_STATIONS = '嵐山(阪急),0,嵐山(京福電気鉄道),0,嵯峨嵐山,0';
  private readonly KIYOMIZUDERA_NEAR_STATIONS = '五条坂(京都市バス),8,五条坂(京阪バス),8,清水道(京都市バス),8,清水道(京阪バス),8';
  private readonly GINKAKUJI_NEAR_STATIONS = '銀閣寺前(京都市バス),6,銀閣寺道(京都市バス),10';
  
  private readonly ARASHIYAMA_LANDMARK_CODE = 'LM00000534';  // 渡月橋
  private readonly KIYOMIZUDERA_LANDMARK_CODE = 'LM00000001';
  private readonly KINKAKUJI_LANDMARK_CODE = 'LM00002093';
  private readonly GINKAKUJI_LANDMARK_CODE = 'LM00002101';

  constructor(options: FetchOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://arukumachikyoto.jp';
    this.timeout = options.timeout || 30000; // 30秒
    this.retries = options.retries || 3;
  }

  /**
   * Master.jsデータを初期化
   */
  private async initMasterData(language: 'ja' | 'en'): Promise<void> {
    if (!this.master) {
      this.master = loadMaster(language);
    }
    if (!this.landmarkData) {
      this.landmarkData = loadLandmarkData(language);
    }
  }

  /**
   * 駅名指定でルート検索HTMLを取得
   */
  async fetchByName(
    fromStation: string,
    toStation: string,
    datetime: string,
    datetimeType: 'departure' | 'arrival',
    language: 'ja' | 'en'
  ): Promise<string> {
    await this.initMasterData(language);

    // 近隣駅リストと緯度経度を生成
    const { fromStations, fromCoords, fromType } = await this.generateNearbyStations(fromStation, language);
    const { fromStations: toStations, fromCoords: toCoords, fromType: toType } = await this.generateNearbyStations(toStation, language);

    const params: RouteSearchParams = {
      fn: fromStation,    
      tn: toStation,      
      dt: this.formatDate(datetime),    
      tm: this.formatTime(datetime),    
      fs: fromStations,   // 近隣駅リスト（カンマ区切り）
      ts: toStations,     // 近隣駅リスト（カンマ区切り）
      fl: fromCoords,     // 緯度経度
      tl: toCoords,       // 緯度経度
      de: 'n',            // delay estimation
      tt: datetimeType === 'departure' ? 'd' : 'a',  
      md: 't',            // mode (transit)
      pn: '',             // pass name (経由地)
      lang: language,
      fi: fromType,       // from type identifier
      ti: toType          // to type identifier
    };

    return this.fetchHtml(params);
  }

  /**
   * 緯度経度指定でルート検索HTMLを取得
   */
  async fetchByCoordinates(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    datetime: string,
    datetimeType: 'departure' | 'arrival',
    language: 'ja' | 'en'
  ): Promise<string> {
    console.error('🚀 [RouteHtmlFetcher] Starting coordinate-based route search...');
    console.error(`📊 Parameters:`);
    console.error(`   - From coordinates: ${fromLat}, ${fromLng}`);
    console.error(`   - To coordinates: ${toLat}, ${toLng}`);
    console.error(`   - DateTime: ${datetime}`);
    console.error(`   - DateTime type: ${datetimeType}`);
    console.error(`   - Language: ${language}`);
    
    // Master data を初期化
    console.error('🔧 Initializing master data...');
    await this.initMasterData(language);
    console.error('✅ Master data initialized');
    
    // 座標から近隣駅を計算（元サイトのget_near_stationsと同様の処理）
    console.error('🔍 Searching for nearby stations...');
    let fromStations = '';
    let toStations = '';
    
    try {
      fromStations = this.searchNearStations([fromLng, fromLat], '', 'S');
      console.error(`✅ From stations calculated: ${fromStations}`);
    } catch (error) {
      console.error(`❌ Error calculating from stations: ${error instanceof Error ? error.message : error}`);
    }
    
    try {
      toStations = this.searchNearStations([toLng, toLat], '', 'S');
      console.error(`✅ To stations calculated: ${toStations}`);
    } catch (error) {
      console.error(`❌ Error calculating to stations: ${error instanceof Error ? error.message : error}`);
    }
    
    console.error(`🚉 Calculated nearby stations:`);
    console.error(`   - From stations: ${fromStations}`);
    console.error(`   - To stations: ${toStations}`);
    
    const params: RouteSearchParams = {
      fn: '',  // 座標検索では名前は空
      tn: '',
      dt: this.formatDate(datetime),
      tm: this.formatTime(datetime),
      fs: fromStations,  // 座標から計算した近隣駅リスト
      ts: toStations,    // 座標から計算した近隣駅リスト
      fl: `${fromLat},${fromLng}`,
      tl: `${toLat},${toLng}`,
      de: 'n',
      tt: datetimeType === 'departure' ? 'd' : 'a',
      md: 't',
      pn: '',
      lang: language,
      fi: 'S', // 座標検索はSpot
      ti: 'S'
    };

    console.error(`🔗 Formatted parameters:`, params);

    return this.fetchHtml(params);
  }

  /**
   * 駅名から近隣駅リストと緯度経度を生成
   * 元サイトのget_near_stations_all関数のロジックに基づく実装
   */
  private async generateNearbyStations(stationName: string, language: 'ja' | 'en'): Promise<{
    fromStations: string;
    fromCoords: string;
    fromType: string;
  }> {
    if (!this.master || !this.landmarkData) {
      throw new Error('Master data not initialized');
    }

    // スポットの特別な例外処理
    const arashiyamaName = language === 'en' ? 'Arashiyama' : '嵐山';
    if (stationName === arashiyamaName) {
      return {
        fromStations: this.ARASHIYAMA_NEAR_STATIONS,
        fromCoords: '', // 特別ケースでは空
        fromType: 'S'
      };
    }

    // 清水寺のチェック
    const kiyomizuderaLandmark = this.landmarkData.data[this.KIYOMIZUDERA_LANDMARK_CODE];
    if (kiyomizuderaLandmark && stationName === kiyomizuderaLandmark.name) {
      return {
        fromStations: this.KIYOMIZUDERA_NEAR_STATIONS,
        fromCoords: `${kiyomizuderaLandmark.lat},${kiyomizuderaLandmark.lng}`,
        fromType: 'S'
      };
    }

    // 銀閣寺のチェック
    const ginkakujiLandmark = this.landmarkData.data[this.GINKAKUJI_LANDMARK_CODE];
    if (ginkakujiLandmark && stationName === ginkakujiLandmark.name) {
      return {
        fromStations: this.GINKAKUJI_NEAR_STATIONS,
        fromCoords: `${ginkakujiLandmark.lat},${ginkakujiLandmark.lng}`,
        fromType: 'S'
      };
    }

    // 事業者名付きの駅名処理
    // "浄土寺(京都市バス)" -> "浄土寺" に変換
    const baseStationName = stationName.replace(/\([^)]+\)$/, '');
    
    // 直接事業者名付きで駅情報を検索（最初に試行）
    const directStation = this.master.station[stationName];
    if (directStation) {
      // 直接検索でヒットした場合
      const nearStations = this.searchNearStations([directStation.lng, directStation.lat], stationName, directStation.ekidiv);
      
      return {
        fromStations: nearStations,
        fromCoords: `${directStation.lat},${directStation.lng}`,
        fromType: directStation.ekidiv
      };
    }

    // 駅・バス停での検索（事業者名なしの駅名で検索）
    const stationSelect = this.master.stationselect[baseStationName];
    if (stationSelect) {
      // 鉄道駅とバス停の種別判定
      let railStations: any[] = [];
      let busStations: any[] = [];
      
      for (const stationInfo of stationSelect.stationnames) {
        const station = this.master.station[stationInfo.stationname];
        if (station) {
          if (station.ekidiv === 'R') {
            railStations.push(station);
          } else if (station.ekidiv === 'B') {
            busStations.push(station);
          }
        }
      }

      // 元の駅名に事業者名が含まれている場合は、その事業者の駅を優先
      let targetStations: any[] = [];
      let stationType: string = 'B';
      
      if (stationName !== baseStationName) {
        // 事業者名が指定されている場合
        for (const stationInfo of stationSelect.stationnames) {
          if (stationInfo.stationname === stationName) {
            const station = this.master.station[stationInfo.stationname];
            if (station) {
              targetStations = [station];
              stationType = station.ekidiv;
              break;
            }
          }
        }
      }
      
      // 指定された事業者の駅が見つからない場合は従来の優先順位
      if (targetStations.length === 0) {
        targetStations = railStations.length > 0 ? railStations : busStations;
        stationType = railStations.length > 0 ? 'R' : 'B';
      }

      if (targetStations.length > 0) {
        // 平均緯度経度を計算
        let lat = 0, lng = 0;
        for (const station of targetStations) {
          lat += station.lat;
          lng += station.lng;
        }
        lat /= targetStations.length;
        lng /= targetStations.length;

        // 近隣駅を検索
        const nearStations = this.searchNearStations([lng, lat], baseStationName, stationType);
        
        return {
          fromStations: nearStations,
          fromCoords: `${lat},${lng}`,
          fromType: stationType
        };
      }
    }

    // 観光スポットでの検索
    for (const code in this.landmarkData.data) {
      const landmark = this.landmarkData.data[code];
      if (landmark.name === stationName && landmark.lat && landmark.lng) {
        const nearStations = this.searchNearStations([landmark.lng, landmark.lat], '', 'S');
        
        return {
          fromStations: nearStations,
          fromCoords: `${landmark.lat},${landmark.lng}`,
          fromType: 'S'
        };
      }
    }

    // デフォルトパターン（見つからない場合）
    console.warn(`Station not found in master data: ${stationName}, using default pattern`);
    return {
      fromStations: `${stationName},0`, // 最低限の形式
      fromCoords: '35.0,135.7', // デフォルト京都市内座標
      fromType: 'B' // デフォルトはBus
    };
  }

  /**
   * 近隣駅検索（元サイトのsearch_near_stations_all関数のロジック）
   */
  private searchNearStations(lonLat: [number, number], name: string, type: string): string {
    if (!this.master) {
      throw new Error('Master data not initialized');
    }

    const nearSpotsNumber = this.master.coefficient.SEARCH_NEAR_SPOTS_NUMBER || 10;
    const ranking: StationRanking[] = [];
    
    // ランキング配列を初期化
    for (let i = 0; i < nearSpotsNumber; i++) {
      ranking[i] = { len: Number.MAX_VALUE, name: '', lat: 0, lng: 0, ekidiv: 'B', extra: 1 };
    }

    let rMin: StationRanking = {
      len: Number.MAX_VALUE, 
      name: '', 
      lat: 0, 
      lng: 0, 
      ekidiv: 'R', 
      extra: 1
    };

    // 全駅を検索して距離を計算
    for (const stationName in this.master.station) {
      const sinfo = this.master.station[stationName];
      
      // 同名駅の場合はスキップして0距離とする
      const station = this.master.station[stationName];
      if (station && station.selectname === name && station.ekidiv === type) {
        // 同名駅を探してランキングに追加
        for (let j = 0; j < ranking.length; j++) {
          if (ranking[j].name === '' || ranking[j].name === stationName) {
            ranking[j] = {
              len: 0,
              name: stationName,
              lat: sinfo.lat,
              lng: sinfo.lng,
              ekidiv: sinfo.ekidiv,
              extra: 0
            };
            break;
          }
        }
        continue;
      }

      // 距離計算（元サイトのロジック）
      const len = Math.pow(lonLat[1] - sinfo.lat, 2) + 
                  Math.pow(lonLat[0] - sinfo.lng, 2) * Math.pow(this.LAT_LNG_RATIO, 2);

      // ランキングに挿入
      for (let j = 0; j < ranking.length; j++) {
        if (ranking[j].name === '' || ranking[j].len > len) {
          // 配列をシフト
          for (let k = ranking.length - 1; k > j; k--) {
            ranking[k] = { ...ranking[k-1] };
          }
          ranking[j] = {
            len,
            name: stationName,
            lat: sinfo.lat,
            lng: sinfo.lng,
            ekidiv: sinfo.ekidiv,
            extra: 0
          };
          break;
        }
      }

      // 最も近い鉄道駅を記録
      if (sinfo.ekidiv === 'R' && rMin.len > len) {
        rMin = {
          len,
          name: stationName,
          lat: sinfo.lat,
          lng: sinfo.lng,
          ekidiv: 'R',
          extra: 1
        };
      }
    }

    // 鉄道駅が含まれていない場合は追加
    const hasRailStation = ranking.some(r => r.ekidiv === 'R');
    if (!hasRailStation && rMin.name) {
      ranking.push(rMin);
    }

    // 結果文字列を生成（簡易版：実際はOSM Matrix APIで歩行時間を計算）
    let result = '';
    for (const station of ranking) {
      if (station.name && station.extra === 0) {
        // 簡易的に距離ベースで歩行時間を推定（1km = 約12分）
        const walkingTime = station.len === 0 ? 0 : Math.ceil(Math.sqrt(station.len) * 111.32 / 5.0); // 時速5km想定
        const clampedTime = Math.min(walkingTime, 15); // 15分以内に制限
        
        // axiosが自動的にエンコードするため、ここではエンコードしない
        result += `${station.name},${clampedTime},`;
      }
    }

    return result.slice(0, -1); // 最後のカンマを削除
  }

  /**
   * パラメータを指定してHTMLを取得
   */
  private async fetchHtml(params: RouteSearchParams): Promise<string> {
    const formattedParams = this.formatParams(params);
    const config: AxiosRequestConfig = {
      method: 'GET',
      url: `${this.baseUrl}/search_result.php`,  // 正しいエンドポイント
      params: formattedParams,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': `${params.lang},en-US;q=0.5`,
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': `${this.baseUrl}/`,  // 重要: リファラーを設定
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    };

    // 完全なURLを構築してログ出力（stderrに出力してMCPプロトコルを破壊しないように）
    const queryString = new URLSearchParams(formattedParams).toString();
    const fullUrl = `${config.url}?${queryString}`;
    console.error(`🌐 Complete GET Request URL: ${fullUrl}`);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        console.error(`🔄 Attempt ${attempt}/${this.retries}: Fetching route HTML...`);
        console.error(`📍 URL: ${config.url}`);
        console.error(`📋 Params:`, this.formatParams(params));
        
        const response = await axios(config);
        
        console.error(`✅ Response received: ${response.status} ${response.statusText}`);
        console.error(`📄 Content length: ${response.data.length} characters`);
        
        if (response.status === 200 && response.data) {
          return response.data;
        } else {
          throw new Error(`Invalid response: ${response.status}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ Attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < this.retries) {
          const delay = attempt * 1000; // 1秒, 2秒, 3秒...
          console.error(`⏳ Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to fetch route HTML after ${this.retries} attempts: ${lastError?.message}`);
  }

  /**
   * パラメータをURL用にフォーマット
   */
  private formatParams(params: RouteSearchParams): Record<string, string> {
    // URLエンコーディングは axios が自動で行うため、ここでは値をそのまま渡す
    return {
      fn: params.fn,
      tn: params.tn,
      dt: params.dt,
      tm: params.tm,
      fs: params.fs,
      ts: params.ts,
      fl: params.fl,
      tl: params.tl,
      de: params.de,
      tt: params.tt,
      md: params.md,
      pn: params.pn,
      lang: params.lang,
      fi: params.fi,
      ti: params.ti
    };
  }

  private formatDate(datetime: string): string {
    const date = new Date(datetime);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString(); // パディングなし：成功URLは "2025/07/7"
    const day = date.getDate().toString();
    return `${year}/${month}/${day}`;
  }

  private formatTime(datetime: string): string {
    const date = new Date(datetime);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
} 