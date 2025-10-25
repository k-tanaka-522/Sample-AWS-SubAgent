# Vendor API

事業者向けAPI for Facility Management System

## 概要

事業者が設備機器の情報を閲覧し、保守履歴を登録するためのREST APIです。

## 主要機能

- **GET /api/facilities**: 担当設備一覧取得
- **GET /api/facilities/:id**: 設備詳細取得
- **GET /api/facilities/:id/maintenance-history**: 保守履歴取得
- **POST /api/maintenance-reports**: 保守報告登録

## 技術スタック

- **Runtime**: Node.js 18
- **Framework**: Express
- **Database**: PostgreSQL (via pg)
- **Authentication**: Amazon Cognito (JWT)
- **Validation**: Joi
- **Testing**: Jest

## ローカル開発環境

### 必要な環境

- Node.js 18以上
- PostgreSQL 14
- AWS CLI (Secrets Manager使用時)

### セットアップ

1. 依存パッケージのインストール:
   ```bash
   npm install
   ```

2. 環境変数の設定:
   ```bash
   cp .env.example .env
   # .env ファイルを編集してデータベース接続情報を設定
   ```

3. データベースの準備:
   ```bash
   # PostgreSQLが起動していることを確認
   psql -U postgres -c "CREATE DATABASE facility_db;"

   # テーブル作成（スキーマは docs/03_基本設計/05_データベース設計.md 参照）
   psql -U postgres -d facility_db -f scripts/schema.sql
   ```

4. 開発サーバーの起動:
   ```bash
   npm run dev
   ```

### テストの実行

```bash
# すべてのテストを実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```

### ビルド

```bash
# TypeScriptのビルド
npm run build

# 本番モードで起動
npm start
```

## Docker

### イメージのビルド

```bash
docker build -t vendor-api:latest .
```

### コンテナの実行

```bash
docker run -d \
  -p 4000:4000 \
  -e NODE_ENV=production \
  -e DATABASE_HOST=your-rds-endpoint \
  -e DATABASE_USER=postgres \
  -e DATABASE_PASSWORD=your-password \
  -e DATABASE_NAME=facility_db \
  -e COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX \
  --name vendor-api \
  vendor-api:latest
```

## API仕様

### 認証

すべてのAPI（/health を除く）は、Authorization ヘッダーにCognito JWTトークンが必要です。

```http
Authorization: Bearer <JWT_TOKEN>
```

### エンドポイント

#### 1. ヘルスチェック

```http
GET /health
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-10-25T10:00:00.000Z",
  "environment": "development"
}
```

#### 2. 設備一覧取得

```http
GET /api/facilities
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "equipment_id": 1,
      "equipment_name": "Air Conditioner",
      "model_number": "AC-100",
      "category": "HVAC",
      "quantity": 5,
      "storage_location": "Building A",
      "purchase_date": "2023-01-01T00:00:00.000Z",
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    }
  ]
}
```

#### 3. 設備詳細取得

```http
GET /api/facilities/:id
Authorization: Bearer <JWT_TOKEN>
```

#### 4. 保守履歴取得

```http
GET /api/facilities/:id/maintenance-history
Authorization: Bearer <JWT_TOKEN>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "equipment": { ... },
    "reports": [
      {
        "report_id": 1,
        "equipment_id": 1,
        "company_id": 123,
        "report_date": "2024-10-01T00:00:00.000Z",
        "description": "Regular maintenance completed",
        "next_maintenance_date": "2025-10-01T00:00:00.000Z",
        "created_at": "2024-10-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### 5. 保守報告登録

```http
POST /api/maintenance-reports
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json

{
  "equipment_id": 1,
  "report_date": "2024-10-25",
  "description": "Monthly inspection completed",
  "next_maintenance_date": "2024-11-25"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "report_id": 1,
    "equipment_id": 1,
    "company_id": 123,
    "report_date": "2024-10-25T00:00:00.000Z",
    "description": "Monthly inspection completed",
    "next_maintenance_date": "2024-11-25T00:00:00.000Z",
    "created_at": "2024-10-25T10:00:00.000Z"
  }
}
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `NODE_ENV` | 環境 (development/production) | `development` |
| `PORT` | サーバーポート | `4000` |
| `DATABASE_HOST` | PostgreSQLホスト | `localhost` |
| `DATABASE_PORT` | PostgreSQLポート | `5432` |
| `DATABASE_NAME` | データベース名 | `facility_db` |
| `DATABASE_USER` | データベースユーザー | `postgres` |
| `DATABASE_PASSWORD` | データベースパスワード | (必須) |
| `DATABASE_SSL` | SSL接続を使用 | `true` |
| `COGNITO_USER_POOL_ID` | Cognitoユーザープール ID | (必須) |
| `COGNITO_REGION` | Cognitoリージョン | `ap-northeast-1` |
| `SECRETS_MANAGER_SECRET_NAME` | Secrets Managerシークレット名 | (本番のみ必須) |

## セキュリティ

- **TLS接続**: 本番環境ではデータベースへの接続にTLS必須
- **Prepared Statement**: SQLインジェクション対策
- **Helmet**: セキュリティヘッダーの設定
- **CORS**: CORS設定
- **JWT検証**: Cognito JWTの署名検証

## ライセンス

Proprietary
