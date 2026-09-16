import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SafetyEngineController } from './safety-engine.controller';
import { DRIZZLE } from '../../database/database.module';
import { H3Scorer } from './scoring/h3-scorer';
import { UkPoliceAdapter } from './adapters/uk-police.adapter';

describe('SafetyEngineController area-summary + tiles (UAT map)', () => {
  let controller: SafetyEngineController;
  const execute = jest.fn();
  const blendWithNumbeo = jest.fn((score: number) => score);
  const fetchAndUpsertAt = jest.fn().mockResolvedValue(0);

  beforeEach(async () => {
    jest.resetAllMocks();
    blendWithNumbeo.mockImplementation((score: number) => score);
    fetchAndUpsertAt.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SafetyEngineController],
      providers: [
        { provide: DRIZZLE, useValue: { execute, insert: jest.fn(), select: jest.fn().mockReturnThis(), from: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis() } },
        { provide: H3Scorer, useValue: { blendWithNumbeo, scoreAll: jest.fn() } },
        { provide: UkPoliceAdapter, useValue: { fetchAndUpsertAt, ingest: jest.fn(), sourceName: 'uk_police' } },
      ],
    }).compile();

    controller = module.get(SafetyEngineController);
  });

  describe('getAreaSummary', () => {
    it('rejects radius < 200', async () => {
      await expect(
        controller.getAreaSummary('51.5', '-0.12', '100'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows hex-scoped radius 700 and returns unique incidentCount', async () => {
      execute
        .mockResolvedValueOnce([
          { crime_type: 'theft', total: 15 },
          { crime_type: 'violence', total: 5 },
        ])
        .mockResolvedValueOnce([{ score: '40', band: 'band2', source_country: 'GB' }]);

      const result = await controller.getAreaSummary('51.51', '-0.147', '700', 'Mayfair', '0');
      expect(result.radiusMetres).toBe(700);
      expect(result.incidentCount).toBe(20);
      expect(result.crimeBreakdown).toHaveLength(2);
      expect(result.dataLimited).toBe(false);
      expect(fetchAndUpsertAt).not.toHaveBeenCalled(); // fetch=0
    });

    it('marks dataLimited when fewer than 3 incidents', async () => {
      execute
        .mockResolvedValueOnce([{ crime_type: 'theft', total: 1 }])
        .mockResolvedValueOnce([]);

      const result = await controller.getAreaSummary('51.5', '-0.1', '700', 'Quiet', '0');
      expect(result.incidentCount).toBe(1);
      expect(result.dataLimited).toBe(true);
      expect(result.band).toBe('low_count');
      expect(result.scoreMethodology).toMatch(/Limited/i);
    });

    it('calls on-demand UK fetch when empty and fetch allowed', async () => {
      execute
        .mockResolvedValueOnce([]) // first query empty
        .mockResolvedValueOnce([{ crime_type: 'theft', total: 4 }]) // after fetch
        .mockResolvedValueOnce([{ score: '55', band: 'band3', source_country: 'GB' }]);

      fetchAndUpsertAt.mockResolvedValue(4);

      const result = await controller.getAreaSummary('51.51', '-0.147', '700', 'Mayfair');
      expect(fetchAndUpsertAt).toHaveBeenCalled();
      expect(result.incidentCount).toBe(4);
    });

    it('returns different counts for different seed queries (regression guard)', async () => {
      execute
        .mockResolvedValueOnce([{ crime_type: 'theft', total: 12 }])
        .mockResolvedValueOnce([{ score: '30', band: 'band1', source_country: 'GB' }]);
      const a = await controller.getAreaSummary('51.51', '-0.147', '700', 'Mayfair', '0');

      execute
        .mockResolvedValueOnce([{ crime_type: 'theft', total: 3 }])
        .mockResolvedValueOnce([{ score: '70', band: 'band4', source_country: 'GB' }]);
      const b = await controller.getAreaSummary('51.5136', '-0.1365', '700', 'Soho', '0');

      expect(a.incidentCount).not.toBe(b.incidentCount);
    });
  });

  describe('getSafetyTiles', () => {
    it('includes incidentCount on each feature', async () => {
      // polygonToCells may return many; mock execute for scores then counts
      execute
        .mockResolvedValueOnce([
          { h3_index: '89194e6b257ffff', resolution: 9, score: 40, band: 'band2' },
        ])
        .mockResolvedValueOnce([{ h3: '89194e6b257ffff', total: 7 }]);

      const result = await controller.getSafetyTiles(
        '-0.15,51.50,-0.14,51.52',
        undefined,
        '9',
      );

      expect(result.type).toBe('FeatureCollection');
      expect(result.features[0].properties).toEqual(
        expect.objectContaining({
          h3: '89194e6b257ffff',
          incidentCount: 7,
        }),
      );
    });
  });
});
