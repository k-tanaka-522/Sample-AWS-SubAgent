/**
 * Staff API - Express Application
 *
 * 職員向けAPI（設備管理システム）
 *
 * 設計書参照:
 * - docs/03_基本設計/05_アプリケーション/アプリケーション設計書.md
 * - docs/03_基本設計/07_監視ログ/監視ログ設計書.md (X-Ray統合)
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { initializeXRay, applyXRayMiddleware, traceAsync } from './middleware/xray';

/**
 * アプリケーションクラス
 */
export class App {
  private app: Express;
  private serviceName: string;

  constructor() {
    this.app = express();
    this.serviceName = process.env.AWS_XRAY_TRACING_NAME || 'facilities-staff-api';

    this.initializeXRayIntegration();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandlers();
  }

  /**
   * X-Ray 統合の初期化
   */
  private initializeXRayIntegration(): void {
    initializeXRay({
      serviceName: this.serviceName,
    });

    applyXRayMiddleware(this.app, this.serviceName);
  }

  /**
   * ミドルウェアの初期化
   */
  private initializeMiddlewares(): void {
    // JSON ボディパーサー
    this.app.use(express.json());

    // URL エンコードされたボディパーサー
    this.app.use(express.urlencoded({ extended: true }));

    // CORS 設定（本番環境では適切に制限すること）
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // リクエストログ
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString();
      console.log(JSON.stringify({
        timestamp,
        level: 'INFO',
        service: this.serviceName,
        method: req.method,
        path: req.path,
        message: `${req.method} ${req.path}`,
      }));
      next();
    });
  }

  /**
   * ルートの初期化
   */
  private initializeRoutes(): void {
    // ヘルスチェックエンドポイント
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({
        status: 'ok',
        service: this.serviceName,
        timestamp: new Date().toISOString(),
      });
    });

    // 設備一覧取得（サンプル）
    this.app.get('/api/equipment', async (req: Request, res: Response, next: NextFunction) => {
      try {
        // カスタムサブセグメント: ビジネスロジック単位でトレース
        const equipment = await traceAsync('getEquipmentList', async () => {
          // ここで実際のデータベースアクセスや外部API呼び出しを行う
          // 今回はサンプルデータを返す
          return [
            { id: 1, name: 'HVAC System A', type: 'HVAC', location: 'Building A', status: 'active' },
            { id: 2, name: 'Elevator B', type: 'Elevator', location: 'Building B', status: 'active' },
          ];
        });

        res.status(200).json(equipment);
      } catch (error) {
        next(error);
      }
    });

    // 設備詳細取得（サンプル）
    this.app.get('/api/equipment/:id', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const equipmentId = parseInt(req.params.id, 10);

        const equipment = await traceAsync('getEquipmentById', async () => {
          // ここで実際のデータベースアクセスを行う
          // 今回はサンプルデータを返す（IDが999999の場合はエラー）
          if (equipmentId === 999999) {
            return null;
          }

          return {
            id: equipmentId,
            name: `Equipment ${equipmentId}`,
            type: 'HVAC',
            location: 'Building A',
            status: 'active',
          };
        });

        if (!equipment) {
          return res.status(404).json({ error: 'Equipment not found' });
        }

        res.status(200).json(equipment);
      } catch (error) {
        next(error);
      }
    });

    // 設備作成（サンプル）
    this.app.post('/api/equipment', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { name, type, location } = req.body;

        const newEquipment = await traceAsync('createEquipment', async () => {
          // ここで実際のデータベース INSERT を行う
          // 今回はサンプルデータを返す
          return {
            id: Math.floor(Math.random() * 10000),
            name,
            type,
            location,
            status: 'active',
            createdAt: new Date().toISOString(),
          };
        });

        res.status(201).json(newEquipment);
      } catch (error) {
        next(error);
      }
    });
  }

  /**
   * エラーハンドラーの初期化
   */
  private initializeErrorHandlers(): void {
    // 404 Not Found
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path,
      });
    });

    // グローバルエラーハンドラー
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      const timestamp = new Date().toISOString();

      // エラーログ（構造化ログ）
      console.error(JSON.stringify({
        timestamp,
        level: 'ERROR',
        service: this.serviceName,
        method: req.method,
        path: req.path,
        error: err.message,
        stack: err.stack,
      }));

      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
      });
    });
  }

  /**
   * Express アプリケーションを取得
   */
  public getExpressApp(): Express {
    return this.app;
  }

  /**
   * サーバー起動
   */
  public listen(port: number): void {
    this.app.listen(port, () => {
      console.log(`[${this.serviceName}] Server is running on port ${port}`);
    });
  }
}

// サーバー起動（直接実行時）
if (require.main === module) {
  const port = parseInt(process.env.PORT || '3000', 10);
  const app = new App();
  app.listen(port);
}
