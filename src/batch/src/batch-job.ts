/**
 * Batch Job - 月次・年次集計
 *
 * 設計書参照:
 * - docs/03_基本設計/05_アプリケーション/アプリケーション設計書.md
 * - docs/03_基本設計/07_監視ログ/監視ログ設計書.md (X-Ray統合)
 */

import AWSXRay from 'aws-xray-sdk-core';
import { initializeXRay, traceAsync } from './middleware/xray';

/**
 * バッチジョブクラス
 */
export class BatchJob {
  private serviceName: string;

  constructor() {
    this.serviceName = process.env.AWS_XRAY_TRACING_NAME || 'facilities-batch';
    this.initializeXRayIntegration();
  }

  /**
   * X-Ray 統合の初期化
   */
  private initializeXRayIntegration(): void {
    initializeXRay({
      serviceName: this.serviceName,
    });
  }

  /**
   * メイン処理
   */
  public async run(): Promise<void> {
    const segment = AWSXRay.getSegment() || AWSXRay.getNamespace().createSegment(this.serviceName);

    try {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: this.serviceName,
        message: 'Batch job started',
      }));

      // 月次集計処理
      await this.runMonthlyAggregation();

      // 年次集計処理
      await this.runYearlyAggregation();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: this.serviceName,
        message: 'Batch job completed successfully',
      }));

      segment.close();
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        service: this.serviceName,
        error: (error as Error).message,
        stack: (error as Error).stack,
      }));

      segment.addError(error as Error);
      segment.close();

      throw error;
    }
  }

  /**
   * 月次集計処理
   */
  private async runMonthlyAggregation(): Promise<void> {
    await traceAsync('monthlyAggregation', async () => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: this.serviceName,
        message: 'Monthly aggregation started',
      }));

      // ここで実際の月次集計処理を実装
      // - 設備稼働時間の集計
      // - メンテナンス実績の集計
      // - コスト集計 等

      // サンプル処理（3秒待機）
      await new Promise((resolve) => setTimeout(resolve, 3000));

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: this.serviceName,
        message: 'Monthly aggregation completed',
      }));
    });
  }

  /**
   * 年次集計処理
   */
  private async runYearlyAggregation(): Promise<void> {
    await traceAsync('yearlyAggregation', async () => {
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: this.serviceName,
        message: 'Yearly aggregation started',
      }));

      // ここで実際の年次集計処理を実装
      // - 年間稼働時間の集計
      // - 年間コスト集計
      // - 耐用年数分析 等

      // サンプル処理（2秒待機）
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'INFO',
        service: this.serviceName,
        message: 'Yearly aggregation completed',
      }));
    });
  }
}

// バッチジョブ実行（直接実行時）
if (require.main === module) {
  const job = new BatchJob();

  job.run()
    .then(() => {
      console.log('Batch job finished successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Batch job failed:', error);
      process.exit(1);
    });
}
