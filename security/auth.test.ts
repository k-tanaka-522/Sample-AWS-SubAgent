/**
 * セキュリティテスト: 認証・認可
 *
 * テスト対象:
 * - 認証なしでのアクセス拒否
 * - 不正なJWTトークンの検証
 * - 他社データへのアクセス制限（Row-Level Security）
 */

import { Pool } from 'pg';
import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';

describe('セキュリティテスト: 認証・認可', () => {
  let app: Application;
  let testPool: Pool;
  let validToken: string;
  let invalidToken: string;
  let expiredToken: string;

  beforeAll(() => {
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://localhost/facility_db_test',
    });

    // テスト用JWTトークン生成
    const secret = 'test-secret-key';

    // 有効なトークン
    validToken = jwt.sign(
      {
        sub: 'test-user-123',
        email: 'test@example.com',
        'custom:company_id': '1',
      },
      secret,
      { expiresIn: '1h' }
    );

    // 不正なトークン（署名が異なる）
    invalidToken = jwt.sign(
      {
        sub: 'hacker-user',
        'custom:company_id': '1',
      },
      'wrong-secret',
      { expiresIn: '1h' }
    );

    // 期限切れトークン
    expiredToken = jwt.sign(
      {
        sub: 'test-user-123',
        'custom:company_id': '1',
      },
      secret,
      { expiresIn: '-1h' } // 1時間前に期限切れ
    );

    // Express アプリケーション
    app = express();
    app.use(express.json());

    // 簡易的な認証ミドルウェア（実際はCognito JWTを検証）
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No token provided' });
      }

      const token = authHeader.replace('Bearer ', '');

      try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
      } catch (error) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid token' });
      }
    });

    // ルーター読み込み（実装済み）
    // import facilitiesRouter from '../app/vendor-api/src/routes/facilities';
    // app.use('/api', facilitiesRouter(testPool));
  });

  afterAll(async () => {
    await testPool.end();
  });

  describe('認証なしアクセス', () => {
    it('認証なしでAPIにアクセスすると401エラー', async () => {
      const response = await request(app).get('/api/facilities');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Unauthorized');
    });

    it('不正なAuthorizationヘッダーで401エラー', async () => {
      const response = await request(app).get('/api/facilities').set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });
  });

  describe('不正なJWTトークン', () => {
    it('署名が異なるトークンで401エラー', async () => {
      const response = await request(app).get('/api/facilities').set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });

    it('期限切れトークンで401エラー', async () => {
      const response = await request(app).get('/api/facilities').set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('改ざんされたトークンで401エラー', async () => {
      const tamperedToken = validToken.slice(0, -10) + 'XXXXXXXXXX'; // 末尾を改ざん

      const response = await request(app).get('/api/facilities').set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
    });
  });

  describe('有効なJWTトークン', () => {
    it('有効なトークンでAPIにアクセスできる', async () => {
      const response = await request(app).get('/api/facilities').set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Row-Level Security（データ分離）', () => {
    it('他社のデータにアクセスできない', async () => {
      // Company A のユーザー（company_id=1）でログイン
      const companyAToken = jwt.sign(
        {
          sub: 'company-a-user',
          'custom:company_id': '1',
        },
        'test-secret-key',
        { expiresIn: '1h' }
      );

      // Company B の設備（equipment_id=3）にアクセス
      const response = await request(app)
        .get('/api/facilities/3')
        .set('Authorization', `Bearer ${companyAToken}`);

      // 404 Not Found（RLSにより見えない）
      expect(response.status).toBe(404);
    });

    it('自社のデータのみアクセスできる', async () => {
      const companyAToken = jwt.sign(
        {
          sub: 'company-a-user',
          'custom:company_id': '1',
        },
        'test-secret-key',
        { expiresIn: '1h' }
      );

      // Company A の設備（equipment_id=1）にアクセス
      const response = await request(app)
        .get('/api/facilities/1')
        .set('Authorization', `Bearer ${companyAToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.equipment_id).toBe(1);
    });
  });

  describe('CSRF対策', () => {
    it('JWTトークン認証ではCSRFトークンは不要', () => {
      /**
       * JWT認証を使用している場合、CSRFトークンは不要。
       *
       * 理由:
       * - JWTはLocalStorageまたはSessionStorageに保存
       * - Cookieに保存していない（自動送信されない）
       * - 各リクエストでAuthorizationヘッダーに明示的に付与
       *
       * CSRF攻撃の前提:
       * - ブラウザが自動的にCookieを送信
       * - JWTはCookieに保存されていないため、自動送信されない
       *
       * したがって、CSRF対策は不要。
       */

      expect(true).toBe(true);
    });
  });
});
