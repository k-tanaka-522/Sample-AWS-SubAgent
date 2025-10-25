# Staff SPA

職員向けフロントエンド（React SPA）

## 概要

職員が設備管理、発注管理、レポート閲覧を行うためのWebアプリケーションです。

**注意**: このディレクトリは事業者SPA（vendor-spa）とほぼ同じ構成です。
実装内容は vendor-spa を参考に、以下の違いを適用してください:

## vendor-spa との主な違い

### 1. API エンドポイント

```bash
# vendor-spa
VITE_API_ENDPOINT=https://api.facility.example.com

# staff-spa
VITE_API_ENDPOINT=https://admin-api.facility.example.com
```

### 2. Cognito ユーザープール

```bash
# vendor-spa (事業者用)
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_YYYYYYYYY

# staff-spa (職員用)
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
```

### 3. アクセス方式

- **vendor-spa**: インターネット公開（CloudFront経由）
- **staff-spa**: VPN接続のみ（S3直接アクセス）

### 4. 主要機能

- ダッシュボード（設備一覧、保守状況）
- 設備詳細画面
- 保守スケジュール管理
- 事業者管理
- 発注管理（vendor-spa にはない）

## セットアップ

```bash
# 依存パッケージのインストール
npm install

# 環境変数設定
cp ../vendor-spa/.env .env
# .env を編集して職員用の設定に変更

# 開発サーバー起動
npm run dev
```

## デプロイ

```bash
# ビルド
npm run build

# S3にアップロード（VPC Endpoint経由のみアクセス可能）
aws s3 sync dist/ s3://facility-prod-admin-spa --delete
```

**注意**: CloudFront は使用しません。VPN接続した職員のみがS3に直接アクセスします。

## ライセンス

Proprietary
