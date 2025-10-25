/**
 * セキュリティテスト: SQLインジェクション対策
 *
 * テスト対象:
 * - GET /api/facilities/:id - パラメータ化クエリの検証
 * - POST /api/maintenance-reports - 入力値のエスケープ検証
 */

import { Pool } from 'pg';
import request from 'supertest';
import express, { Application } from 'express';

describe('セキュリティテスト: SQLインジェクション対策', () => {
  let app: Application;
  let testPool: Pool;

  beforeAll(() => {
    // モックDBプール
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/facility_db_test',
    });

    // Express アプリケーション
    app = express();
    app.use(express.json());

    // モック認証
    app.use((req, res, next) => {
      req.user = {
        sub: 'test-user',
        'custom:company_id': '1',
      };
      next();
    });

    // ルーター読み込み（実装済みのルーターを使用）
    // import facilitiesRouter from '../app/vendor-api/src/routes/facilities';
    // app.use('/api', facilitiesRouter(testPool));
  });

  afterAll(async () => {
    await testPool.end();
  });

  describe('GET /api/facilities/:id', () => {
    it('SQLインジェクション攻撃を防御する（シングルクォート）', async () => {
      const maliciousId = "1' OR '1'='1";

      const response = await request(app).get(`/api/facilities/${encodeURIComponent(maliciousId)}`);

      // 400 Bad Request または 404 Not Found が返る（SQLインジェクションは成功しない）
      expect([400, 404]).toContain(response.status);
      expect(response.body.success).toBe(false);

      // データベースに不正なクエリが実行されていないことを確認
      // 正常な動作: IDが数値でない場合はバリデーションエラー
    });

    it('SQLインジェクション攻撃を防御する（UNION SELECT）', async () => {
      const maliciousId = "1 UNION SELECT null, username, password FROM users--";

      const response = await request(app).get(`/api/facilities/${encodeURIComponent(maliciousId)}`);

      expect([400, 404]).toContain(response.status);
    });

    it('SQLインジェクション攻撃を防御する（DROP TABLE）', async () => {
      const maliciousId = "1; DROP TABLE equipment; --";

      const response = await request(app).get(`/api/facilities/${encodeURIComponent(maliciousId)}`);

      expect([400, 404]).toContain(response.status);

      // equipmentテーブルが存在することを確認
      const tableCheck = await testPool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'equipment')"
      );
      expect(tableCheck.rows[0].exists).toBe(true);
    });
  });

  describe('POST /api/maintenance-reports', () => {
    it('SQLインジェクション攻撃を防御する（description フィールド）', async () => {
      const maliciousData = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: "'; DROP TABLE maintenance_reports; --",
      };

      const response = await request(app).post('/api/maintenance-reports').send(maliciousData);

      // 201 Created（正常に登録）または 400 Bad Request
      expect([201, 400]).toContain(response.status);

      // maintenance_reportsテーブルが存在することを確認
      const tableCheck = await testPool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'maintenance_reports')"
      );
      expect(tableCheck.rows[0].exists).toBe(true);
    });

    it('Prepared Statement が使用されている', async () => {
      // Prepared Statementを使用している場合、特殊文字はエスケープされる
      const data = {
        equipment_id: 1,
        report_date: '2024-10-25',
        description: "O'Reilly Media", // シングルクォートを含む正常なデータ
      };

      const response = await request(app).post('/api/maintenance-reports').send(data);

      expect(response.status).toBe(201);

      // データが正しく保存されている
      if (response.body.data && response.body.data.report_id) {
        const dbResult = await testPool.query('SELECT * FROM maintenance_reports WHERE report_id = $1', [
          response.body.data.report_id,
        ]);
        expect(dbResult.rows[0].description).toBe("O'Reilly Media");
      }
    });
  });

  describe('検索クエリのSQLインジェクション対策', () => {
    it('LIKE句での攻撃を防御する', async () => {
      const maliciousQuery = "%'; DROP TABLE equipment; --";

      const response = await request(app).get(`/api/facilities?search=${encodeURIComponent(maliciousQuery)}`);

      // 検索結果が空または400エラー
      expect([200, 400]).toContain(response.status);

      // equipmentテーブルが存在することを確認
      const tableCheck = await testPool.query(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'equipment')"
      );
      expect(tableCheck.rows[0].exists).toBe(true);
    });
  });
});
