/**
 * AWS X-Ray Middleware
 *
 * Express アプリケーションに X-Ray トレーシングを統合します。
 *
 * 設計書参照:
 * - docs/03_基本設計/07_監視ログ/監視ログ設計書.md (セクション 7.11)
 * - docs/03_基本設計/07_監視ログ/パラメーターシート.md (セクション 6.5)
 */

import AWSXRay from 'aws-xray-sdk-core';
import { Express, Request, Response, NextFunction } from 'express';
import path from 'path';

/**
 * X-Ray 設定インターフェース
 */
export interface XRayConfig {
  serviceName: string;
  daemonAddress?: string;
  contextMissingStrategy?: string;
  samplingRulesPath?: string;
}

/**
 * 環境別のサンプリングレート取得
 *
 * - prod: 5%
 * - stg: 10%
 * - dev: 100%
 */
function getSamplingRateByEnvironment(): number {
  const env = process.env.NODE_ENV || 'dev';

  switch (env) {
    case 'production':
    case 'prod':
      return 0.05;
    case 'staging':
    case 'stg':
      return 0.10;
    case 'development':
    case 'dev':
    default:
      return 1.0;
  }
}

/**
 * X-Ray SDK 初期化
 *
 * @param config X-Ray設定
 */
export function initializeXRay(config: XRayConfig): void {
  // 1. コンテキスト欠損時の戦略設定
  const contextMissingStrategy = config.contextMissingStrategy || process.env.AWS_XRAY_CONTEXT_MISSING || 'LOG_ERROR';
  AWSXRay.setContextMissingStrategy(contextMissingStrategy);

  // 2. X-Ray デーモンのアドレス設定（サイドカーコンテナ）
  const daemonAddress = config.daemonAddress || process.env.AWS_XRAY_DAEMON_ADDRESS || 'localhost:2000';
  AWSXRay.setDaemonAddress(daemonAddress);

  // 3. サービス名の設定
  process.env.AWS_XRAY_TRACING_NAME = config.serviceName;

  console.log(`[X-Ray] Initialized with service name: ${config.serviceName}`);
  console.log(`[X-Ray] Daemon address: ${daemonAddress}`);
  console.log(`[X-Ray] Context missing strategy: ${contextMissingStrategy}`);
  console.log(`[X-Ray] Sampling rate: ${getSamplingRateByEnvironment() * 100}%`);
}

/**
 * Express に X-Ray ミドルウェアを適用
 *
 * @param app Express アプリケーション
 * @param serviceName サービス名（例: facilities-staff-api）
 */
export function applyXRayMiddleware(app: Express, serviceName: string): void {
  // X-Ray セグメント開始（リクエスト開始時）
  app.use(AWSXRay.express.openSegment(serviceName));

  // カスタムアノテーション追加（ユーザーID、アクション等）
  app.use(addCustomAnnotations);

  // 以降、通常のルーティング処理

  // X-Ray セグメント終了（レスポンス送信時）
  app.use(AWSXRay.express.closeSegment());
}

/**
 * カスタムアノテーションをセグメントに追加
 *
 * アノテーション:
 * - userId: ユーザーID（認証済みの場合）
 * - method: HTTPメソッド
 * - path: リクエストパス
 * - statusCode: HTTPステータスコード
 */
function addCustomAnnotations(req: Request, res: Response, next: NextFunction): void {
  const segment = AWSXRay.getSegment();

  if (segment) {
    // HTTPメソッドとパスを記録
    segment.addAnnotation('method', req.method);
    segment.addAnnotation('path', req.path);

    // ユーザーIDを記録（認証済みの場合）
    const userId = (req as any).user?.id || 'anonymous';
    segment.addAnnotation('userId', userId);

    // レスポンス送信時にステータスコードを記録
    res.on('finish', () => {
      segment.addAnnotation('statusCode', res.statusCode);

      // エラー時はエラー情報を記録
      if (res.statusCode >= 500) {
        segment.addError(new Error(`HTTP ${res.statusCode}`));
      }
    });
  }

  next();
}

/**
 * AWS SDK を X-Ray でラップ（S3, SES 等）
 *
 * @param AWS AWS SDK v2
 */
export function captureAWS(AWS: any): any {
  return AWSXRay.captureAWS(AWS);
}

/**
 * PostgreSQL クライアント（pg）を X-Ray でラップ
 *
 * @param pg pg モジュール
 */
export function capturePostgres(pg: any): any {
  return AWSXRay.capturePostgres(pg);
}

/**
 * カスタムサブセグメント作成（ビジネスロジック単位でトレース）
 *
 * @param name サブセグメント名
 * @param func 実行する関数
 */
export async function traceAsync<T>(name: string, func: () => Promise<T>): Promise<T> {
  const segment = AWSXRay.getSegment();

  if (!segment) {
    // セグメントがない場合はそのまま実行
    return await func();
  }

  const subsegment = segment.addNewSubsegment(name);

  try {
    const result = await func();
    subsegment.close();
    return result;
  } catch (error) {
    subsegment.addError(error as Error);
    subsegment.close();
    throw error;
  }
}
