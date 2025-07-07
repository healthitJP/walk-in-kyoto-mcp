"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RequestValidator_1 = require("../../src/utils/RequestValidator");
describe('RequestValidator', () => {
    let validator;
    beforeEach(() => {
        validator = new RequestValidator_1.RequestValidator();
    });
    // U-8: 入力欠落
    describe('validateStopSearchRequest', () => {
        it('should throw 400 error for missing language', () => {
            const invalidRequest = {
                max_tokens: 512,
                query: 'test'
            };
            expect(() => validator.validateStopSearchRequest(invalidRequest))
                .toThrow('Missing required parameter: language');
        });
        it('should throw 400 error for missing max_tokens', () => {
            const invalidRequest = {
                language: 'ja',
                query: 'test'
            };
            expect(() => validator.validateStopSearchRequest(invalidRequest))
                .toThrow('Missing required parameter: max_tokens');
        });
        it('should throw 400 error for invalid language', () => {
            const invalidRequest = {
                language: 'invalid',
                max_tokens: 512,
                query: 'test'
            };
            expect(() => validator.validateStopSearchRequest(invalidRequest))
                .toThrow('Invalid language. Must be "ja" or "en"');
        });
        it('should throw 400 error for negative max_tokens', () => {
            const invalidRequest = {
                language: 'ja',
                max_tokens: -1,
                query: 'test'
            };
            expect(() => validator.validateStopSearchRequest(invalidRequest))
                .toThrow('max_tokens must be positive');
        });
        it('should pass validation for valid request', () => {
            const validRequest = {
                language: 'ja',
                max_tokens: 512,
                query: 'test'
            };
            expect(() => validator.validateStopSearchRequest(validRequest))
                .not.toThrow();
        });
    });
    // U-9: 時刻型式誤り
    describe('validateRouteSearchRequest', () => {
        it('should throw 400 error for invalid datetime format', () => {
            const invalidRequest = {
                language: 'ja',
                max_tokens: 1024,
                from_station: 'A',
                to_station: 'B',
                datetime_type: 'departure',
                datetime: '2025/07/07' // Invalid format
            };
            expect(() => validator.validateRouteSearchRequest(invalidRequest))
                .toThrow('Invalid datetime format. Expected ISO-8601');
        });
        it('should throw 400 error for invalid datetime_type', () => {
            const invalidRequest = {
                language: 'ja',
                max_tokens: 1024,
                from_station: 'A',
                to_station: 'B',
                datetime_type: 'invalid',
                datetime: '2025-07-07T00:43'
            };
            expect(() => validator.validateRouteSearchRequest(invalidRequest))
                .toThrow('Invalid datetime_type');
        });
        it('should pass validation for valid request', () => {
            const validRequest = {
                language: 'ja',
                max_tokens: 1024,
                from_station: 'A',
                to_station: 'B',
                datetime_type: 'departure',
                datetime: '2025-07-07T00:43'
            };
            expect(() => validator.validateRouteSearchRequest(validRequest))
                .not.toThrow();
        });
    });
    describe('validateLatLng', () => {
        it('should throw error for invalid latitude', () => {
            expect(() => validator.validateLatLng('91.0,135.0'))
                .toThrow('Invalid latitude');
        });
        it('should throw error for invalid longitude', () => {
            expect(() => validator.validateLatLng('35.0,181.0'))
                .toThrow('Invalid longitude');
        });
        it('should throw error for invalid format', () => {
            expect(() => validator.validateLatLng('invalid'))
                .toThrow('Invalid lat,lng format');
        });
        it('should pass validation for valid coordinates', () => {
            expect(() => validator.validateLatLng('35.02527,135.79189'))
                .not.toThrow();
        });
    });
});
