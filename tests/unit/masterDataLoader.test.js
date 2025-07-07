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
const MasterDataLoader_1 = require("../../src/services/MasterDataLoader");
describe('MasterDataLoader', () => {
    let loader;
    beforeEach(() => {
        loader = new MasterDataLoader_1.MasterDataLoader();
    });
    // U-1: 正常ロード
    describe('loadStops', () => {
        it('should load Japanese stops with name_ja filled', () => __awaiter(void 0, void 0, void 0, function* () {
            const stops = yield loader.loadStops('ja');
            expect(stops.length).toBeGreaterThan(0);
            expect(stops[0]).toHaveProperty('name_ja');
            expect(stops[0].name_ja).toBeTruthy();
            expect(stops[0]).toHaveProperty('id');
            expect(stops[0]).toHaveProperty('lat');
            expect(stops[0]).toHaveProperty('lng');
        }));
        it('should load English stops with name_en filled', () => __awaiter(void 0, void 0, void 0, function* () {
            const stops = yield loader.loadStops('en');
            expect(stops.length).toBeGreaterThan(0);
            expect(stops[0]).toHaveProperty('name_en');
            expect(stops[0].name_en).toBeTruthy();
        }));
    });
    // U-2: キャッシュ確認
    describe('caching behavior', () => {
        it('should return same instance on consecutive calls', () => __awaiter(void 0, void 0, void 0, function* () {
            const start = Date.now();
            const stops1 = yield loader.loadStops('ja');
            const firstCallTime = Date.now() - start;
            const start2 = Date.now();
            const stops2 = yield loader.loadStops('ja');
            const secondCallTime = Date.now() - start2;
            expect(stops1).toBe(stops2); // Same reference
            expect(secondCallTime).toBeLessThan(firstCallTime / 10); // Much faster
        }));
    });
    describe('loadLandmarks', () => {
        it('should load landmark data correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const landmarks = yield loader.loadLandmarks('ja');
            expect(landmarks.length).toBeGreaterThan(0);
            expect(landmarks[0]).toHaveProperty('name_ja');
            expect(landmarks[0]).toHaveProperty('category');
            expect(landmarks[0]).toHaveProperty('lat');
            expect(landmarks[0]).toHaveProperty('lng');
        }));
    });
    describe('error handling', () => {
        it('should throw error for invalid language', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect(loader.loadStops('invalid'))
                .rejects.toThrow('Unsupported language');
        }));
    });
});
