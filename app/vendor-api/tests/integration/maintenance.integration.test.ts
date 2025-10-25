/**
 * 統合テスト: 保守報告API
 *
 * テスト対象:
 * - GET /api/facilities/:id/maintenance-history - 保守履歴取得
 * - POST /api/maintenance-reports - 保守報告登録
 */

import { Pool } from 'pg';
import request from 'supertest';
import express, { Application } from 'express';
import { setupTestDatabase, teardownTestDatabase, seedTestData, clearTestData } from './setup';
import facilitiesRouter from '../../src/routes/facilities';
import maintenanceRouter from '../../src/routes/maintenance';
import errorHandler from '../../src/middleware/errorHandler';

describe('Integration Test: Maintenance API', () => {
  let app: Application;
  let testPool: Pool;
  let authToken: string;

  beforeAll(async () => {
    testPool = await setupTestDatabase();

    app = express();
    app.use(express.json());

    // モック認証（company_id=1）
    app.use((req, res, next) => {
      req.user = {
        sub: 'test-user-123',
        email: 'test@example.com',
        'custom:company_id': '1',
      };
      next();
    });

    app.use('/api', facilitiesRouter(testPool));
    app.use('/api', maintenanceRouter(testPool));
    app.use(errorHandler);

    authToken = 'Bearer mock-jwt-token';
  }, 120000);

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData(testPool);
    await seedTestData(testPool);
    await testPool.query("SET app.company_id = '1'");
  });

  describe('GET /api/facilities/:id/maintenance-history', () => {
    it('正常系: 保守履歴を取得できる', async () => {
      const response = await request(app)
        .get('/api/facilities/1/maintenance-history')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2); // 設備ID=1の履歴は2件

      // データ検証
      const report = response.body.data[0];
      expect(report).toHaveProperty('report_id');
      expect(report).toHaveProperty('equipment_id', 1);
      expect(report).toHaveProperty('report_date');
      expect(report).toHaveProperty('description');
      expect(report).toHaveProperty('next_maintenance_date');
    });

    it('正常系: 保守履歴がない場合は空配列を返す', async () => {
      const response = await request(app)
        .get('/api/facilities/2/maintenance-history')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
    });

    it('異常系: 存在しない設備IDで404エラー', async () => {
      const response = await request(app)
        .get('/api/facilities/9999/maintenance-history')
        .set('Authorization', authToken);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/maintenance-reports', () => {
    it('正常系: 保守報告を登録できる', async () => {
      const reportData = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: 'Integration test report',
        next_maintenance_date: '2024-11-25',
      };

      const response = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(reportData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report_id');
      expect(response.body.data).toHaveProperty('equipment_id', 1);
      expect(response.body.data).toHaveProperty('company_id', 1);
      expect(response.body.data.description).toBe('Integration test report');

      // データベースに保存されていることを確認
      const dbResult = await testPool.query(
        'SELECT * FROM maintenance_reports WHERE report_id = $1',
        [response.body.data.report_id]
      );
      expect(dbResult.rows.length).toBe(1);
      expect(dbResult.rows[0].description).toBe('Integration test report');
    });

    it('正常系: next_maintenance_date なしでも登録できる', async () => {
      const reportData = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: 'No next maintenance',
      };

      const response = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(reportData);

      expect(response.status).toBe(201);
      expect(response.body.data.next_maintenance_date).toBeNull();
    });

    it('異常系: 必須項目欠如で400エラー', async () => {
      const invalidData = {
        equipment_id: 1,
        // report_date が欠如
      };

      const response = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(invalidData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('異常系: 存在しない設備IDで404エラー', async () => {
      const reportData = {
        equipment_id: 9999,
        report_date: '2024-10-25',
        description: 'Test',
      };

      const response = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(reportData);

      expect(response.status).toBe(404);
    });

    it('セキュリティ: 他社の設備に保守報告を登録できない', async () => {
      const reportData = {
        equipment_id: 3, // Company B の設備
        report_date: '2024-10-25',
        description: 'Unauthorized attempt',
      };

      const response = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(reportData);

      // RLSにより404が返る（設備が見えない）
      expect(response.status).toBe(404);
    });

    it('異常系: 不正な日付フォーマットで400エラー', async () => {
      const reportData = {
        equipment_id: 1,
        report_date: 'invalid-date',
        description: 'Test',
      };

      const response = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(reportData);

      expect(response.status).toBe(400);
    });
  });

  describe('End-to-End Flow', () => {
    it('設備登録 → 保守報告 → 履歴取得の一連の流れ', async () => {
      // 1. 設備一覧取得
      const facilitiesRes = await request(app)
        .get('/api/facilities')
        .set('Authorization', authToken);
      expect(facilitiesRes.status).toBe(200);
      const equipmentId = facilitiesRes.body.data[0].equipment_id;

      // 2. 保守報告登録
      const reportData = {
        equipment_id: equipmentId,
        report_date: '2024-10-25',
        description: 'E2E test report',
        next_maintenance_date: '2024-11-25',
      };
      const createRes = await request(app)
        .post('/api/maintenance-reports')
        .set('Authorization', authToken)
        .send(reportData);
      expect(createRes.status).toBe(201);

      // 3. 保守履歴取得
      const historyRes = await request(app)
        .get(`/api/facilities/${equipmentId}/maintenance-history`)
        .set('Authorization', authToken);
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.data.length).toBeGreaterThan(0);

      // 4. 最新の報告が含まれていることを確認
      const latestReport = historyRes.body.data.find(
        (r: any) => r.description === 'E2E test report'
      );
      expect(latestReport).toBeDefined();
      expect(latestReport.equipment_id).toBe(equipmentId);
    });
  });
});
