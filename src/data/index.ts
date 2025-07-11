// Auto-generated type imports for converted JSON files
// Run 'npm run convert-js-to-json' to regenerate

import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import type { LandmarkData, Master } from '../types/index.js';

// このモジュールファイルが存在するディレクトリ (dist/src/data)
// Jest環境では import.meta.url が使えないため環境変数で判定
let currentDir: string;
const isJestEnvironment = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

if (isJestEnvironment) {
  // Jest環境での fallback: 現在のworking directoryから相対パスで解決
  currentDir = path.resolve(process.cwd(), 'src/data');
} else {
  // 通常実行環境 --------------------------------------------------
  // まず import.meta.url が利用できる (ESM) か試み、失敗したら CJS 用フォールバック
  let resolvedDir: string | null = null;
  try {
    // TypeScript のコンパイル時に構文エラーを防ぐため eval を使用
    const importMetaUrl = eval('import.meta.url');
    if (importMetaUrl) {
      resolvedDir = path.dirname(fileURLToPath(importMetaUrl));
    }
  } catch {
    // noop – eval が失敗するのは CJS 実行時
  }

  if (resolvedDir) {
    currentDir = resolvedDir;
  // @ts-ignore __dirname は CJS でのみ存在
  } else if (typeof __dirname !== 'undefined') {
    // CommonJS ビルド (dist/) で実行されている場合
    // __dirname は dist/src/data を指す
    currentDir = __dirname;
  } else {
    // 最後の手段: プロジェクト root からの相対パス
    currentDir = path.resolve(process.cwd(), 'dist/src/data');
  }
}
// パッケージ内の data ルート (dist/data または開発時は ./data)
const DATA_ROOT = path.resolve(currentDir, '../../data');

export type { LandmarkData, Master };

// Helper functions for loading JSON data (supports compressed .gz files)
export function loadLandmarkData(language: 'ja' | 'en'): LandmarkData {
  const dataPath = path.join(DATA_ROOT, language, 'landmark-data.json');
  return loadJsonFile(dataPath) as LandmarkData;
}

export function loadMaster(language: 'ja' | 'en'): Master {
  const dataPath = path.join(DATA_ROOT, language, 'master.json');
  return loadJsonFile(dataPath) as Master;
}

/**
 * JSONファイルまたはgzip圧縮されたJSONファイルを自動判別して読み込む
 * @param basePath .jsonファイルのパス
 * @returns パースされたJSONオブジェクト
 */
function loadJsonFile(basePath: string): any {
  const gzPath = basePath + '.gz';
  
  try {
    // まずgzip圧縮ファイルの存在をチェック
    if (fs.existsSync(gzPath)) {
      // gzip圧縮ファイルを読み込み・解凍
      const compressedData = fs.readFileSync(gzPath);
      const decompressedData = zlib.gunzipSync(compressedData);
      const jsonString = decompressedData.toString('utf8');
      return JSON.parse(jsonString);
    }
    
    // gzipファイルが存在しない場合は元のJSONファイルを読み込み
    if (fs.existsSync(basePath)) {
      const jsonData = fs.readFileSync(basePath, 'utf8');
      return JSON.parse(jsonData);
    }
    
    throw new Error(`Neither ${basePath} nor ${gzPath} exists`);
  } catch (error) {
    throw new Error(`Failed to load JSON from ${basePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 