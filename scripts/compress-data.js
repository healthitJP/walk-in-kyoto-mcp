#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDataDir = path.resolve(__dirname, '../dist/data');

// 圧縮するファイルのリスト
const filesToCompress = [
  'ja/master.json',
  'ja/landmark-data.json',
  'en/master.json',
  'en/landmark-data.json'
];

console.log('Starting data compression in dist/data...');

if (!fs.existsSync(distDataDir)) {
  console.error('Error: dist/data directory not found. Please run "npm run copy-data" first.');
  process.exit(1);
}

let totalOriginalSize = 0;
let totalCompressedSize = 0;

// 各ファイルを圧縮
for (const relativePath of filesToCompress) {
  const filePath = path.join(distDataDir, relativePath);
  
  if (!fs.existsSync(filePath)) {
    console.warn(`Warning: File not found: ${filePath}`);
    continue;
  }

  console.log(`Compressing: ${relativePath}`);
  
  // ファイルを読み込み
  const inputData = fs.readFileSync(filePath);
  const originalSize = inputData.length;
  
  // gzip圧縮
  const compressedData = zlib.gzipSync(inputData, {
    level: 9, // 最高圧縮レベル
    windowBits: 15,
    memLevel: 8,
  });
  
  // 元のファイルを圧縮ファイルで置き換え
  const compressedPath = filePath + '.gz';
  fs.writeFileSync(compressedPath, compressedData);
  
  // 元のJSONファイルを削除
  fs.unlinkSync(filePath);
  
  const compressedSize = compressedData.length;
  const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
  
  totalOriginalSize += originalSize;
  totalCompressedSize += compressedSize;
  
  console.log(`  Original: ${(originalSize / 1024).toFixed(1)}KB`);
  console.log(`  Compressed: ${(compressedSize / 1024).toFixed(1)}KB`);
  console.log(`  Compression: ${compressionRatio}%`);
}

const totalCompressionRatio = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(1);
console.log(`\nTotal compression:`);
console.log(`  Original: ${(totalOriginalSize / 1024).toFixed(1)}KB`);
console.log(`  Compressed: ${(totalCompressedSize / 1024).toFixed(1)}KB`);
console.log(`  Saved: ${totalCompressionRatio}%`);
console.log('Data compression completed!'); 