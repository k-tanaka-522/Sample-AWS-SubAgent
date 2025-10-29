# 役所設備管理システム - アプリケーション

## 概要

このディレクトリには、役所設備管理システムのアプリケーションコードが含まれています。

### 構成

```
src/
├── staff-api/      # 職員向けAPI
├── vendor-api/     # 業者向けAPI
└── batch/          # バッチ処理
```

## AWS X-Ray 統合

すべてのアプリケーションに AWS X-Ray SDK が統合されており、分散トレーシングが有効化されています。

### 設計書参照

- `docs/03_基本設計/07_監視ログ/監視ログ設計書.md` (セクション 7.11)
- `docs/03_基本設計/07_監視ログ/パラメーターシート.md` (セクション 6.5)

### X-Ray の機能

1. **リクエスト・レスポンスのトレーシング**
2. **カスタムアノテーション** (ユーザーID、HTTPメソッド、パス)
3. **カスタムサブセグメント** (ビジネスロジック単位)
4. **エラートレーシング** (HTTPステータスコード 5xx)
5. **サンプリングルール** (環境別: prod 5%, stg 10%, dev 100%)

### 環境変数

| 環境変数 | 説明 | デフォルト値 |
|---------|------|------------|
| `AWS_XRAY_DAEMON_ADDRESS` | X-Rayデーモンのアドレス | `localhost:2000` |
| `AWS_XRAY_CONTEXT_MISSING` | トレースコンテキストがない場合の動作 | `LOG_ERROR` |
| `AWS_XRAY_TRACING_NAME` | サービス名 | `facilities-{service}` |
| `NODE_ENV` | 環境 (dev/stg/prod) | `dev` |

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

## 各アプリケーションの詳細

### staff-api

職員向けAPI。設備一覧取得、設備詳細取得、設備作成等の機能を提供します。

詳細: [src/staff-api/README.md](./staff-api/README.md)

### vendor-api

業者向けAPI。作業報告、メンテナンス記録等の機能を提供します。

詳細: [src/vendor-api/README.md](./vendor-api/README.md)

### batch

定期バッチ処理。月次・年次集計等の機能を提供します。

詳細: [src/batch/README.md](./batch/README.md)

## 開発環境のセットアップ

### 前提条件

- Node.js 18以上
- npm 9以上
- Docker（X-Rayデーモンをローカルで動かす場合）

### インストール

各アプリケーションのディレクトリで以下を実行：

```bash
cd staff-api
npm install

cd ../vendor-api
npm install

cd ../batch
npm install
```

### X-Ray デーモンの起動（ローカル開発時）

```bash
docker run -d \
  --name xray-daemon \
  -p 2000:2000/udp \
  public.ecr.aws/xray/aws-xray-daemon:latest \
  -o
```

### 開発モードで起動

```bash
# staff-api
cd staff-api
npm run dev

# vendor-api
cd vendor-api
npm run dev

# batch
cd batch
npm run dev
```

### テスト実行

```bash
# すべてのアプリケーションでテストを実行
cd staff-api && npm test
cd ../vendor-api && npm test
cd ../batch && npm test
```

## デプロイ

### Docker イメージのビルド

各アプリケーションには Dockerfile が含まれています（未実装の場合は追加が必要）。

```bash
# staff-api
cd staff-api
docker build -t facilities-staff-api:latest .

# vendor-api
cd vendor-api
docker build -t facilities-vendor-api:latest .

# batch
cd batch
docker build -t facilities-batch:latest .
```

### ECR へのプッシュ

```bash
# ECR ログイン
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com

# タグ付け
docker tag facilities-staff-api:latest <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/facilities-staff-api:latest

# プッシュ
docker push <account-id>.dkr.ecr.ap-northeast-1.amazonaws.com/facilities-staff-api:latest
```

### ECS デプロイ

CloudFormation スタックの更新により、自動的にデプロイされます。

```bash
cd infra/cloudformation/workload-dev/stacks/4-ecs
./deploy.sh
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

### ローカル開発時の注意事項

ローカル開発時は、X-Rayデーモンが起動していない場合でも、アプリケーションは正常に動作します（`LOG_ERROR`戦略により、エラーログが出力されるのみ）。

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
