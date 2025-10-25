# 役所設備管理システム AWS ECS 移行プロジェクト

## プロジェクト概要

現行の設備管理システム（EC2ベース）をAWS ECS（Fargate）に移行し、以下を実現するプロジェクトです：

- **運用工数削減**: サーバー管理工数を月20時間から月5時間に削減（75%削減）
- **可用性向上**: 99.9%目標（マルチAZ構成）
- **自動スケーリング対応**: ピーク時の性能問題を解消
- **ISMAP準拠**: 機密性3レベルのセキュアなシステム基盤

## システム構成

### マルチアカウント構成

- **共通系アカウント（network-shared）**: Transit Gateway、Egress VPC、Security Hub、GuardDuty
- **サービスアカウント（dev/stg/prod）**: VPC、ECS Fargate、RDS、ALB、Cognito

### 技術スタック

- **インフラ**: AWS CloudFormation、Transit Gateway、Network Firewall
- **コンテナ**: ECS Fargate
- **データベース**: RDS PostgreSQL 14
- **認証**: Amazon Cognito
- **フロントエンド**: React 18 SPA（S3 + CloudFront）
- **バックエンド**: Node.js 18 + Express + TypeScript
- **CI/CD**: GitHub Actions

## ディレクトリ構成

```
.
├── docs/                          # ドキュメント
│   ├── 01_企画書.md
│   ├── 02_要件定義書.md
│   ├── 03_基本設計/              # 基本設計書（13ファイル）
│   └── 06_運用ドキュメント/       # デプロイ手順書等
├── infra/                         # インフラコード
│   └── cloudformation/
│       ├── shared/               # 共通系アカウント
│       └── service/              # サービスアカウント
├── app/                          # アプリケーション
│   └── staff-api/               # 職員向けAPI（サンプル）
└── .claude/                      # Claude Code設定
```

## デプロイ方法

### 前提条件

- AWS CLI v2インストール済み
- AWS認証情報設定済み
- 適切なIAM権限

### 共通系アカウント（network-shared）

```bash
cd infra/cloudformation/shared

# 1. テンプレート検証
./scripts/validate.sh

# 2. Change Set作成
./scripts/create-changeset.sh prod

# 3. 変更内容確認（dry-run）
./scripts/describe-changeset.sh prod

# 4. 実行
./scripts/execute-changeset.sh prod
```

### サービスアカウント（dev/stg/prod）

```bash
cd infra/cloudformation/service

# Dev環境
./scripts/deploy.sh dev

# Stg環境
./scripts/deploy.sh stg

# Prod環境（手動承認必要）
./scripts/deploy.sh prod
```

詳細は [デプロイ手順書](docs/06_運用ドキュメント/01_デプロイ手順書.md) を参照してください。

## ドキュメント

### 設計ドキュメント

- [企画書](docs/01_企画書.md)
- [要件定義書](docs/02_要件定義書.md)
- [基本設計書](docs/03_基本設計/INDEX.md)

### 運用ドキュメント

- [デプロイ手順書](docs/06_運用ドキュメント/01_デプロイ手順書.md)

### 重要な設計方針

- [CloudFormation構成方針](docs/03_基本設計/10_CloudFormation構成方針.md) - ファイル分割3原則
- [ネットワーク設計](docs/03_基本設計/02_ネットワーク設計.md)
- [セキュリティ設計](docs/03_基本設計/03_セキュリティ設計.md)

## セキュリティ

### ISMAP準拠

- 機密性3レベル（機微情報）
- 政府情報システムにおけるクラウドサービス利用の基本方針準拠

### 実装済みセキュリティ対策

- ✅ Transit Gateway（カスタムルートテーブル、デフォルトルート無効化）
- ✅ Network Firewall（ドメイン・ポートフィルタリング）
- ✅ Security Hub + GuardDuty
- ✅ CloudTrail（監査ログ2年保管）
- ✅ AWS Config（コンプライアンス監視）
- ✅ マルチAZ構成（NAT GW、RDS）

## コスト試算

### 共通系アカウント（月額）

| リソース | 月額コスト概算 |
|---------|--------------|
| Transit Gateway | 約5,000円 |
| NAT Gateway × 2 | 約10,000円 |
| Network Firewall | 約40,000円 |
| Security Hub | 約2,000円 |
| GuardDuty | 約1,000円 |
| CloudTrail | 約1,000円 |
| **合計** | **約60,000円/月** |

### サービスアカウント（月額、dev/stg/prod合計）

| リソース | 月額コスト概算 |
|---------|--------------|
| ECS Fargate | 約30,000円 |
| RDS PostgreSQL | 約40,000円 |
| ALB | 約10,000円 |
| S3 + CloudFront | 約5,000円 |
| その他 | 約5,000円 |
| **合計** | **約90,000円/月** |

**総合計**: 約150,000円/月（目標: 100万円以内 ✅）

## プロジェクト進捗

| フェーズ | 進捗 | 状況 |
|---------|------|------|
| 企画 | 100% | ✅ 完了 |
| 要件定義 | 100% | ✅ 完了 |
| 設計 | 100% | ✅ 完了 |
| **実装** | **20%** | 🔄 進行中（骨格のみ完成） |
| テスト | 0% | ⏸️ 未着手 |
| 納品 | 10% | 🔄 一部完了 |

## ライセンス

MIT License

## 作成者

- PM: Claude (AI開発ファシリテーター)
- Architect: Claude Architect サブエージェント
- SRE: Claude SRE サブエージェント

---

**作成日**: 2025-10-25  
**プロジェクト管理**: Claude Code  
**技術標準**: `.claude/docs/40_standards/`
