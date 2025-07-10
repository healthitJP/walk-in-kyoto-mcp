// Auto-generated type imports for converted JSON files
// Run 'npm run convert-js-to-json' to regenerate

import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import type { LandmarkData, Master } from '../types/index.js';

// このモジュールファイルが存在するディレクトリ (dist/src/data)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// パッケージ内の data ルート (dist/data)
const DATA_ROOT = path.resolve(__dirname, '../../data');

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