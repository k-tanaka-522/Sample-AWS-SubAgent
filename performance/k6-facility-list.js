/**
 * 性能テスト: 設備一覧API
 *
 * ツール: k6
 * 対象: GET /api/facilities
 * 目標: 応答時間 95%ile < 500ms、エラー率 < 1%
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
    { duration: '1m', target: 10 },   // ウォームアップ: 1分かけて10ユーザーまで増加
    { duration: '3m', target: 50 },   // 負荷増加: 3分かけて50ユーザーまで増加
    { duration: '5m', target: 100 },  // ピーク: 5分間100ユーザーを維持
    { duration: '2m', target: 50 },   // クールダウン: 2分かけて50ユーザーに減少
    { duration: '1m', target: 0 },    // 終了: 1分かけて0ユーザーに減少
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95パーセンタイルが500ms未満
    'http_req_duration{staticAsset:yes}': ['p(95)<100'],  // 静的ファイルは100ms未満
    errors: ['rate<0.01'],  // エラー率 1% 未満
    http_req_failed: ['rate<0.01'],  // リクエスト失敗率 1% 未満
  },
};

// 環境変数
const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.API_AUTH_TOKEN || 'Bearer mock-jwt-token';

/**
 * メインテストシナリオ
 */
export default function () {
  // 設備一覧取得
  const response = http.get(`${BASE_URL}/api/facilities`, {
    headers: {
      Authorization: AUTH_TOKEN,
      'Content-Type': 'application/json',
    },
  });

  // レスポンス検証
  const success = check(response, {
    'ステータスコードが200': (r) => r.status === 200,
    'レスポンスボディが存在': (r) => r.body.length > 0,
    'JSONフォーマットが正しい': (r) => {
      try {
        const json = JSON.parse(r.body);
        return json.success === true && Array.isArray(json.data);
      } catch (e) {
        return false;
      }
    },
    '応答時間が500ms未満': (r) => r.timings.duration < 500,
  });

  // メトリクス記録
  errorRate.add(!success);
  responseTime.add(response.timings.duration);

  // 次のリクエストまでランダムな待機時間（1-3秒）
  sleep(Math.random() * 2 + 1);
}

/**
 * テスト開始時の処理
 */
export function setup() {
  console.log('性能テスト開始: 設備一覧API');
  console.log(`対象URL: ${BASE_URL}/api/facilities`);
}

/**
 * テスト終了時の処理
 */
export function teardown(data) {
  console.log('性能テスト完了');
}
