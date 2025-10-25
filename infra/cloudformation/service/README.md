# CloudFormation Templates - Service Account

## 概要

設備管理サービスの Service Account 用 CloudFormation テンプレート集です。

**マルチアカウント構成**:
- **Shared Account**: Transit Gateway、Direct Connect、組織レベル監査基盤
- **Service Account**: アプリケーション実行環境（このディレクトリ）

---

## スタック構成

| スタック | 変更頻度 | 含まれるリソース |
|---------|--------|----------------|
| **01-network** | 年1回 | VPC, Subnets, NAT Gateway, Security Groups, Transit Gateway Attachment |
| **02-database** | 月1回 | RDS PostgreSQL, DB Subnet Group, Parameter Group |
| **03-compute** | 週数回 | ECS Cluster, Task Definitions, Services, ALB, Target Groups |
| **04-auth** | 月1回 | Cognito User Pools (staff, vendor) |
| **05-storage** | 月1回 | S3 (frontend, logs), CloudFront |
| **06-monitoring** | 月1回 | CloudWatch Alarms, SNS Topic |

---

## ディレクトリ構成

```
service/
├── 01-network/
│   ├── stack.yaml                        # 親スタック
│   └── nested/
│       ├── vpc.yaml
│       ├── subnets.yaml
│       ├── nat-gateway.yaml
│       ├── route-tables.yaml
│       ├── security-groups.yaml
│       └── transit-gateway-attachment.yaml
├── 02-database/
│   ├── stack.yaml
│   └── nested/
│       ├── rds-postgresql.yaml
│       ├── db-subnet-group.yaml
│       └── parameter-group.yaml
├── 03-compute/
│   ├── stack.yaml
│   └── nested/
│       ├── ecs-cluster.yaml
│       ├── ecs-task-definitions.yaml
│       ├── ecs-services.yaml
│       ├── alb.yaml
│       └── target-groups.yaml
├── 04-auth/
│   ├── stack.yaml
│   └── nested/
│       ├── cognito-user-pool-staff.yaml
│       └── cognito-user-pool-vendor.yaml
├── 05-storage/
│   ├── stack.yaml
│   └── nested/
│       ├── s3-frontend.yaml
│       ├── s3-logs.yaml
│       └── cloudfront.yaml
├── 06-monitoring/
│   ├── stack.yaml
│   └── nested/
│       ├── cloudwatch-alarms.yaml
│       └── sns-topic.yaml
├── parameters/
│   ├── dev.json
│   ├── stg.json
│   └── prod.json
└── scripts/
    ├── deploy.sh
    ├── rollback.sh
    └── deploy-all.sh
```

---

## デプロイ方法

### 前提条件

1. AWS CLI 設定済み（`aws configure`）
2. Shared Account の Transit Gateway ID を取得
3. S3 バケット作成（CloudFormation テンプレート保管用）
4. ネストテンプレートを S3 にアップロード

```bash
# S3 バケット作成
aws s3 mb s3://facilities-cloudformation-templates

# テンプレートアップロード
aws s3 sync service/ s3://facilities-cloudformation-templates/service/
```

### パラメーター編集

デプロイ前に、環境別パラメーターファイルを編集してください：

**`parameters/dev.json`**:
- `TransitGatewayId`: Shared Account の Transit Gateway ID に変更
- `ECRRepositoryUri`: 実際の ECR リポジトリ URI に変更
- `AlertEmail`: 通知先メールアドレスに変更

### デプロイ（スタック単位）

```bash
# 1. Network Stack（初回デプロイ）
./scripts/deploy.sh dev 01-network

# 2. Database Stack
./scripts/deploy.sh dev 02-database

# 3. Compute Stack
./scripts/deploy.sh dev 03-compute

# 4. Auth Stack
./scripts/deploy.sh dev 04-auth

# 5. Storage Stack
./scripts/deploy.sh dev 05-storage

# 6. Monitoring Stack
./scripts/deploy.sh dev 06-monitoring
```

### デプロイ（全スタック一括）

```bash
# 依存関係順に全スタックデプロイ
./scripts/deploy-all.sh dev
```

### ロールバック

```bash
# スタック単位でロールバック
./scripts/rollback.sh dev 03-compute
```

---

## 環境差分

| 項目 | dev | stg | prod |
|------|-----|-----|------|
| **VPC CIDR** | 10.0.0.0/16 | 10.1.0.0/16 | 10.2.0.0/16 |
| **AZ 構成** | シングルAZ | マルチAZ | マルチAZ |
| **RDS インスタンス** | db.t4g.micro | db.t4g.small | db.t4g.medium |
| **RDS Multi-AZ** | 無効 | 有効 | 有効 |
| **ECS タスク数** | 1 | 2 | 2-5（オートスケーリング） |
| **NAT Gateway** | 1個 | 2個 | 2個 |
| **PITR保持期間** | 7日 | 7日 | 35日 |

---

## 依存関係

```
01-network (VPC, Subnets, Security Groups)
  ↓
02-database (RDS)
  ↓
03-compute (ECS, ALB)
  ↓
04-auth (Cognito)
  ↓
05-storage (S3, CloudFront)
  ↓
06-monitoring (CloudWatch Alarms)
```

---

## Change Sets による安全なデプロイ

このプロジェクトでは、CloudFormation の **Change Sets** を必須としています。

**Change Sets の利点**:
1. **dry-run**: 変更内容を事前確認
2. **安全性**: 意図しない削除・置換を防止
3. **監査**: 変更履歴の記録

**デプロイフロー**:
1. `deploy.sh` がテンプレートを検証
2. Change Set を作成（`CREATE` or `UPDATE`）
3. 変更内容を表示（dry-run）
4. prod環境の場合は手動承認プロンプト
5. Change Set を実行
6. スタック操作完了を待機

---

## トラブルシューティング

### エラー: `No updates are to be performed`

**原因**: テンプレートに変更がない

**対処**:
- Change Set を削除して終了（問題なし）

### エラー: `The submitted information didn't contain changes`

**原因**: パラメーターに変更がない

**対処**:
- パラメーターを変更するか、リソース定義を変更

### エラー: `Export <name> cannot be deleted as it is in use by <stack>`

**原因**: 他のスタックが Export を参照している

**対処**:
- 参照しているスタックを先に削除
- または、Export を削除しない変更に修正

---

## セキュリティのベストプラクティス

1. **Secrets Manager 使用**: DB パスワードは Secrets Manager に保管
2. **暗号化**: すべてのストレージ（RDS, S3）を暗号化
3. **最小権限**: IAM ロールは最小権限の原則に従う
4. **VPC 分離**: Public/Private/DB サブネットを分離
5. **Multi-AZ**: stg/prod はマルチAZ構成

---

## コスト試算（月額）

| 環境 | 月額（円） | 主要コスト |
|------|----------|----------|
| dev | 約30,000円 | RDS micro + ECS 最小 + NAT 1個 |
| stg | 約50,000円 | RDS small + ECS 最小 + NAT 2個 |
| prod | 約83,680円 | RDS medium + ECS 本番 + NAT 2個 + Auto Scaling |
| **合計** | **約163,680円** | |

**Shared Account 含む全体**: 約313,460円/月

---

## 参考ドキュメント

- [基本設計書](../../../docs/03_基本設計/)
- [パラメーターシート](../../../docs/03_基本設計/11_パラメーターシート.md)
- [CloudFormation 技術標準](../../../.claude/docs/40_standards/45_cloudformation.md)

---

**作成者**: SRE エージェント
**最終更新**: 2025-10-25
