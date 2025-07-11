module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // .ts を ESM として扱う (.js は package.json の "type": "module" により自動判定)
  extensionsToTreatAsEsm: ['.ts'],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    // ts-jest に ESM トランスパイルを依頼
    '^.+\\.ts$': [
      'ts-jest',
      { 
        useESM: true
      }
    ]
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  testTimeout: 10000,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // ESM対応: .js拡張子を.tsファイルにマッピング
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};