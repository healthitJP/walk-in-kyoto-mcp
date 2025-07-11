import { RouteHtmlFetcher } from '../../src/utils/RouteHtmlFetcher.js';
import { RouteSearchByNameService } from '../../src/services/RouteSearchByNameService.js';
import { RouteHtmlParser } from '../../src/utils/RouteHtmlParser.js';
import { TokenLimiter } from '../../src/utils/TokenLimiter.js';
import { RequestValidator } from '../../src/utils/RequestValidator.js';

import util from 'util';



describe('RouteHtmlFetcher', () => {
    let fetcher: RouteHtmlFetcher;
    let service: RouteSearchByNameService;
    let parser: RouteHtmlParser;
    let tokenLimiter: TokenLimiter;
    let validator: RequestValidator;

    beforeEach(() => {
        fetcher = new RouteHtmlFetcher();
        parser = new RouteHtmlParser();
        tokenLimiter = new TokenLimiter();
        validator = new RequestValidator();
        service = new RouteSearchByNameService(fetcher, parser, tokenLimiter, validator);
    });

    describe('fetchByName', () => {
        it('should successfully fetch route HTML with station names', async () => {
            await (fetcher as any).initMasterData('ja');  // ← 追加
            const html = await fetcher.fetchByName('浄土寺', '京都', '2025-01-15T09:30:00', 'arrival', 'ja');
            console.log(html);
            expect(html).toBeDefined();
            const result = await service.searchRoute({
                language: 'ja',
                max_tokens: 8000,
                from_station: '浄土寺',
                to_station: '京都',
                datetime: '2025-01-15T09:30:00',
                datetime_type: 'arrival'
            });
            // result を取得したあと
            console.log(
                util.inspect(result, {
                    depth: null,          // ネストを無制限に展開
                    colors: true,         // 端末側が対応していればカラー表示
                    maxArrayLength: null  // 配列もすべて表示
                })
            );
            expect(result).toBeDefined();
        });
    });
}); 