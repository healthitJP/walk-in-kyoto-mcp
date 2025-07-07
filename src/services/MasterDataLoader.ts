import { Language, StopRecord, LandmarkRecord, Master, LandmarkData } from '../types';
import { loadMaster, loadLandmarkData } from '../data';

/**
 * マスターデータとランドマークデータを読み込み、
 * StopRecord[]とLandmarkRecord[]に変換してキャッシュする
 */
export class MasterDataLoader {
  private stopsCache: Map<Language, StopRecord[]> = new Map();
  private landmarksCache: Map<Language, LandmarkRecord[]> = new Map();

  /**
   * 指定された言語のマスターデータからStopRecord[]を生成
   * @param language 言語設定
   * @returns StopRecord[]
   */
  async loadStops(language: Language): Promise<StopRecord[]> {
    // 入力検証
    if (language !== 'ja' && language !== 'en') {
      throw new Error('Unsupported language');
    }

    // キャッシュから返す
    if (this.stopsCache.has(language)) {
      return this.stopsCache.get(language)!;
    }

    // 両言語のデータを読み込み
    const jaData = await this.loadMasterData('ja');
    const enData = await this.loadMasterData('en');

    const stops: StopRecord[] = [];

    // 駅・バス停データを処理
    Object.entries(jaData.station).forEach(([stationName, stationInfo]) => {
      // 対応する英語名を探す
      const jaSelectName = stationInfo.selectname;
      const enSelectName = this.findEnglishSelectName(jaSelectName, jaData, enData);
      const enStationName = this.findEnglishStationName(stationName, enData);

      // 会社情報から種別を判定
      const companyId = this.findCompanyIdForStation(stationName, jaData);
      const company = jaData.company[companyId.toString()];
      const kind: 'bus_stop' | 'train_station' = company?.ekidiv === 'B' ? 'bus_stop' : 'train_station';

      // IDを生成
      const prefix = kind === 'bus_stop' ? 'B' : 'T';
      const id = `${prefix}:${companyId}_${stationName}`;

      const stopRecord: StopRecord = {
        id,
        name_ja: stationName,
        name_en: enStationName || stationName, // 英語名が見つからない場合は日本語名をフォールバック
        kind,
        lat: stationInfo.lat,
        lng: stationInfo.lng,
        agency: company?.name
      };

      stops.push(stopRecord);
    });

    // 結果をキャッシュ
    this.stopsCache.set(language, stops);
    return stops;
  }

  /**
   * 指定された言語のランドマークデータからLandmarkRecord[]を生成
   * @param language 言語設定
   * @returns LandmarkRecord[]
   */
  async loadLandmarks(language: Language): Promise<LandmarkRecord[]> {
    // 入力検証
    if (language !== 'ja' && language !== 'en') {
      throw new Error('Unsupported language');
    }

    // キャッシュから返す
    if (this.landmarksCache.has(language)) {
      return this.landmarksCache.get(language)!;
    }

    // 両言語のデータを読み込み
    const jaData = await this.loadLandmarkDataInternal('ja');
    const enData = await this.loadLandmarkDataInternal('en');

    const landmarks: LandmarkRecord[] = [];

    // ランドマークデータを処理
    Object.entries(jaData.data).forEach(([landmarkId, jaLandmarkInfo]) => {
      const enLandmarkInfo = enData.data[landmarkId];

      const landmarkRecord: LandmarkRecord = {
        id: landmarkId,
        name_ja: (jaLandmarkInfo as any).name,
        name_en: (enLandmarkInfo as any)?.name || (jaLandmarkInfo as any).name, // 英語名が見つからない場合は日本語名をフォールバック
        lat: (jaLandmarkInfo as any).lat,
        lng: (jaLandmarkInfo as any).lng,
        category: ((jaLandmarkInfo as any).category || 0).toString() // 数値を文字列に変換、undefinedの場合は0
      };

      landmarks.push(landmarkRecord);
    });

    // 結果をキャッシュ
    this.landmarksCache.set(language, landmarks);
    return landmarks;
  }

  /**
   * マスターデータを読み込む
   * @param language 言語設定
   * @returns Master
   */
  private async loadMasterData(language: Language): Promise<Master> {
    return loadMaster(language);
  }

  /**
   * ランドマークデータを読み込む
   * @param language 言語設定
   * @returns LandmarkData
   */
  private async loadLandmarkDataInternal(language: Language): Promise<LandmarkData> {
    return loadLandmarkData(language);
  }

  /**
   * 駅名に対応する会社IDを見つける
   * @param stationName 駅名
   * @param masterData マスターデータ
   * @returns 会社ID
   */
  private findCompanyIdForStation(stationName: string, masterData: Master): number {
    // stationselectから会社IDを検索
    for (const selectInfo of Object.values(masterData.stationselect)) {
      const stationName_ = selectInfo.stationnames.find(sn => sn.stationname === stationName);
      if (stationName_) {
        return stationName_.companyid;
      }
    }
    // 見つからない場合はデフォルト値
    return 200; // 京都市バス
  }

  /**
   * 日本語のselectnameに対応する英語のselectnameを見つける
   * @param jaSelectName 日本語のselectname
   * @param jaData 日本語マスターデータ
   * @param enData 英語マスターデータ
   * @returns 英語のselectname
   */
  private findEnglishSelectName(jaSelectName: string, jaData: Master, enData: Master): string | null {
    // 日本語のstationselectでselectnameが一致するエントリを探す
    const jaEntry = Object.entries(jaData.stationselect).find(([_, info]) => 
      info.stationnames.some(sn => sn.stationname.includes(jaSelectName))
    );
    
    if (!jaEntry) return null;

    const [jaKey] = jaEntry;
    
    // 英語データで対応するキーを探す
    const enKey = Object.keys(enData.stationselect).find(key => {
      const enInfo = enData.stationselect[key];
      const jaInfo = jaData.stationselect[jaKey];
      
      // 同じ会社IDの駅名があるかチェック
      return enInfo.stationnames.some(enSn => 
        jaInfo.stationnames.some(jaSn => jaSn.companyid === enSn.companyid)
      );
    });

    return enKey || null;
  }

  /**
   * 日本語の駅名に対応する英語の駅名を見つける
   * @param jaStationName 日本語の駅名
   * @param enData 英語マスターデータ
   * @returns 英語の駅名
   */
  private findEnglishStationName(jaStationName: string, enData: Master): string | null {
    // 英語データのstationから同じ座標の駅を探す
    const enEntry = Object.entries(enData.station).find(([enName, enInfo]) => {
      // selectnameが同じものを探す（座標が同じであることを前提）
      return enInfo.selectname !== "";
    });

    return enEntry ? enEntry[0] : null;
  }
} 