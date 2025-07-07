"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const StopSearchService_1 = require("../../src/services/StopSearchService");
const MasterDataLoader_1 = require("../../src/services/MasterDataLoader");
const TokenLimiter_1 = require("../../src/utils/TokenLimiter");
describe('Stop Search Integration Tests', () => {
    let stopSearchService;
    let masterDataLoader;
    let tokenLimiter;
    beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
        masterDataLoader = new MasterDataLoader_1.MasterDataLoader();
        stopSearchService = new StopSearchService_1.StopSearchService();
        tokenLimiter = new TokenLimiter_1.TokenLimiter();
        // Pre-load data for faster tests
        yield masterDataLoader.loadStops('ja');
        yield masterDataLoader.loadStops('en');
    }));
    // IT-1: happy-path JA
    describe('Japanese stop search', () => {
        it('should return valid JSON schema within token limit', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 512,
                query: '京都'
            };
            const response = yield stopSearchService.search(request);
            // JSON schema validation
            expect(response).toHaveProperty('candidates');
            expect(response).toHaveProperty('truncated');
            expect(Array.isArray(response.candidates)).toBe(true);
            expect(typeof response.truncated).toBe('boolean');
            // Token limit validation
            const actualTokens = tokenLimiter.calculateTokens(response);
            expect(actualTokens).toBeLessThanOrEqual(request.max_tokens);
            // Content validation
            expect(response.candidates.length).toBeGreaterThan(0);
            response.candidates.forEach(candidate => {
                expect(candidate).toHaveProperty('name');
                expect(candidate).toHaveProperty('kind');
                expect(candidate).toHaveProperty('id');
                expect(['bus_stop', 'train_station', 'landmark']).toContain(candidate.kind);
            });
        }));
    });
    // IT-2: EN locale
    describe('English stop search', () => {
        it('should return English names only', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'en',
                max_tokens: 512,
                query: 'Kyoto'
            };
            const response = yield stopSearchService.search(request);
            expect(response.candidates.length).toBeGreaterThan(0);
            // Should contain English names
            response.candidates.forEach(candidate => {
                expect(candidate.name).toMatch(/[a-zA-Z]/); // Contains Latin characters
            });
        }));
    });
    describe('Edge cases', () => {
        it('should handle very small token limits', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 50,
                query: '駅'
            };
            const response = yield stopSearchService.search(request);
            const actualTokens = tokenLimiter.calculateTokens(response);
            // トークン制限の許容範囲（BPE計算の不正確性を考慮）
            expect(actualTokens).toBeLessThanOrEqual(request.max_tokens * 1.1);
            if (response.candidates.length === 0) {
                expect(response.truncated).toBe(true);
            }
        }));
        it('should handle common queries efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const commonQueries = ['京都', '大阪', '銀閣', '清水'];
            for (const query of commonQueries) {
                const request = {
                    language: 'ja',
                    max_tokens: 1024,
                    query
                };
                const startTime = Date.now();
                const response = yield stopSearchService.search(request);
                const endTime = Date.now();
                expect(endTime - startTime).toBeLessThan(1000); // Should be fast
                expect(response.candidates.length).toBeGreaterThan(0);
            }
        }));
    });
});
