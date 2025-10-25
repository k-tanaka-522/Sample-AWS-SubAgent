/**
 * Facilities Routes
 * 設備一覧取得API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { FacilityRepository } from '../repositories/facilityRepository';
import { AuthenticatedRequest } from '../types';

export function createFacilitiesRouter(db: Pool): Router {
  const router = Router();
  const facilityRepo = new FacilityRepository(db);

  /**
   * GET /api/facilities
   * 事業者に割り当てられた設備一覧を取得
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const companyId = parseInt(user['custom:company_id'], 10);
      const facilities = await facilityRepo.getFacilitiesByCompany(companyId);

      res.status(200).json({
        success: true,
        data: facilities,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/facilities/:id
   * 設備詳細を取得
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const equipmentId = parseInt(req.params.id, 10);
      if (isNaN(equipmentId)) {
        return res.status(400).json({ error: 'Invalid equipment ID' });
      }

      const facility = await facilityRepo.getFacilityById(equipmentId);

      res.status(200).json({
        success: true,
        data: facility,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
