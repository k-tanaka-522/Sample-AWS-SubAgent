/**
 * MaintenanceRepository Unit Tests
 */

import { Pool } from 'pg';
import { MaintenanceRepository } from '../../../src/repositories/maintenanceRepository';
import { CreateMaintenanceReportDto } from '../../../src/types';
import { InternalServerError } from '../../../src/errors';

describe('MaintenanceRepository', () => {
  let mockPool: jest.Mocked<Pool>;
  let repository: MaintenanceRepository;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
    } as any;
    repository = new MaintenanceRepository(mockPool);
  });

  describe('getMaintenanceHistory', () => {
    it('should return maintenance history for equipment', async () => {
      const mockData = [
        {
          report_id: 1,
          equipment_id: 1,
          company_id: 123,
          report_date: new Date('2024-10-01'),
          description: 'Regular maintenance completed',
          next_maintenance_date: new Date('2025-10-01'),
          created_at: new Date(),
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockData } as any);

      const result = await repository.getMaintenanceHistory(1);

      expect(result).toEqual(mockData);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    it('should return empty array if no history found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.getMaintenanceHistory(999);

      expect(result).toEqual([]);
    });

    it('should throw InternalServerError on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      await expect(repository.getMaintenanceHistory(1)).rejects.toThrow(InternalServerError);
    });
  });

  describe('createMaintenanceReport', () => {
    it('should create a new maintenance report', async () => {
      const dto: CreateMaintenanceReportDto = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: 'Monthly inspection completed',
        next_maintenance_date: '2024-11-25',
      };

      const mockResult = {
        report_id: 1,
        equipment_id: 1,
        company_id: 123,
        report_date: new Date('2024-10-25'),
        description: 'Monthly inspection completed',
        next_maintenance_date: new Date('2024-11-25'),
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockResult] } as any);

      const result = await repository.createMaintenanceReport(123, dto);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        1,
        123,
        '2024-10-25',
        'Monthly inspection completed',
        '2024-11-25',
      ]);
    });

    it('should create report without next_maintenance_date', async () => {
      const dto: CreateMaintenanceReportDto = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: 'Emergency repair',
      };

      const mockResult = {
        report_id: 2,
        equipment_id: 1,
        company_id: 123,
        report_date: new Date('2024-10-25'),
        description: 'Emergency repair',
        next_maintenance_date: null,
        created_at: new Date(),
      };

      mockPool.query.mockResolvedValue({ rows: [mockResult] } as any);

      const result = await repository.createMaintenanceReport(123, dto);

      expect(result).toEqual(mockResult);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [
        1,
        123,
        '2024-10-25',
        'Emergency repair',
        null,
      ]);
    });

    it('should throw InternalServerError on database error', async () => {
      const dto: CreateMaintenanceReportDto = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: 'Test',
      };

      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      await expect(repository.createMaintenanceReport(123, dto)).rejects.toThrow(
        InternalServerError
      );
    });
  });

  describe('equipmentExists', () => {
    it('should return true if equipment exists', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ '?column?': 1 }] } as any);

      const result = await repository.equipmentExists(1);

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [1]);
    });

    it('should return false if equipment does not exist', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const result = await repository.equipmentExists(999);

      expect(result).toBe(false);
    });

    it('should throw InternalServerError on database error', async () => {
      mockPool.query.mockRejectedValue(new Error('DB connection failed'));

      await expect(repository.equipmentExists(1)).rejects.toThrow(InternalServerError);
    });
  });
});
