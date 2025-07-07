// Auto-generated type imports for converted JSON files
// Run 'npm run convert-js-to-json' to regenerate

import path from 'path';
import type { LandmarkData, Master } from '../types';

export type { LandmarkData, Master };

// Helper functions for loading JSON data
export function loadLandmarkData(language: 'ja' | 'en'): LandmarkData {
  const dataPath = path.resolve(process.cwd(), 'data', language, 'landmark-data.json');
  return require(dataPath);
}

export function loadMaster(language: 'ja' | 'en'): Master {
  const dataPath = path.resolve(process.cwd(), 'data', language, 'master.json');
  return require(dataPath);
} 