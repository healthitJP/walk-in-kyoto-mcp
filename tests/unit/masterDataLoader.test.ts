import { MasterDataLoader } from '../../src/services/MasterDataLoader';
import { Language, StopRecord, LandmarkRecord } from '../../src/types';

describe('MasterDataLoader', () => {
  let loader: MasterDataLoader;

  beforeEach(() => {
    loader = new MasterDataLoader();
  });

  // U-1: 正常ロード
  describe('loadStops', () => {
    it('should load Japanese stops with name_ja filled', async () => {
      const stops = await loader.loadStops('ja');
      
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0]).toHaveProperty('name_ja');
      expect(stops[0].name_ja).toBeTruthy();
      expect(stops[0]).toHaveProperty('id');
      expect(stops[0]).toHaveProperty('lat');
      expect(stops[0]).toHaveProperty('lng');
    });

    it('should load English stops with name_en filled', async () => {
      const stops = await loader.loadStops('en');
      
      expect(stops.length).toBeGreaterThan(0);
      expect(stops[0]).toHaveProperty('name_en');
      expect(stops[0].name_en).toBeTruthy();
    });
  });

  // U-2: キャッシュ確認
  describe('caching behavior', () => {
    it('should return same instance on consecutive calls', async () => {
      const start = Date.now();
      const stops1 = await loader.loadStops('ja');
      const firstCallTime = Date.now() - start;

      const start2 = Date.now();
      const stops2 = await loader.loadStops('ja');
      const secondCallTime = Date.now() - start2;

      expect(stops1).toBe(stops2); // Same reference
      expect(secondCallTime).toBeLessThan(firstCallTime / 10); // Much faster
    });
  });

  describe('loadLandmarks', () => {
    it('should load landmark data correctly', async () => {
      const landmarks = await loader.loadLandmarks('ja');
      
      expect(landmarks.length).toBeGreaterThan(0);
      expect(landmarks[0]).toHaveProperty('name_ja');
      expect(landmarks[0]).toHaveProperty('category');
      expect(landmarks[0]).toHaveProperty('lat');
      expect(landmarks[0]).toHaveProperty('lng');
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid language', async () => {
      await expect(loader.loadStops('invalid' as Language))
        .rejects.toThrow('Unsupported language');
    });
  });
}); 