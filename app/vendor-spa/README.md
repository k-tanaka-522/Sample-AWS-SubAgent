# Vendor SPA

事業者向けフロントエンド（React SPA）

## 概要

事業者が担当設備を閲覧し、保守報告を登録するためのWebアプリケーションです。

## 主要機能

- ログイン（Amazon Cognito）
- 担当設備一覧
- 保守履歴閲覧
- 保守報告登録

## 技術スタック

- React 18
- TypeScript
- Vite (ビルドツール)
- React Router (ルーティング)
- TanStack Query (データフェッチ)
- AWS Amplify (Cognito認証)
- Axios (HTTP クライアント)

## ローカル開発

### セットアップ

```bash
npm install
```

### 環境変数

`.env` ファイルを作成:

```bash
VITE_API_ENDPOINT=http://localhost:4000
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3001 を開く

### ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに出力されます。

### プレビュー

```bash
npm run preview
```

## デプロイ

### S3 + CloudFront

```bash
# ビルド
npm run build

# S3にアップロード
aws s3 sync dist/ s3://facility-prod-vendor-spa --delete

# CloudFrontキャッシュ削除
aws cloudfront create-invalidation \
  --distribution-id E1XXXXXXXXXX \
  --paths "/*"
```

## ディレクトリ構造

```
src/
├── main.tsx           # エントリーポイント
├── App.tsx            # ルーティング設定
├── pages/             # ページコンポーネント
│   ├── LoginPage.tsx
│   ├── FacilityListPage.tsx
│   ├── MaintenanceHistoryPage.tsx
│   └── ReportFormPage.tsx
├── components/        # 再利用可能なコンポーネント
├── hooks/             # カスタムフック
│   └── useAuthenticator.ts
└── lib/               # ユーティリティ
    └── api.ts         # API クライアント
```

## ライセンス

Proprietary
