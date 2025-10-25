/**
 * 性能テスト: 混合シナリオ
 *
 * ツール: k6
 * 対象: 複数エンドポイントの混合負荷テスト
 * シナリオ: 設備一覧取得(70%) + 保守報告登録(20%) + 保守履歴取得(10%)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// カスタムメトリクス
const errorRate = new Rate('errors');
const facilitiesResponseTime = new Trend('facilities_response_time');
const maintenancePostResponseTime = new Trend('maintenance_post_response_time');
const historyResponseTime = new Trend('history_response_time');
const totalRequests = new Counter('total_requests');

// テスト設定
export const options = {
  scenarios: {
    // シナリオ1: 設備一覧取得（70%のトラフィック）
    facility_list: {
      executor: 'ramping-vus',
      exec: 'facilityListScenario',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 70 },   // 2分かけて70ユーザー
        { duration: '5m', target: 70 },   // 5分間維持
        { duration: '2m', target: 0 },    // 2分かけて0ユーザー
      ],
    },
    // シナリオ2: 保守報告登録（20%のトラフィック）
    maintenance_post: {
      executor: 'ramping-vus',
      exec: 'maintenancePostScenario',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '2m', target: 0 },
      ],
    },
    // シナリオ3: 保守履歴取得（10%のトラフィック）
    maintenance_history: {
      executor: 'ramping-vus',
      exec: 'maintenanceHistoryScenario',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 10 },
        { duration: '5m', target: 10 },
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:4000';
const AUTH_TOKEN = __ENV.API_AUTH_TOKEN || 'Bearer mock-jwt-token';

/**
 * シナリオ1: 設備一覧取得
 */
export function facilityListScenario() {
  group('設備一覧取得', () => {
    const response = http.get(`${BASE_URL}/api/facilities`, {
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const success = check(response, {
      'facilities: ステータス200': (r) => r.status === 200,
      'facilities: JSON形式': (r) => {
        try {
          return JSON.parse(r.body).success === true;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);
    facilitiesResponseTime.add(response.timings.duration);
    totalRequests.add(1);
  });

  sleep(Math.random() * 2 + 1);
}

/**
 * シナリオ2: 保守報告登録
 */
export function maintenancePostScenario() {
  group('保守報告登録', () => {
    const reportData = {
      equipment_id: Math.floor(Math.random() * 10) + 1,
      report_date: new Date().toISOString().split('T')[0],
      description: `混合シナリオテスト: ${new Date().toISOString()}`,
      next_maintenance_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    };

    const response = http.post(`${BASE_URL}/api/maintenance-reports`, JSON.stringify(reportData), {
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const success = check(response, {
      'maintenance_post: ステータス201': (r) => r.status === 201,
      'maintenance_post: report_id存在': (r) => {
        try {
          return JSON.parse(r.body).data.report_id > 0;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);
    maintenancePostResponseTime.add(response.timings.duration);
    totalRequests.add(1);
  });

  sleep(Math.random() * 3 + 2);
}

/**
 * シナリオ3: 保守履歴取得
 */
export function maintenanceHistoryScenario() {
  group('保守履歴取得', () => {
    const equipmentId = Math.floor(Math.random() * 10) + 1;
    const response = http.get(`${BASE_URL}/api/facilities/${equipmentId}/maintenance-history`, {
      headers: {
        Authorization: AUTH_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const success = check(response, {
      'history: ステータス200または404': (r) => r.status === 200 || r.status === 404,
      'history: JSON形式': (r) => {
        try {
          JSON.parse(r.body);
          return true;
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);
    historyResponseTime.add(response.timings.duration);
    totalRequests.add(1);
  });

  sleep(Math.random() * 2 + 1);
}

export function setup() {
  console.log('混合シナリオ性能テスト開始');
  console.log('設備一覧: 70%, 保守報告: 20%, 保守履歴: 10%');
}

export function teardown(data) {
  console.log('混合シナリオ性能テスト完了');
}
