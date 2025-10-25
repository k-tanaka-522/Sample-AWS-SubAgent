/**
 * Facility Repository
 * データアクセス層: 設備機器の取得
 */

import { Pool } from 'pg';
import { Equipment, Order, FacilityWithOrders } from '../types';
import { NotFoundError, InternalServerError } from '../errors';

export class FacilityRepository {
  constructor(private db: Pool) {}

  /**
   * Get all facilities assigned to a company
   */
  async getFacilitiesByCompany(companyId: number): Promise<FacilityWithOrders[]> {
    const query = `
      SELECT
        e.*,
        o.order_id,
        o.status AS order_status,
        o.order_date,
        o.delivery_date
      FROM equipment e
      LEFT JOIN LATERAL (
        SELECT * FROM orders
        WHERE company_id = $1
        AND order_id IN (
          SELECT DISTINCT order_id
          FROM order_items oi
          WHERE oi.equipment_id = e.equipment_id
        )
        ORDER BY order_date DESC
        LIMIT 1
      ) o ON true
      ORDER BY e.equipment_name ASC;
    `;

    try {
      const result = await this.db.query(query, [companyId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching facilities:', error);
      throw new InternalServerError('Failed to fetch facilities');
    }
  }

  /**
   * Get facility by ID
   */
  async getFacilityById(equipmentId: number): Promise<Equipment> {
    const query = `
      SELECT * FROM equipment
      WHERE equipment_id = $1;
    `;

    try {
      const result = await this.db.query(query, [equipmentId]);
      if (result.rows.length === 0) {
        throw new NotFoundError(`Facility with ID ${equipmentId} not found`);
      }
      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      console.error('Error fetching facility:', error);
      throw new InternalServerError('Failed to fetch facility');
    }
  }
}
