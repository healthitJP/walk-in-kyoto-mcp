import { StopSearchRequest, StopSearchResponse, StopCandidate, StopRecord, LandmarkRecord, Language } from '../types/index.js';
import { MasterDataLoader } from './MasterDataLoader.js';
import { TokenLimiter } from '../utils/TokenLimiter.js';
import { RequestValidator } from '../utils/RequestValidator.js';

/**
 * 検索結果の関連度情報
 */
interface SearchMatch {
  candidate: StopCandidate;
  relevanceScore: number;
}

/**
 * 駅・バス停・ランドマークの部分一致検索サービス
 */
export class StopSearchService {
  private masterDataLoader: MasterDataLoader;
  private tokenLimiter: TokenLimiter;
  private requestValidator: RequestValidator;

  constructor() {
    this.masterDataLoader = new MasterDataLoader();
    this.tokenLimiter = new TokenLimiter();
    this.requestValidator = new RequestValidator();
  }

  /**
   * 駅・バス停・ランドマークを検索する
   * @param request 検索リクエスト
   * @returns 検索結果
   */
  async search(request: StopSearchRequest): Promise<StopSearchResponse> {
    // 入力検証
    this.requestValidator.validateStopSearchRequest(request);

    // 空クエリの場合は空の結果を返す
    if (!request.query.trim()) {
      return {
        candidates: [],
        truncated: false
      };
    }

    // データを読み込み
    const [stops, landmarks] = await Promise.all([
      this.masterDataLoader.loadStops(request.language),
      this.masterDataLoader.loadLandmarks(request.language)
    ]);

    // 検索実行
    const matches = this.performSearch(request.query, stops, landmarks, request.language);

    // 関連度でソート
    const sortedMatches = matches.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 候補リストを作成
    const candidates = sortedMatches.map(match => match.candidate);

    // トークン制限を適用
    const response: StopSearchResponse = {
      candidates,
      truncated: false
    };

    const limitResult = this.tokenLimiter.applyLimit(response, request.max_tokens);
    
    return {
      candidates: (limitResult.data as StopSearchResponse).candidates,
      truncated: limitResult.truncated
    };
  }

  /**
   * 検索を実行する
   * @param query 検索クエリ
   * @param stops 駅・バス停データ
   * @param landmarks ランドマークデータ
   * @param language 言語
   * @returns 検索結果
   */
  private performSearch(
    query: string, 
    stops: StopRecord[], 
    landmarks: LandmarkRecord[], 
    language: Language
  ): SearchMatch[] {
    const normalizedQuery = this.normalizeSearchTerm(query);
    const matches: SearchMatch[] = [];

    // 駅・バス停を検索
    for (const stop of stops) {
      const primaryName = language === 'ja' ? stop.name_ja : stop.name_en;
      const secondaryName = language === 'ja' ? stop.name_en : stop.name_ja;
      
      // 主要言語での検索
      const normalizedPrimaryName = this.normalizeSearchTerm(primaryName);
      const primaryScore = this.calculateRelevanceScore(normalizedQuery, normalizedPrimaryName);
      
      // 補助言語での検索（スコアを少し下げる）
      const normalizedSecondaryName = this.normalizeSearchTerm(secondaryName);
      const secondaryScore = this.calculateRelevanceScore(normalizedQuery, normalizedSecondaryName) * 0.8;
      
      const relevanceScore = Math.max(primaryScore, secondaryScore);

      if (relevanceScore > 0) {
        matches.push({
          candidate: {
            name: primaryName,
            kind: stop.kind,
            id: stop.id
          },
          relevanceScore
        });
      }
    }

    // ランドマークを検索
    for (const landmark of landmarks) {
      const primaryName = language === 'ja' ? landmark.name_ja : landmark.name_en;
      const secondaryName = language === 'ja' ? landmark.name_en : landmark.name_ja;
      
      // 主要言語での検索
      const normalizedPrimaryName = this.normalizeSearchTerm(primaryName);
      const primaryScore = this.calculateRelevanceScore(normalizedQuery, normalizedPrimaryName);
      
      // 補助言語での検索（スコアを少し下げる）
      const normalizedSecondaryName = this.normalizeSearchTerm(secondaryName);
      const secondaryScore = this.calculateRelevanceScore(normalizedQuery, normalizedSecondaryName) * 0.8;
      
      const relevanceScore = Math.max(primaryScore, secondaryScore);

      if (relevanceScore > 0) {
        matches.push({
          candidate: {
            name: primaryName,
            kind: 'landmark',
            id: landmark.id
          },
          relevanceScore
        });
      }
    }

    return matches;
  }

  /**
   * 検索語を正規化する
   * @param term 検索語
   * @returns 正規化された検索語
   */
  private normalizeSearchTerm(term: string): string {
    return term
      .toLowerCase()
      .normalize('NFKC') // 全角半角統一
      .replace(/[ァ-ヶ]/g, char => 
        String.fromCharCode(char.charCodeAt(0) - 0x60) // カタカナをひらがなに変換
      )
      .replace(/\s+/g, '') // 空白を除去
      .replace(/[()（）]/g, ''); // 括弧を除去
  }

  /**
   * 関連度スコアを計算する
   * @param query 正規化されたクエリ
   * @param target 正規化されたターゲット文字列
   * @returns 関連度スコア（0-100）
   */
  private calculateRelevanceScore(query: string, target: string): number {
    if (!target.includes(query)) {
      return 0;
    }

    // 完全一致
    if (query === target) {
      return 100;
    }

    // 前方一致
    if (target.startsWith(query)) {
      return 80;
    }

    // 後方一致
    if (target.endsWith(query)) {
      return 70;
    }

    // 部分一致（位置による重み付け）
    const position = target.indexOf(query);
    const lengthRatio = query.length / target.length;
    
    // 前の方にある方が関連度が高い
    const positionScore = Math.max(0, 50 - (position * 5));
    
    // クエリが長い方が関連度が高い
    const lengthScore = lengthRatio * 30;
    
    return Math.min(60, positionScore + lengthScore);
  }

  /**
   * リソースのクリーンアップ
   */
  destroy(): void {
    this.tokenLimiter.destroy();
  }
} 