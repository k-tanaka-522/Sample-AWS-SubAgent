# Facilities Staff API

役所設備管理システム - 職員向けAPI

## 概要

このAPIは、役所の職員が設備管理を行うためのバックエンドAPIです。AWS X-Rayによる分散トレーシングを統合しており、パフォーマンス分析とエラー追跡が可能です。

## 主な機能

- 設備一覧取得
- 設備詳細取得
- 設備作成・更新・削除
- AWS X-Ray による分散トレーシング
- 構造化ログ（JSON形式）
- ヘルスチェックエンドポイント

## AWS X-Ray 統合

### 設計書参照

- `docs/03_基本設計/07_監視ログ/監視ログ設計書.md` (セクション 7.11)
- `docs/03_基本設計/07_監視ログ/パラメーターシート.md` (セクション 6.5)

### X-Ray の機能

1. **リクエスト・レスポンスのトレーシング**
   - すべてのHTTPリクエストを自動トレース
   - レスポンスタイム、HTTPステータスコードの記録

2. **カスタムアノテーション**
   - ユーザーID、HTTPメソッド、パスを記録
   - CloudWatch Logs Insights で検索可能

3. **カスタムサブセグメント**
   - ビジネスロジック単位でトレース（例: `getEquipmentList`）
   - データベースアクセス、外部API呼び出しの可視化

4. **エラートレーシング**
   - HTTPステータスコード 5xx のエラーを自動記録
   - エラー発生箇所の特定

5. **サンプリングルール**
   - エラーリクエスト: 100%サンプリング
   - 高レイテンシーリクエスト（>1秒）: 100%サンプリング
   - 通常リクエスト: 環境別（prod: 5%, stg: 10%, dev: 100%）

### 環境変数

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `AWS_XRAY_DAEMON_ADDRESS` | X-Rayデーモンのアドレス | `localhost:2000` |
| `AWS_XRAY_CONTEXT_MISSING` | トレースコンテキストがない場合の動作 | `LOG_ERROR` |
| `AWS_XRAY_TRACING_NAME` | サービス名（X-Ray Service Mapで表示） | `facilities-staff-api` |
| `NODE_ENV` | 環境（dev/stg/prod） | `dev` |
| `PORT` | APIサーバーのポート | `3000` |

### ECS Fargate での実行

ECS Fargate では、X-Ray サイドカーコンテナと連携します。

#### タスク定義の設定例

```json
{
  "containerDefinitions": [
    {
      "name": "staff-api",
      "image": "your-ecr-repo/staff-api:latest",
      "environment": [
        {
          "name": "AWS_XRAY_DAEMON_ADDRESS",
          "value": "xray-daemon:2000"
        },
        {
          "name": "AWS_XRAY_CONTEXT_MISSING",
          "value": "LOG_ERROR"
        },
        {
          "name": "AWS_XRAY_TRACING_NAME",
          "value": "facilities-staff-api"
        }
      ],
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ]
    },
    {
      "name": "xray-daemon",
      "image": "public.ecr.aws/xray/aws-xray-daemon:latest",
      "cpu": 32,
      "memory": 256,
      "portMappings": [
        {
          "containerPort": 2000,
          "protocol": "udp"
        }
      ]
    }
  ]
}
```

## ローカル開発

### 前提条件

- Node.js 18以上
- npm 9以上
- Docker（X-Rayデーモンをローカルで動かす場合）

### インストール

```bash
npm install
```

### 開発モードで起動

```bash
npm run dev
```

### ビルド

```bash
npm run build
```

### 本番モードで起動

```bash
npm start
```

### テスト実行

```bash
# すべてのテストを実行
npm test

# カバレッジレポート付き
npm run test:coverage

# ウォッチモード
npm run test:watch
```

### リント・フォーマット

```bash
# ESLint チェック
npm run lint

# Prettier フォーマット
npm run format
```

## ローカル開発時の X-Ray 設定（オプション）

ローカル開発時にX-Rayを有効にする場合は、X-RayデーモンをDockerで起動します。

### X-Ray デーモンの起動

```bash
docker run -d \
  --name xray-daemon \
  -p 2000:2000/udp \
  public.ecr.aws/xray/aws-xray-daemon:latest \
  -o
```

### 環境変数の設定

```bash
export AWS_XRAY_DAEMON_ADDRESS=localhost:2000
export AWS_XRAY_CONTEXT_MISSING=LOG_ERROR
export AWS_XRAY_TRACING_NAME=facilities-staff-api-local
```

### X-Ray デーモンの停止

```bash
docker stop xray-daemon
docker rm xray-daemon
```

### 注意事項

ローカル開発時は、X-Rayデーモンが起動していない場合でも、アプリケーションは正常に動作します（`LOG_ERROR`戦略により、エラーログが出力されるのみ）。

## API エンドポイント

### ヘルスチェック

```
GET /health
```

**レスポンス**:
```json
{
  "status": "ok",
  "service": "facilities-staff-api",
  "timestamp": "2025-10-25T10:30:00.123Z"
}
```

### 設備一覧取得

```
GET /api/equipment
```

**レスポンス**:
```json
[
  {
    "id": 1,
    "name": "HVAC System A",
    "type": "HVAC",
    "location": "Building A",
    "status": "active"
  },
  {
    "id": 2,
    "name": "Elevator B",
    "type": "Elevator",
    "location": "Building B",
    "status": "active"
  }
]
```

### 設備詳細取得

```
GET /api/equipment/:id
```

**レスポンス**:
```json
{
  "id": 1,
  "name": "HVAC System A",
  "type": "HVAC",
  "location": "Building A",
  "status": "active"
}
```

### 設備作成

```
POST /api/equipment
Content-Type: application/json

{
  "name": "New Equipment",
  "type": "HVAC",
  "location": "Building C"
}
```

**レスポンス**:
```json
{
  "id": 1234,
  "name": "New Equipment",
  "type": "HVAC",
  "location": "Building C",
  "status": "active",
  "createdAt": "2025-10-25T10:30:00.123Z"
}
```

## 構造化ログの例

```json
{
  "timestamp": "2025-10-25T10:30:00.123Z",
  "level": "INFO",
  "service": "facilities-staff-api",
  "method": "GET",
  "path": "/api/equipment",
  "message": "GET /api/equipment"
}
```

エラー時:
```json
{
  "timestamp": "2025-10-25T10:30:00.123Z",
  "level": "ERROR",
  "service": "facilities-staff-api",
  "method": "GET",
  "path": "/api/equipment/999999",
  "error": "Equipment not found",
  "stack": "Error: Equipment not found\n    at ..."
}
```

## トラブルシューティング

### X-Ray トレースが表示されない

1. X-Rayデーモンが起動しているか確認
2. 環境変数 `AWS_XRAY_DAEMON_ADDRESS` が正しいか確認
3. IAM ロールに `xray:PutTraceSegments` 権限があるか確認

### テストが失敗する

```bash
# 依存関係の再インストール
npm ci

# キャッシュのクリア
npm run test -- --clearCache
```

## 技術スタック

- **Node.js**: 18以上
- **TypeScript**: 5.2以上
- **Express**: 4.18以上
- **AWS X-Ray SDK**: 3.5以上
- **Jest**: 29.7以上
- **Supertest**: 6.3以上

## ライセンス

UNLICENSED（内部プロジェクト）

## 参考資料

- [AWS X-Ray 開発者ガイド](https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html)
- [AWS X-Ray SDK for Node.js](https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-nodejs.html)
- [Express.js ドキュメント](https://expressjs.com/)
