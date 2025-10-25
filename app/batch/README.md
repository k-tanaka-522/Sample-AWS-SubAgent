# Batch Processing

設備管理システムのバッチ処理

## 概要

月次・年次の集計レポートを生成し、S3バケットに保存します。

## バッチ処理一覧

### 1. 月次レポート (monthly-report)

**実行コマンド**:
```bash
node dist/monthly-report.js --year 2024 --month 10
```

**出力**:
- S3パス: `s3://facility-prod-reports/monthly-reports/2024/10/report.csv`
- 内容: 月次の設備ごとの発注実績、保守実績

**スケジュール**:
- 毎月1日 深夜2:00 (JST)
- EventBridge Scheduler による自動実行

### 2. 年次レポート (annual-report)

**実行コマンド**:
```bash
node dist/annual-report.js --year 2024
```

**出力**:
- S3パス: `s3://facility-prod-reports/annual-reports/2024/report.csv`
- 内容: 年次の設備ライフサイクル分析、保守間隔分析

**スケジュール**:
- 毎年1月1日 深夜2:00 (JST)
- EventBridge Scheduler による自動実行

## ローカル開発

### セットアップ

```bash
npm install
```

### 環境変数

```bash
# .env
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=facility_db
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_SSL=false
AWS_REGION=ap-northeast-1
S3_REPORTS_BUCKET=facility-dev-reports
```

### テスト実行

```bash
# 月次レポート
npm run dev:monthly -- --year 2024 --month 10

# 年次レポート
npm run dev:annual -- --year 2024
```

## Docker

### ビルド

```bash
docker build -t batch:latest .
```

### 実行

**月次レポート**:
```bash
docker run --rm \
  -e NODE_ENV=production \
  -e DATABASE_HOST=your-rds-endpoint \
  -e DATABASE_USER=postgres \
  -e DATABASE_PASSWORD=your-password \
  -e DATABASE_NAME=facility_db \
  -e DATABASE_SSL=true \
  -e S3_REPORTS_BUCKET=facility-prod-reports \
  batch:latest \
  node dist/monthly-report.js --year 2024 --month 10
```

**年次レポート**:
```bash
docker run --rm \
  -e NODE_ENV=production \
  -e DATABASE_HOST=your-rds-endpoint \
  -e S3_REPORTS_BUCKET=facility-prod-reports \
  batch:latest \
  node dist/annual-report.js --year 2024
```

## ECS Fargate での実行

EventBridge Scheduler が ECS Task を起動します:

```yaml
EventBridge Rule:
  ScheduleExpression: cron(0 17 L * ? *)  # 毎月末 17:00 UTC (翌日2:00 JST)
  Target:
    Arn: arn:aws:ecs:ap-northeast-1:123456789012:cluster/facility-prod-cluster
    EcsParameters:
      TaskDefinitionArn: arn:aws:ecs:ap-northeast-1:123456789012:task-definition/batch:1
      TaskCount: 1
      LaunchType: FARGATE
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `NODE_ENV` | 環境 | `development` |
| `DATABASE_HOST` | PostgreSQLホスト | `localhost` |
| `DATABASE_PORT` | PostgreSQLポート | `5432` |
| `DATABASE_NAME` | データベース名 | `facility_db` |
| `DATABASE_USER` | データベースユーザー | `postgres` |
| `DATABASE_PASSWORD` | データベースパスワード | (必須) |
| `DATABASE_SSL` | SSL接続を使用 | `true` |
| `S3_REPORTS_BUCKET` | レポート保存先S3バケット | `facility-prod-reports` |
| `AWS_REGION` | AWSリージョン | `ap-northeast-1` |
| `SECRETS_MANAGER_SECRET_NAME` | Secrets Managerシークレット名 | (本番のみ) |

## ライセンス

Proprietary
