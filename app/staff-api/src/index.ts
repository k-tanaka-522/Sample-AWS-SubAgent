import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import winston from 'winston';

// 環境変数読み込み
dotenv.config();

// ==============================================================================
// Logger設定
// ==============================================================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// ==============================================================================
// Database接続
// ==============================================================================
const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: true,
  },
  max: 20, // 最大接続数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// ==============================================================================
// Express アプリケーション
// ==============================================================================
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェア
app.use(helmet()); // セキュリティヘッダー
app.use(cors()); // CORS
app.use(express.json()); // JSON パース

// ==============================================================================
// ヘルスチェックエンドポイント
// ==============================================================================
app.get('/health', async (req: Request, res: Response) => {
  try {
    // DB接続確認
    await pool.query('SELECT 1');

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'staff-api',
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'staff-api',
      error: 'Database connection failed',
    });
  }
});

// ==============================================================================
// API エンドポイント（サンプル）
// ==============================================================================

// 設備機器一覧取得
app.get('/api/equipment', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM equipment LIMIT 100');

    logger.info('Equipment list fetched', { count: result.rows.length });

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Failed to fetch equipment', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// 発注一覧取得
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT o.*, u.username, c.company_name
       FROM orders o
       JOIN users u ON o.user_id = u.user_id
       JOIN companies c ON o.company_id = c.company_id
       ORDER BY o.order_date DESC
       LIMIT 100`
    );

    logger.info('Orders list fetched', { count: result.rows.length });

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Failed to fetch orders', { error });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// ==============================================================================
// エラーハンドリング
// ==============================================================================
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error', { error: err });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// ==============================================================================
// サーバー起動
// ==============================================================================
app.listen(PORT, () => {
  logger.info(`Staff API started`, {
    port: PORT,
    nodeEnv: process.env.NODE_ENV,
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server...');
  await pool.end();
  process.exit(0);
});
