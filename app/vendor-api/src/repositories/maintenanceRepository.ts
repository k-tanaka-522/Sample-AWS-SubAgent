/**
 * Maintenance Repository
 * データアクセス層: 保守履歴の取得・登録
 */

import { Pool } from 'pg';
import { MaintenanceReport, CreateMaintenanceReportDto } from '../types';
import { InternalServerError, NotFoundError } from '../errors';

export class MaintenanceRepository {
  constructor(private db: Pool) {}

  /**
   * Get maintenance history for a facility
   */
  async getMaintenanceHistory(equipmentId: number): Promise<MaintenanceReport[]> {
    const query = `
      SELECT * FROM maintenance_reports
      WHERE equipment_id = $1
      ORDER BY report_date DESC;
    `;

    try {
      const result = await this.db.query(query, [equipmentId]);
      return result.rows;
    } catch (error) {
      console.error('Error fetching maintenance history:', error);
      throw new InternalServerError('Failed to fetch maintenance history');
    }
  }

  /**
   * Create a new maintenance report
   */
  async createMaintenanceReport(
    companyId: number,
    dto: CreateMaintenanceReportDto
  ): Promise<MaintenanceReport> {
    const query = `
      INSERT INTO maintenance_reports (
        equipment_id,
        company_id,
        report_date,
        description,
        next_maintenance_date
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    try {
      const result = await this.db.query(query, [
        dto.equipment_id,
        companyId,
        dto.report_date,
        dto.description,
        dto.next_maintenance_date || null,
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error creating maintenance report:', error);
      throw new InternalServerError('Failed to create maintenance report');
    }
  }

  /**
   * Check if equipment exists
   */
  async equipmentExists(equipmentId: number): Promise<boolean> {
    const query = `
      SELECT 1 FROM equipment
      WHERE equipment_id = $1;
    `;

    try {
      const result = await this.db.query(query, [equipmentId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking equipment existence:', error);
      throw new InternalServerError('Failed to check equipment existence');
    }
  }
}
