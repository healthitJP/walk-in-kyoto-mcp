import { get_encoding } from 'tiktoken';
import { TokenLimitResult } from '../types';

/**
 * JSONデータのトークン数を計算し、制限を超えた場合に切り詰める
 */
export class TokenLimiter {
  private encoder;

  constructor() {
    // GPT-3.5/GPT-4で使用されるエンコーダーを初期化
    this.encoder = get_encoding('cl100k_base');
  }

  /**
   * データにトークン制限を適用する
   * @param data 対象データ
   * @param maxTokens 最大トークン数
   * @returns 制限適用後の結果
   */
  applyLimit<T>(data: T, maxTokens: number): TokenLimitResult<T> {
    const originalTokens = this.calculateTokens(data);
    
    // 制限以下の場合はそのまま返す
    if (originalTokens <= maxTokens) {
      return {
        data,
        truncated: false
      };
    }

    // 制限を超えている場合は切り詰め
    const truncatedData = this.truncateData(data, maxTokens);
    
    return {
      data: truncatedData,
      truncated: true
    };
  }

  /**
   * データのトークン数を計算する
   * @param data 対象データ
   * @returns トークン数
   */
  calculateTokens(data: any): number {
    const jsonString = JSON.stringify(data);
    const tokens = this.encoder.encode(jsonString);
    return tokens.length;
  }

  /**
   * データを指定されたトークン数以下に切り詰める
   * @param data 対象データ
   * @param maxTokens 最大トークン数
   * @returns 切り詰め後のデータ
   */
  private truncateData<T>(data: T, maxTokens: number): T {
    // 配列の場合は要素数を減らす
    if (Array.isArray(data)) {
      return this.truncateArray(data, maxTokens) as T;
    }

    // オブジェクトの場合
    if (typeof data === 'object' && data !== null) {
      return this.truncateObject(data, maxTokens) as T;
    }

    // プリミティブ型の場合はそのまま返す（通常は発生しない）
    return data;
  }

  /**
   * 配列を切り詰める
   * @param array 対象配列
   * @param maxTokens 最大トークン数
   * @returns 切り詰め後の配列
   */
  private truncateArray(array: any[], maxTokens: number): any[] {
    if (array.length === 0) return array;

    // バイナリサーチで適切な要素数を見つける
    let left = 0;
    let right = array.length;
    let result = [];

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const truncated = array.slice(0, mid);
      const tokens = this.calculateTokens(truncated);

      if (tokens <= maxTokens) {
        result = truncated;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  /**
   * オブジェクトを切り詰める
   * @param obj 対象オブジェクト
   * @param maxTokens 最大トークン数
   * @returns 切り詰め後のオブジェクト
   */
  private truncateObject(obj: any, maxTokens: number): any {
    const result: any = {};
    
    // 各プロパティを追加しながらトークン数をチェック
    for (const [key, value] of Object.entries(obj)) {
      // 配列の場合は特別処理（candidates、routes、その他の配列）
      if (Array.isArray(value)) {
        const truncatedArray = this.truncateArray(value, maxTokens);
        const candidateWithArray = { ...result, [key]: truncatedArray };
        
        if (this.calculateTokens(candidateWithArray) <= maxTokens) {
          result[key] = truncatedArray;
        } else {
          // 配列が大きすぎる場合は空配列を設定
          result[key] = [];
        }
        continue; // break ではなく continue を使用
      }
      
      // 通常のプロパティ
      const candidate = { ...result, [key]: value };
      if (this.calculateTokens(candidate) <= maxTokens) {
        result[key] = value;
      } else {
        // これ以上追加できない場合は終了
        break;
      }
    }

    return result;
  }

  /**
   * エンコーダーのリソースを解放する
   */
  destroy(): void {
    this.encoder.free();
  }
} 