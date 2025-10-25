/**
 * FacilityRepository Unit Tests
 */

import { Pool } from 'pg';
import { FacilityRepository } from '../../../src/repositories/facilityRepository';
import { NotFoundError, InternalServerError } from '../../../src/errors';

describe('FacilityRepository', () => {
  let mockPool: jest.Mocked<Pool>;
  let repository: FacilityRepository;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as any;
    repository = new FacilityRepository(mockPool);
  });

  describe('getFacilitiesByCompany', () => {
    it('should return facilities for a given company', async () => {
      const mockData = [
        {
          equipment_id: 1,
          equipment_name: 'Air Conditioner',
          model_number: 'AC-100',
          category: 'HVAC',
          quantity: 5,
          storage_location: 'Building A',
          purchase_date: new Date('2023-01-01'),
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockData } as any);

      const result = await repository.getFacilitiesByCompany(123);

      expect(result).toEqual(mockData);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [123]);
    });

    it('should return empty array if no facilities found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.getFacilitiesByCompany(999);

      expect(result).toEqual([]);
      expect(mockPool.query).toHaveBeenCalledTimes(1);
    });

    it('should throw InternalServerError on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      await expect(repository.getFacilitiesByCompany(123)).rejects.toThrow(InternalServerError);
    });
  });

  describe('getFacilityById', () => {
    it('should return facility by ID', async () => {
      const mockData = {
        equipment_id: 1,
        equipment_name: 'Air Conditioner',
        model_number: 'AC-100',
        category: 'HVAC',
        quantity: 5,
        storage_location: 'Building A',
        purchase_date: new Date('2023-01-01'),
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockData] } as any);

      const result = await repository.getFacilityById(1);

      expect(result).toEqual(mockData);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    it('should throw NotFoundError if facility not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await expect(repository.getFacilityById(999)).rejects.toThrow(NotFoundError);
      await expect(repository.getFacilityById(999)).rejects.toThrow(
        'Facility with ID 999 not found'
      );
    });

    it('should throw InternalServerError on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      await expect(repository.getFacilityById(1)).rejects.toThrow(InternalServerError);
    });
  });
});
