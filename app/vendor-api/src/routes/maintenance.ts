/**
 * Maintenance Routes
 * 保守履歴取得・報告登録API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import Joi from 'joi';
import { MaintenanceRepository } from '../repositories/maintenanceRepository';
import { FacilityRepository } from '../repositories/facilityRepository';
import { AuthenticatedRequest, CreateMaintenanceReportDto } from '../types';
import { ValidationError, NotFoundError } from '../errors';

// Validation Schema
const createMaintenanceReportSchema = Joi.object({
  equipment_id: Joi.number().integer().positive().required(),
  report_date: Joi.date().iso().required(),
  description: Joi.string().min(1).max(1000).required(),
  next_maintenance_date: Joi.date().iso().optional(),
});

export function createMaintenanceRouter(db: Pool): Router {
  const router = Router();
  const maintenanceRepo = new MaintenanceRepository(db);
  const facilityRepo = new FacilityRepository(db);

  /**
   * GET /api/facilities/:id/maintenance-history
   * 設備の保守履歴を取得
   */
  router.get(
    '/facilities/:id/maintenance-history',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const equipmentId = parseInt(req.params.id, 10);
        if (isNaN(equipmentId)) {
          return res.status(400).json({ error: 'Invalid equipment ID' });
        }

        // Check if equipment exists
        const equipment = await facilityRepo.getFacilityById(equipmentId);
        const history = await maintenanceRepo.getMaintenanceHistory(equipmentId);

        res.status(200).json({
          success: true,
          data: {
            equipment,
            reports: history,
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/maintenance-reports
   * 保守報告を登録
   */
  router.post('/maintenance-reports', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const companyId = parseInt(user['custom:company_id'], 10);

      // Validate input
      const { error, value } = createMaintenanceReportSchema.validate(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const dto: CreateMaintenanceReportDto = value;

      // Check if equipment exists
      const exists = await maintenanceRepo.equipmentExists(dto.equipment_id);
      if (!exists) {
        throw new NotFoundError(`Equipment with ID ${dto.equipment_id} not found`);
      }

      const report = await maintenanceRepo.createMaintenanceReport(companyId, dto);

      res.status(201).json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
