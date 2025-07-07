import { StationCoordinateResolver } from '../../src/utils/StationCoordinateResolver';
import { loadMaster } from '../../src/data';

// モックの設定
jest.mock('../../src/data');

const mockedLoadMaster = loadMaster as jest.MockedFunction<typeof loadMaster>;

describe('StationCoordinateResolver', () => {
  let resolver: StationCoordinateResolver;

  const mockMasterDataJa = {
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
    stationselect: {},
    company: {},
    company_byorder: [],
    rosen: {},
    rosen_byorder: [],
    coefficient: {}
  };

  const mockMasterDataEn = {
    station: {
      'Jodoji(Kyoto City Bus)': {
        lat: 35.0252705,
        lng: 135.7918895,
        ekidiv: 'B',
        selectname: 'Jodoji'
      },
      'Karasuma Oike(Kyoto Bus)': {
        lat: 35.01070068,
        lng: 135.7597217,
        ekidiv: 'B',
        selectname: 'Karasuma Oike'
      },
      'Kyoto(JR West)': {
        lat: 34.9858,
        lng: 135.7581,
        ekidiv: 'R',
        selectname: 'Kyoto'
      }
    },
    stationselect: {},
    company: {},
    company_byorder: [],
    rosen: {},
    rosen_byorder: [],
    coefficient: {}
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // モックの設定：言語に応じて異なるデータを返す
    mockedLoadMaster.mockImplementation((language: 'ja' | 'en') => {
      return language === 'ja' ? mockMasterDataJa as any : mockMasterDataEn as any;
    });

    resolver = new StationCoordinateResolver();
  });

  describe('constructor', () => {
    it('should initialize with master data for both languages', () => {
      expect(mockedLoadMaster).toHaveBeenCalledTimes(2);
      expect(mockedLoadMaster).toHaveBeenCalledWith('ja');
      expect(mockedLoadMaster).toHaveBeenCalledWith('en');
    });
  });

  describe('resolveCoordinates', () => {
    describe('exact match scenarios', () => {
      it('should return coordinates for exact station name match in Japanese', () => {
        const result = resolver.resolveCoordinates('浄土寺(京都市バス)', 'ja');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });

      it('should return coordinates for exact station name match in English', () => {
        const result = resolver.resolveCoordinates('Jodoji(Kyoto City Bus)', 'en');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });

      it('should return null for non-existent station', () => {
        const result = resolver.resolveCoordinates('存在しない駅', 'ja');
        
        expect(result).toBeNull();
      });
    });

    describe('space normalization scenarios', () => {
      it('should handle station name with spaces by normalizing', () => {
        // スペース付きの駅名でテスト用データを追加
        mockMasterDataJa.station['浄土寺(京都市バス)'] = {
          lat: 35.0252705,
          lng: 135.7918895,
          ekidiv: 'B',
          selectname: '浄土寺'
        };

        const result = resolver.resolveCoordinates('浄土寺 (京都市バス)', 'ja');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });

      it('should find station after removing spaces when exact match fails', () => {
        // スペース付きで検索、スペース無しで見つかる
        const result = resolver.resolveCoordinates('浄土寺 (京都市バス)', 'ja');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });
    });

    describe('partial match scenarios', () => {
      it('should find station by partial match when exact match fails', () => {
        const result = resolver.resolveCoordinates('銀閣寺', 'ja');
        
        // '銀閣寺道(京都市バス)' または '銀閣寺前(京都市バス)' のいずれかが見つかる
        expect(result).not.toBeNull();
        expect(result?.lat).toBeCloseTo(35.025, 3); // 35.0250 or 35.0260
        expect(result?.lng).toBeCloseTo(135.792, 3); // 135.7920 or 135.7930
      });

      it('should find station when search term is contained in station name', () => {
        const result = resolver.resolveCoordinates('西日本旅客鉄道', 'ja');
        
        expect(result).toEqual({
          lat: 34.9858,
          lng: 135.7581
        });
      });

      it('should return null when no partial matches found', () => {
        const result = resolver.resolveCoordinates('まったく存在しない駅名', 'ja');
        
        expect(result).toBeNull();
      });
    });

    describe('language handling', () => {
      it('should default to Japanese when language not specified', () => {
        const result = resolver.resolveCoordinates('浄土寺(京都市バス)');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });

      it('should handle English language parameter', () => {
        const result = resolver.resolveCoordinates('Kyoto(JR West)', 'en');
        
        expect(result).toEqual({
          lat: 34.9858,
          lng: 135.7581
        });
      });
    });

    describe('edge cases', () => {
      it('should handle empty string input', () => {
        const result = resolver.resolveCoordinates('', 'ja');
        
        // 空文字列は全ての駅名に含まれるため、最初の駅がマッチする
        expect(result).not.toBeNull();
      });

      it('should handle multiple spaces in station name', () => {
        const result = resolver.resolveCoordinates('浄土寺   (京都市バス)', 'ja');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });

      it('should handle station name with various whitespace characters', () => {
        const result = resolver.resolveCoordinates('浄土寺\t(京都市バス)', 'ja');
        
        expect(result).toEqual({
          lat: 35.0252705,
          lng: 135.7918895
        });
      });
    });
  });

  describe('resolveMultipleCoordinates', () => {
    it('should resolve coordinates for multiple station names', () => {
      const stationNames = [
        '浄土寺(京都市バス)',
        '烏丸御池(京都バス)',
        '京都(西日本旅客鉄道)'
      ];
      
      const results = resolver.resolveMultipleCoordinates(stationNames, 'ja');
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        lat: 35.0252705,
        lng: 135.7918895
      });
      expect(results[1]).toEqual({
        lat: 35.01070068,
        lng: 135.7597217
      });
      expect(results[2]).toEqual({
        lat: 34.9858,
        lng: 135.7581
      });
    });

    it('should handle mix of found and not found stations', () => {
      const stationNames = [
        '浄土寺(京都市バス)',
        '存在しない駅',
        '京都(西日本旅客鉄道)'
      ];
      
      const results = resolver.resolveMultipleCoordinates(stationNames, 'ja');
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        lat: 35.0252705,
        lng: 135.7918895
      });
      expect(results[1]).toBeNull();
      expect(results[2]).toEqual({
        lat: 34.9858,
        lng: 135.7581
      });
    });

    it('should handle empty array input', () => {
      const results = resolver.resolveMultipleCoordinates([], 'ja');
      
      expect(results).toEqual([]);
    });

    it('should default to Japanese when language not specified', () => {
      const stationNames = ['浄土寺(京都市バス)'];
      
      const results = resolver.resolveMultipleCoordinates(stationNames);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        lat: 35.0252705,
        lng: 135.7918895
      });
    });

    it('should handle English station names', () => {
      const stationNames = [
        'Jodoji(Kyoto City Bus)',
        'Kyoto(JR West)'
      ];
      
      const results = resolver.resolveMultipleCoordinates(stationNames, 'en');
      
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        lat: 35.0252705,
        lng: 135.7918895
      });
      expect(results[1]).toEqual({
        lat: 34.9858,
        lng: 135.7581
      });
    });

    it('should handle station names with partial matches in batch', () => {
      const stationNames = [
        '銀閣寺', // 部分一致
        '浄土寺(京都市バス)', // 完全一致
        '存在しない' // 見つからない
      ];
      
      const results = resolver.resolveMultipleCoordinates(stationNames, 'ja');
      
      expect(results).toHaveLength(3);
      expect(results[0]).not.toBeNull(); // 部分一致で見つかる
      expect(results[1]).toEqual({
        lat: 35.0252705,
        lng: 135.7918895
      });
      expect(results[2]).toBeNull(); // 見つからない
    });
  });

  describe('performance considerations', () => {
    it('should efficiently handle large batch requests', () => {
      const stationNames = Array(100).fill('浄土寺(京都市バス)');
      
      const startTime = performance.now();
      const results = resolver.resolveMultipleCoordinates(stationNames, 'ja');
      const endTime = performance.now();
      
      expect(results).toHaveLength(100);
      expect(results.every(result => result !== null)).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内で完了
    });
  });
}); 