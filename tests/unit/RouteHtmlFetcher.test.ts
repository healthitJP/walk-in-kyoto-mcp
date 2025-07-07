import axios from 'axios';
import { RouteHtmlFetcher } from '../../src/utils/RouteHtmlFetcher';
import { loadMaster, loadLandmarkData } from '../../src/data';

// モックの設定
jest.mock('axios');
jest.mock('../../src/data');

const mockedAxios = axios as jest.MockedFunction<typeof axios>;
const mockedLoadMaster = loadMaster as jest.MockedFunction<typeof loadMaster>;
const mockedLoadLandmarkData = loadLandmarkData as jest.MockedFunction<typeof loadLandmarkData>;

// モックデータの定義
const mockMasterData = {
  station: {
    '浄土寺(京都市バス)': {
      lat: 35.0252705,
      lng: 135.7918895,
      ekidiv: 'B',
      selectname: '浄土寺'
    },
    '烏丸御池(京都バス)': {
      lat: 35.01070068,
      lng: 135.7597217,
      ekidiv: 'B',
      selectname: '烏丸御池'
    },
    '京都(西日本旅客鉄道)': {
      lat: 34.9858,
      lng: 135.7581,
      ekidiv: 'R',
      selectname: '京都'
    },
    '銀閣寺道(京都市バス)': {
      lat: 35.0250,
      lng: 135.7920,
      ekidiv: 'B',
      selectname: '銀閣寺道'
    },
    '銀閣寺前(京都市バス)': {
      lat: 35.0260,
      lng: 135.7930,
      ekidiv: 'B',
      selectname: '銀閣寺前'
    }
  },
  stationselect: {
    '浄土寺': {
      stationnames: [
        { stationname: '浄土寺(京都市バス)' }
      ]
    },
    '烏丸御池': {
      stationnames: [
        { stationname: '烏丸御池(京都バス)' },
        { stationname: '烏丸御池(西日本JRバス)' },
        { stationname: '烏丸御池(京都市バス)' }
      ]
    },
    '京都': {
      stationnames: [
        { stationname: '京都(西日本旅客鉄道)' }
      ]
    }
  },
  coefficient: {
    SEARCH_NEAR_SPOTS_NUMBER: 10
  }
};

const mockLandmarkData = {
  data: {
    'LM00000534': { // 渡月橋（嵐山）
      name: '嵐山',
      lat: 35.0096,
      lng: 135.6761
    },
    'LM00000001': { // 清水寺
      name: '清水寺',
      lat: 34.9949,
      lng: 135.7850
    },
    'LM00002101': { // 銀閣寺
      name: '銀閣寺',
      lat: 35.0270,
      lng: 135.7980
    },
    'LM00002093': { // 金閣寺
      name: '金閣寺',
      lat: 35.0394,
      lng: 135.7292
    }
  }
};

const mockHtmlResponse = `
<!DOCTYPE html>
<html>
<head><title>Route Search Results</title></head>
<body>
  <div class="route-results">
    <div class="route-item">バスルート1</div>
    <div class="route-item">バスルート2</div>
  </div>
</body>
</html>
`;

describe('RouteHtmlFetcher', () => {
  let fetcher: RouteHtmlFetcher;

  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // デフォルトのモック設定
    mockedLoadMaster.mockReturnValue(mockMasterData as any);
    mockedLoadLandmarkData.mockReturnValue(mockLandmarkData as any);
    mockedAxios.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      data: mockHtmlResponse
    });

    fetcher = new RouteHtmlFetcher({
      baseUrl: 'https://test.example.com',
      timeout: 5000,
      retries: 2
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const defaultFetcher = new RouteHtmlFetcher();
      expect(defaultFetcher).toBeInstanceOf(RouteHtmlFetcher);
    });

    it('should initialize with custom options', () => {
      const customFetcher = new RouteHtmlFetcher({
        baseUrl: 'https://custom.example.com',
        timeout: 10000,
        retries: 5
      });
      expect(customFetcher).toBeInstanceOf(RouteHtmlFetcher);
    });
  });

  describe('fetchByName', () => {
    it('should successfully fetch route HTML with station names', async () => {
      const result = await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(result).toBe(mockHtmlResponse);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://test.example.com/search_result.php',
          params: expect.objectContaining({
            fn: '浄土寺(京都市バス)',
            tn: '烏丸御池(京都バス)',
            dt: '2025/1/15',
            tm: '09:30',
            tt: 'd',
            lang: 'ja'
          })
        })
      );
    });

    it('should handle arrival time type', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'arrival',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            tt: 'a'
          })
        })
      );
    });

    it('should handle English language', async () => {
      await fetcher.fetchByName(
        'Jodoji',
        'Karasuma Oike',
        '2025-01-15T09:30:00',
        'departure',
        'en'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            lang: 'en'
          })
        })
      );
    });
  });

  describe('fetchByCoordinates', () => {
    it('should successfully fetch route HTML with coordinates', async () => {
      const result = await fetcher.fetchByCoordinates(
        35.0252705,
        135.7918895,
        35.01070068,
        135.7597217,
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(result).toBe(mockHtmlResponse);
      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            fn: '',
            tn: '',
            fl: '35.0252705,135.7918895',
            tl: '35.01070068,135.7597217',
            fi: 'S',
            ti: 'S'
          })
        })
      );
    });
  });

  describe('Special landmark handling', () => {
    it('should handle Arashiyama landmark specially', async () => {
      await fetcher.fetchByName(
        '嵐山',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            fs: '嵐山(阪急),0,嵐山(京福電気鉄道),0,嵯峨嵐山,0',
            fl: '',
            fi: 'S'
          })
        })
      );
    });

         it('should handle Kiyomizudera landmark specially', async () => {
       await fetcher.fetchByName(
         '清水寺',
         '烏丸御池(京都バス)',
         '2025-01-15T09:30:00',
         'departure',
         'ja'
       );

       const axiosCall = (mockedAxios as any).mock.calls[0][0];
       expect(axiosCall.params.fs).toBe('五条坂(京都市バス),8,五条坂(京阪バス),8,清水道(京都市バス),8,清水道(京阪バス),8');
       expect(axiosCall.params.fl).toBe('34.9949,135.785');
       expect(axiosCall.params.fi).toBe('S');
     });

         it('should handle Ginkakuji landmark specially', async () => {
       await fetcher.fetchByName(
         '銀閣寺',
         '烏丸御池(京都バス)',
         '2025-01-15T09:30:00',
         'departure',
         'ja'
       );

       const axiosCall = (mockedAxios as any).mock.calls[0][0];
       expect(axiosCall.params.fs).toBe('銀閣寺前(京都市バス),6,銀閣寺道(京都市バス),10');
       expect(axiosCall.params.fl).toBe('35.027,135.798');
       expect(axiosCall.params.fi).toBe('S');
     });
  });

  describe('Station name processing', () => {
    it('should handle station names with company suffix', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

        // 事業者名付きの駅名が正しく処理されることを確認
        const axiosCall = (mockedAxios as any).mock.calls[0][0];
        // URLエンコードされているかデコードして確認
        const decodedFs = decodeURIComponent(axiosCall.params.fs);
        expect(decodedFs).toContain('浄土寺(京都市バス),0');
        expect(axiosCall.params.fl).toBe('35.0252705,135.7918895');
        expect(axiosCall.params.fi).toBe('B');
    });

    it('should handle station names without company suffix', async () => {
      // stationselectのみに存在する駅名でテスト
      await fetcher.fetchByName(
        '浄土寺',
        '烏丸御池',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

             expect(mockedAxios).toHaveBeenCalled();
       const axiosCall = (mockedAxios as any).mock.calls[0][0];
       expect(axiosCall.params.fs).toBeDefined();
       expect(axiosCall.params.fl).toBeDefined();
    });

    it('should handle unknown station names gracefully', async () => {
      await fetcher.fetchByName(
        '存在しない駅',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

             // デフォルトパターンが適用されることを確認
       const axiosCall = (mockedAxios as any).mock.calls[0][0];
       expect(axiosCall.params.fs).toBe('存在しない駅,0');
       expect(axiosCall.params.fl).toBe('35.0,135.7');
       expect(axiosCall.params.fi).toBe('B');
    });
  });

  describe('Date and time formatting', () => {
    it('should format date correctly', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-07-07T07:43:00',
        'departure',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            dt: '2025/7/7',
            tm: '07:43'
          })
        })
      );
    });

    it('should format single digit month and day correctly', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-05T09:05:00',
        'departure',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            dt: '2025/1/5',
            tm: '09:05'
          })
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should retry on network failure', async () => {
      mockedAxios
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: mockHtmlResponse
        });

      const result = await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(result).toBe(mockHtmlResponse);
      expect(mockedAxios).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      mockedAxios.mockRejectedValue(new Error('Persistent network error'));

      await expect(
        fetcher.fetchByName(
          '浄土寺(京都市バス)',
          '烏丸御池(京都バス)',
          '2025-01-15T09:30:00',
          'departure',
          'ja'
        )
      ).rejects.toThrow('Failed to fetch route HTML after 2 attempts');

      expect(mockedAxios).toHaveBeenCalledTimes(2);
    });

    it('should handle HTTP error status codes', async () => {
      mockedAxios.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error',
        data: 'Error page'
      });

      await expect(
        fetcher.fetchByName(
          '浄土寺(京都市バス)',
          '烏丸御池(京都バス)',
          '2025-01-15T09:30:00',
          'departure',
          'ja'
        )
      ).rejects.toThrow('Failed to fetch route HTML after 2 attempts');
    });

    it('should throw error when master data fails to load', async () => {
      mockedLoadMaster.mockImplementation(() => {
        throw new Error('Failed to load master data');
      });

      await expect(
        fetcher.fetchByName(
          '浄土寺(京都市バス)',
          '烏丸御池(京都バス)',
          '2025-01-15T09:30:00',
          'departure',
          'ja'
        )
      ).rejects.toThrow('Failed to load master data');
    });
  });

  describe('HTTP request configuration', () => {
    it('should set correct headers', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla'),
            'Accept': expect.stringContaining('text/html'),
            'Accept-Language': 'ja,en-US;q=0.5',
            'Referer': 'https://test.example.com/'
          })
        })
      );
    });

    it('should use correct endpoint', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: 'https://test.example.com/search_result.php'
        })
      );
    });

    it('should set timeout correctly', async () => {
      await fetcher.fetchByName(
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '2025-01-15T09:30:00',
        'departure',
        'ja'
      );

      expect(mockedAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000
        })
      );
    });
  });

  describe('Master data initialization', () => {
    it('should load master data only once', async () => {
      // 複数回呼び出し
      await fetcher.fetchByName('浄土寺(京都市バス)', '烏丸御池(京都バス)', '2025-01-15T09:30:00', 'departure', 'ja');
      await fetcher.fetchByName('京都(西日本旅客鉄道)', '烏丸御池(京都バス)', '2025-01-15T09:30:00', 'departure', 'ja');

      // データロード関数は1回のみ呼ばれることを確認
      expect(mockedLoadMaster).toHaveBeenCalledTimes(1);
      expect(mockedLoadLandmarkData).toHaveBeenCalledTimes(1);
    });

    it('should load data for correct language', async () => {
      await fetcher.fetchByName('Station', 'Station2', '2025-01-15T09:30:00', 'departure', 'en');

      expect(mockedLoadMaster).toHaveBeenCalledWith('en');
      expect(mockedLoadLandmarkData).toHaveBeenCalledWith('en');
    });
  });
}); 