/**
 * 性能テスト: 保守報告登録API
 *
 * ツール: k6
 * 対象: POST /api/maintenance-reports
 * 目標: 応答時間 95%ile < 1000ms、エラー率 < 1%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// テスト設定
export const options = {
  stages: [
    { duration: '1m', target: 5 },    // ウォームアップ: 1分かけて5ユーザー
    { duration: '3m', target: 25 },   // 負荷増加: 3分かけて25ユーザー
    { duration: '5m', target: 50 },   // ピーク: 5分間50ユーザーを維持
    { duration: '2m', target: 25 },   // クールダウン: 2分かけて25ユーザー
    { duration: '1m', target: 0 },    // 終了: 1分かけて0ユーザー
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95パーセンタイルが1000ms未満
    errors: ['rate<0.01'],  // エラー率 1% 未満
    http_req_failed: ['rate<0.01'],  // リクエスト失敗率 1% 未満
  },
};

// 環境変数
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.API_AUTH_TOKEN || 'Bearer mock-jwt-token';

/**
 * テストデータ生成
 */
function generateReportData() {
  const now = new Date();
  const reportDate = now.toISOString().split('T')[0];
  const nextDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  return {
    equipment_id: Math.floor(Math.random() * 10) + 1,  // 1-10のランダムなID
    report_date: reportDate,
    description: `性能テスト: ${now.toISOString()}`,
    next_maintenance_date: nextDate,
  };
}

/**
 * メインテストシナリオ
 */
export default function () {
  // 保守報告データ生成
  const reportData = generateReportData();

  // POST リクエスト
  const response = http.post(`${BASE_URL}/api/maintenance-reports`, JSON.stringify(reportData), {
    headers: {
      Authorization: AUTH_TOKEN,
      'Content-Type': 'application/json',
    },
  });

  // レスポンス検証
  const success = check(response, {
    'ステータスコードが201': (r) => r.status === 201,
    'レスポンスボディが存在': (r) => r.body.length > 0,
    'JSONフォーマットが正しい': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.success === true && json.data && json.data.report_id;
      } catch (e) {
        return false;
      }
    },
    '応答時間が1000ms未満': (r) => r.timings.duration < 1000,
  });

  // メトリクス記録
  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  // 次のリクエストまで待機（2-5秒）
  sleep(Math.random() * 3 + 2);
}

/**
 * テスト開始時の処理
 */
export function setup() {
  console.log('性能テスト開始: 保守報告登録API');
  console.log(`対象URL: ${BASE_URL}/api/maintenance-reports`);

  // データベース初期化（オプション）
  // const setupResponse = http.get(`${BASE_URL}/test/setup`);
  // check(setupResponse, { 'セットアップ成功': (r) => r.status === 200 });
}

/**
 * テスト終了時の処理
 */
export function teardown(data) {
  console.log('性能テスト完了');

  // テストデータクリーンアップ（オプション）
  // http.get(`${BASE_URL}/test/cleanup`);
}
