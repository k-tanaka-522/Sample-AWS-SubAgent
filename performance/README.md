# 性能テスト (k6)

役所設備管理システムの性能テスト（Performance Test）です。

## 概要

**ツール**: k6 (Grafana Labs)
**対象**: vendor-api（設備一覧、保守報告登録）
**目標**:
- 設備一覧API: 応答時間 95%ile < 500ms
- 保守報告API: 応答時間 95%ile < 1000ms
- エラー率: < 1%

## セットアップ

### k6のインストール

#### macOS (Homebrew)

```bash
brew install k6
```

#### Windows (Chocolatey)

```bash
choco install k6
```

#### Linux

```bash
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

公式: https://k6.io/docs/get-started/installation/

## テスト実行

### 1. 設備一覧API（GET /api/facilities）

```bash
# ローカル環境
k6 run k6-facility-list.js

# カスタムURL・認証トークン指定
k6 run -e API_BASE_URL=https://api.facility.example.com \
       -e API_AUTH_TOKEN="Bearer your-jwt-token" \
       k6-facility-list.js
```

**負荷プロファイル**:
- ウォームアップ: 1分かけて10ユーザー
- 負荷増加: 3分かけて50ユーザー
- ピーク: 5分間100ユーザー維持
- クールダウン: 2分かけて50ユーザー
- 終了: 1分かけて0ユーザー

**合計時間**: 約12分

### 2. 保守報告登録API（POST /api/maintenance-reports）

```bash
k6 run k6-maintenance-post.js
```

**負荷プロファイル**:
- ウォームアップ: 1分かけて5ユーザー
- 負荷増加: 3分かけて25ユーザー
- ピーク: 5分間50ユーザー維持
- クールダウン: 2分かけて25ユーザー
- 終了: 1分かけて0ユーザー

**合計時間**: 約12分

### 3. 混合シナリオ（設備一覧70% + 保守報告20% + 保守履歴10%）

```bash
k6 run k6-mixed-scenario.js
```

**負荷プロファイル**:
- 設備一覧: 70ユーザー（70%のトラフィック）
- 保守報告: 20ユーザー（20%のトラフィック）
- 保守履歴: 10ユーザー（10%のトラフィック）
- **合計**: 100ユーザー同時接続

**合計時間**: 約9分

## 結果の見方

### コンソール出力

```
scenarios: (100.00%) 1 scenario, 100 max VUs, 12m30s max duration
✓ ステータスコードが200

checks.........................: 100.00% ✓ 12000      ✗ 0
data_received..................: 1.2 MB  100 kB/s
data_sent......................: 800 kB  67 kB/s
http_req_duration..............: avg=250ms  min=50ms  med=200ms  max=1500ms  p(95)=450ms  p(99)=800ms
http_req_failed................: 0.00%   ✓ 0         ✗ 12000
http_reqs......................: 12000   1000/s
iteration_duration.............: avg=2.5s  min=1.5s  med=2.3s  max=5s
iterations.....................: 12000   1000/s
vus............................: 100     min=0       max=100
vus_max........................: 100     min=100     max=100
```

### 主要メトリクス

| メトリクス | 説明 |
|----------|------|
| `http_req_duration` | HTTPリクエストの応答時間 |
| `p(95)` | 95パーセンタイル（95%のリクエストがこの時間以内） |
| `http_req_failed` | 失敗したリクエストの割合 |
| `checks` | 検証項目の合格率 |
| `iterations` | 実行された仮想ユーザーの反復回数 |
| `vus` | 仮想ユーザー数（Virtual Users） |

### 合格基準

| 項目 | 目標値 | 評価 |
|------|--------|------|
| 応答時間（95%ile） | < 500ms | ✅ Pass (450ms) |
| エラー率 | < 1% | ✅ Pass (0%) |
| リクエスト失敗率 | < 1% | ✅ Pass (0%) |

## HTML/JSONレポート出力

```bash
# JSON形式で出力
k6 run --out json=results.json k6-facility-list.js

# InfluxDB + Grafanaで可視化（オプション）
k6 run --out influxdb=http://localhost:8086/k6 k6-facility-list.js
```

## CI/CD統合

GitHub Actionsでの実行例:

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 3 * * 1'  # 毎週月曜日 深夜3時
  workflow_dispatch:

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      - name: Run performance tests
        run: |
          cd performance
          k6 run --out json=results.json k6-mixed-scenario.js
        env:
          API_BASE_URL: https://staging.facility.example.com
          API_AUTH_TOKEN: ${{ secrets.API_AUTH_TOKEN }}
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: performance/results.json
```

## トラブルシューティング

### 「Too many open files」エラー

Linux/macOSで接続数が多い場合、ファイルディスクリプタの上限を増やしてください。

```bash
# 現在の上限確認
ulimit -n

# 上限を増やす
ulimit -n 10000
```

### 認証エラー

環境変数 `API_AUTH_TOKEN` にCognito JWTトークンを設定してください。

```bash
# トークン取得（AWS CLI）
aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --client-id YOUR_CLIENT_ID \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPass123!
```

### タイムアウトエラー

スクリプト内の `thresholds` を調整してください。

```javascript
thresholds: {
  http_req_duration: ['p(95)<1000'],  // 500ms → 1000ms に変更
}
```

## 参考リンク

- [k6公式ドキュメント](https://k6.io/docs/)
- [負荷テストガイド](https://k6.io/docs/test-types/load-testing/)
- [結果分析ガイド](https://k6.io/docs/results-output/)
