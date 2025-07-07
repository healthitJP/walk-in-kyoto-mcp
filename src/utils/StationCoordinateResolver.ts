import { Master } from '../types';
import { loadMaster } from '../data';

/**
 * 駅名から緯度経度を解決するクラス
 * 単一責任原則：駅名→緯度経度の変換のみを担当
 */
export class StationCoordinateResolver {
  private masterDataJa: Master;
  private masterDataEn: Master;

  constructor() {
    this.masterDataJa = loadMaster('ja');
    this.masterDataEn = loadMaster('en');
  }

  /**
   * 駅名から緯度経度を取得
   * @param stationName 駅名（例：「浄土寺 (京都市バス)」または「浄土寺(京都市バス)」）
   * @param language 言語
   * @returns 緯度経度オブジェクトまたはnull
   */
  resolveCoordinates(stationName: string, language: 'ja' | 'en' = 'ja'): { lat: number; lng: number } | null {
    const masterData = language === 'ja' ? this.masterDataJa : this.masterDataEn;
    
    // 1. そのまま検索
    let station = masterData.station[stationName];
    if (station) {
      return { lat: station.lat, lng: station.lng };
    }
    
    // 2. 半角スペースを削除して検索（レスポンス内の「浄土寺 (京都市バス)」→「浄土寺(京都市バス)」）
    const normalizedName = stationName.replace(/\s+/g, '');
    station = masterData.station[normalizedName];
    if (station) {
      return { lat: station.lat, lng: station.lng };
    }
    
    // 3. 完全一致しない場合は部分一致で検索
    const partialMatches = Object.keys(masterData.station).filter(key => 
      key.includes(normalizedName) || normalizedName.includes(key)
    );
    
    if (partialMatches.length > 0) {
      const firstMatch = masterData.station[partialMatches[0]];
      if (firstMatch) {
        return { lat: firstMatch.lat, lng: firstMatch.lng };
      }
    }
    
    return null;
  }

  /**
   * 複数の駅名を一括で緯度経度に変換
   * @param stationNames 駅名配列
   * @param language 言語
   * @returns 緯度経度の配列（見つからない場合はnull）
   */
  resolveMultipleCoordinates(
    stationNames: string[], 
    language: 'ja' | 'en' = 'ja'
  ): ({ lat: number; lng: number } | null)[] {
    return stationNames.map(name => this.resolveCoordinates(name, language));
  }
} 