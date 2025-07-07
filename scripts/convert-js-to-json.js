#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * JavaScriptファイルを読み込んで変数の値を抽出する
 * @param {string} filePath - JSファイルのパス
 * @param {string} variableName - 抽出する変数名
 * @returns {any} - 抽出された変数の値
 */
function extractVariableFromJSFile(filePath, variableName) {
  try {
    const jsContent = fs.readFileSync(filePath, 'utf8');
    
    // var variableName = value; の形式を想定
    const regex = new RegExp(`var\\s+${variableName}\\s*=\\s*({[\\s\\S]*?});?\\s*$`, 'm');
    const match = jsContent.match(regex);
    
    if (!match) {
      throw new Error(`Variable ${variableName} not found in ${filePath}`);
    }
    
    // JSONとして解析可能にするため、evalを使用（セキュリティに注意）
    // 実際の環境では、より安全な方法を検討すること
    const objectString = match[1];
    
    // evalの代わりに、より安全な方法でJavaScriptオブジェクトをパース
    try {
      return Function(`"use strict"; return (${objectString})`)();
    } catch (error) {
      console.error(`Error parsing ${variableName} from ${filePath}:`, error.message);
      throw error;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * JSONファイルを保存する
 * @param {string} outputPath - 出力ファイルパス
 * @param {any} data - 保存するデータ
 */
function saveJSON(outputPath, data) {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    
    // 出力ディレクトリを作成
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, jsonString, 'utf8');
    console.log(`✅ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`Error saving ${outputPath}:`, error.message);
    throw error;
  }
}

/**
 * 指定された言語の変換を実行
 * @param {string} language - 言語コード ('ja' | 'en')
 */
function convertLanguage(language) {
  console.log(`\n🔄 Converting ${language} files...`);
  
  const basePath = path.join(__dirname, '..', 'ui_master', language);
  const outputBasePath = path.join(__dirname, '..', 'data', language);
  
  // LandmarkData.js を変換
  try {
    const landmarkDataPath = path.join(basePath, 'LandmarkData.js');
    const landmarkData = extractVariableFromJSFile(landmarkDataPath, 'LandmarkData');
    const landmarkOutputPath = path.join(outputBasePath, 'landmark-data.json');
    saveJSON(landmarkOutputPath, landmarkData);
  } catch (error) {
    console.error(`❌ Failed to convert LandmarkData for ${language}:`, error.message);
  }
  
  // Master.js を変換
  try {
    const masterDataPath = path.join(basePath, 'Master.js');
    const masterData = extractVariableFromJSFile(masterDataPath, 'Master');
    const masterOutputPath = path.join(outputBasePath, 'master.json');
    saveJSON(masterOutputPath, masterData);
  } catch (error) {
    console.error(`❌ Failed to convert Master for ${language}:`, error.message);
  }
}

/**
 * TypeScript型定義ファイルを生成
 */
function generateTypeImports() {
  const typeContent = `// Auto-generated type imports for converted JSON files
// Run 'npm run convert-js-to-json' to regenerate

import type { LandmarkData, Master } from '../src/types';

export type { LandmarkData, Master };

// Helper functions for loading JSON data
export function loadLandmarkData(language: 'ja' | 'en'): LandmarkData {
  return require(\`./\${language}/landmark-data.json\`);
}

export function loadMaster(language: 'ja' | 'en'): Master {
  return require(\`./\${language}/master.json\`);
}
`;

  const outputPath = path.join(__dirname, '..', 'data', 'index.ts');
  
  try {
    fs.writeFileSync(outputPath, typeContent, 'utf8');
    console.log(`✅ Generated: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Failed to generate type imports:`, error.message);
  }
}

/**
 * メイン処理
 */
function main() {
  console.log('🚀 Starting JS to JSON conversion...');
  
  try {
    // 各言語を処理
    convertLanguage('ja');
    convertLanguage('en');
    
    // TypeScript型定義ファイルを生成
    generateTypeImports();
    
    console.log('\n✨ Conversion completed successfully!');
    console.log('\n📁 Generated files:');
    console.log('  - data/ja/landmark-data.json');
    console.log('  - data/ja/master.json');
    console.log('  - data/en/landmark-data.json');
    console.log('  - data/en/master.json');
    console.log('  - data/index.ts');
    
  } catch (error) {
    console.error('\n❌ Conversion failed:', error.message);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain()を呼び出し
if (require.main === module) {
  main();
}

module.exports = {
  extractVariableFromJSFile,
  saveJSON,
  convertLanguage,
  generateTypeImports
}; 