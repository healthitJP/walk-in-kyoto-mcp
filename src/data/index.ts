// Auto-generated type imports for converted JSON files
// Run 'npm run convert-js-to-json' to regenerate

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import type { LandmarkData, Master } from '../types/index.js';

// ES Modules 環境で CommonJS の require を使うため生成
const require = createRequire(import.meta.url);

// このモジュールファイルが存在するディレクトリ (dist/src/data)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// パッケージ内の data ルート (dist/data)
const DATA_ROOT = path.resolve(__dirname, '../../data');

export type { LandmarkData, Master };

// Helper functions for loading JSON data
export function loadLandmarkData(language: 'ja' | 'en'): LandmarkData {
  const dataPath = path.join(DATA_ROOT, language, 'landmark-data.json');
  return require(dataPath) as LandmarkData;
}

export function loadMaster(language: 'ja' | 'en'): Master {
  const dataPath = path.join(DATA_ROOT, language, 'master.json');
  return require(dataPath) as Master;
} 