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
const TokenLimiter_1 = require("../../src/utils/TokenLimiter");
describe('StopSearchService', () => {
    let service;
    beforeEach(() => {
        service = new StopSearchService_1.StopSearchService();
    });
    // U-5: 部分一致ヒット
    describe('search', () => {
        it('should find stops containing "銀閣"', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 512,
                query: '銀閣'
            };
            const response = yield service.search(request);
            expect(response.candidates.length).toBeGreaterThan(0);
            expect(response.candidates.some(c => c.name.includes('銀閣寺'))).toBe(true);
            expect(response.truncated).toBe(false);
        }));
        // U-6: 大文字小文字/全半角
        it('should handle case insensitive and full/half-width characters', () => __awaiter(void 0, void 0, void 0, function* () {
            const requestJa = {
                language: 'ja',
                max_tokens: 512,
                query: 'ginkaku'
            };
            const requestEn = {
                language: 'en',
                max_tokens: 512,
                query: 'Ginkaku'
            };
            const responseJa = yield service.search(requestJa);
            const responseEn = yield service.search(requestEn);
            expect(responseJa.candidates.length).toBeGreaterThan(0);
            expect(responseEn.candidates.length).toBeGreaterThan(0);
        }));
        // U-7: max_tokens 遵守
        it('should respect max_tokens limit', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 50, // Very small limit
                query: 'a' // Should match many stops
            };
            const response = yield service.search(request);
            // TokenLimiterを使ってトークン数をチェック（文字列長ではない）
            const tokenLimiter = new TokenLimiter_1.TokenLimiter();
            const actualTokens = tokenLimiter.calculateTokens(response);
            expect(actualTokens).toBeLessThanOrEqual(request.max_tokens);
            if (response.truncated) {
                expect(response.candidates.length).toBeGreaterThan(0);
            }
        }));
        it('should return candidates sorted by relevance', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 512,
                query: '京都'
            };
            const response = yield service.search(request);
            expect(response.candidates.length).toBeGreaterThan(1);
            // First candidate should be more relevant (exact match preferred)
            const firstCandidate = response.candidates[0];
            expect(firstCandidate.name).toContain('京都');
        }));
    });
    describe('error handling', () => {
        it('should handle empty query', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 512,
                query: ''
            };
            const response = yield service.search(request);
            expect(response.candidates).toEqual([]);
        }));
        it('should handle query with no matches', () => __awaiter(void 0, void 0, void 0, function* () {
            const request = {
                language: 'ja',
                max_tokens: 512,
                query: 'xyz999nonexistent'
            };
            const response = yield service.search(request);
            expect(response.candidates).toEqual([]);
            expect(response.truncated).toBe(false);
        }));
    });
});
