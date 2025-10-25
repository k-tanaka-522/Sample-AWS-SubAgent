# Service Account CloudFormation Templates

## 📁 構成（ファイル分割3原則ベース）

このディレクトリは、役所設備管理システムの**サービスアカウント**（Dev/Stg/Prod）のCloudFormationテンプレートを管理します。

### ディレクトリ構成

```
service/
├── README.md                       # このファイル
├── stack.yaml                      # 親スタック（ネスト構成）
├── parameters/
│   ├── dev.json                    # Dev環境パラメータ
│   ├── stg.json                    # Stg環境パラメータ
│   └── prod.json                   # Prod環境パラメータ
├── nested/
│   ├── network/                    # ネットワーク層
│   ├── database/                   # データベース層
│   ├── compute/                    # コンピュート層（ECS、ALB）
│   ├── auth/                       # 認証層（Cognito）
│   ├── frontend/                   # フロントエンド層（S3、CloudFront）
│   ├── monitoring/                 # 監視層（CloudWatch、SNS）
│   └── batch/                      # バッチ層（EventBridge）
└── scripts/
    ├── create-changeset.sh         # Change Set作成
    ├── describe-changeset.sh       # Change Set詳細表示（dry-run）
    ├── execute-changeset.sh        # Change Set実行
    ├── deploy.sh                   # 上記3つを統合実行
    ├── deploy-all.sh               # 全スタック一括デプロイ
    ├── validate.sh                 # テンプレート検証
    └── rollback.sh                 # ロールバック
```

---

## 🔍 ファイル分割3原則

### 原則1: AWS コンソールの分け方
- **VPC と IGW** → `vpc-and-igw.yaml` （密結合、初回のみ、1個）
- **Subnets** → `subnets.yaml` （別メニュー、たまに追加、増える）
- **Security Groups** → `security-groups/*.yaml` （別メニュー、継続的に追加、激増）

### 原則2: ライフサイクル（変更頻度）
- **初回のみ**: VPC、Subnet、NAT Gateway
- **たまに変更**: RDS、ALB、ECS Cluster
- **頻繁に変更**: ECS Task Definition、CloudWatch Alarms

### 原則3: 設定数（増減の可能性）
- **1個で固定**: VPC + IGW → 同じファイルOK
- **継続的に増える**: Security Groups、CloudWatch Alarms → ディレクトリ分割

---

## 🛠️ デプロイ方法

### 前提条件
- AWS CLI設定済み (`aws configure`)
- 適切なIAMロール
- S3バケット（ネステッドテンプレート保管用）

### 個別スタックデプロイ

```bash
# dry-run（Change Set確認のみ）
./scripts/diff.sh dev network

# dev環境にデプロイ
./scripts/deploy.sh dev network
./scripts/deploy.sh dev database
./scripts/deploy.sh dev compute

# prod環境にデプロイ（確認プロンプトあり）
./scripts/deploy.sh prod network
```

### 全スタック一括デプロイ

```bash
# すべてのスタックを依存関係順にデプロイ
./scripts/deploy-all.sh dev
```

### テンプレート検証

```bash
./scripts/validate.sh
```

### ロールバック

```bash
./scripts/rollback.sh dev compute
```

---

## 🔗 スタック依存関係

```
network (VPC, Subnets, Security Groups, TGW Attachment)
  ↓
database (RDS)
  ↓
auth (Cognito)
  ↓
compute (ECS, ALB)
  ↓
frontend (S3, CloudFront)
  ↓
monitoring (CloudWatch, SNS)
  ↓
batch (EventBridge)
```

---

## 📝 よくある変更

| やりたいこと | 編集するファイル | 環境差分はどこ？ |
|------------|----------------|---------------|
| VPC の CIDR を変更 | `nested/network/vpc-and-igw.yaml` | `parameters/{env}.json` |
| Subnet を追加 | `nested/network/subnets.yaml` | テンプレート直接編集 |
| Security Group を追加 | `nested/network/security-groups/` に新規ファイル作成 | - |
| ECS のタスク定義変更 | `nested/compute/ecs-task-staff-api.yaml` | `parameters/{env}.json` |
| ALB のリスナールール追加 | `nested/compute/alb-internal.yaml` | - |
| CloudWatch アラーム追加 | `nested/monitoring/cloudwatch-alarms.yaml` | - |
| RDS のインスタンスタイプ変更 | `parameters/prod.json` の `DBInstanceClass` を変更 | `parameters/{env}.json` |

---

## 🌟 技術標準準拠

このCloudFormation構成は、以下の技術標準に準拠しています：

- `.claude/docs/40_standards/45_cloudformation.md`（CloudFormation規約）
- ファイル分割の3原則
- Change Sets必須
- Well-Architected Framework準拠

---

## 📖 関連ドキュメント

- [基本設計書: 10_CloudFormation構成方針.md](../../../docs/03_基本設計/10_CloudFormation構成方針.md)
- [基本設計書: 02_ネットワーク設計.md](../../../docs/03_基本設計/02_ネットワーク設計.md)
- [基本設計書: 05_データベース設計.md](../../../docs/03_基本設計/05_データベース設計.md)
- [基本設計書: 06_コンピュート設計.md](../../../docs/03_基本設計/06_コンピュート設計.md)

---

**作成者**: SRE（Claude）
**作成日**: 2025-10-25
**バージョン**: 1.0
