# 共通系アカウント（Network Shared）CloudFormation Templates

**目的**: ネットワークハブ、セキュリティ、監査ログの一元管理

---

## 構成（ファイル分割3原則ベース）

### ネットワーク層 (`nested/network/`)
- **Transit Gateway** → `transit-gateway.yaml` （ハブ構成、初回のみ）
- **Egress VPC** → `egress-vpc.yaml` （インターネット向け通信集約、初回のみ）
- **NAT Gateways** → `nat-gateways.yaml` （別メニュー、高額リソース）
- **Network Firewall** → `network-firewall.yaml` （セキュリティフィルタリング）
- **Client VPN** → `client-vpn.yaml` （管理・検証用アクセス）

### セキュリティ層 (`nested/security/`)
- **Security Hub** → `security-hub.yaml` （セキュリティ統合管理）
- **GuardDuty** → `guardduty.yaml` （脅威検出）
- **AWS Config** → `config.yaml` （コンプライアンス監視）

### 監視層 (`nested/monitoring/`)
- **CloudTrail** → `cloudtrail-org.yaml` （Organizations Trail、監査ログ）
- **CloudWatch Logs** → `cloudwatch-logs.yaml` （ログ集約）

---

## デプロイ方法

### 前提条件
- AWS CLI設定済み (`aws configure`)
- 適切なIAMロール（AdministratorAccess推奨、初回構築時）
- S3バケット作成（ネステッドテンプレート用）

### S3バケット作成（初回のみ）

```bash
# ネステッドテンプレート用S3バケット作成
aws s3 mb s3://facility-cloudformation-templates --region ap-northeast-1
```

### テンプレート検証

```bash
./scripts/validate.sh
```

### デプロイ（本番環境）

```bash
# 1. dry-run（Change Set確認のみ）
./scripts/create-changeset.sh prod

# 2. 変更内容確認
./scripts/describe-changeset.sh prod

# 3. 実行（承認後）
./scripts/execute-changeset.sh prod
```

### 全スタック一括デプロイ

```bash
./scripts/deploy.sh prod
```

---

## スタック依存関係

```
Transit Gateway
  ↓
Egress VPC + NAT Gateways
  ↓
Network Firewall
  ↓
Client VPN
  ↓
Security Hub + GuardDuty + Config
  ↓
CloudTrail + CloudWatch Logs
```

---

## リソース一覧

| リソース | 目的 | 月額コスト概算 |
|---------|------|--------------|
| Transit Gateway | ネットワークハブ | 約5,000円 |
| Egress VPC（NAT GW × 2） | インターネット向け通信 | 約10,000円 |
| Network Firewall | セキュリティフィルタリング | 約40,000円 |
| Client VPN | 管理・検証用アクセス | 約3,000円（接続時間による） |
| Security Hub | セキュリティ統合管理 | 約2,000円 |
| GuardDuty | 脅威検出 | 約1,000円 |
| CloudTrail | 監査ログ | 約1,000円 |
| **合計** | - | **約62,000円/月** |

---

## 運用

### Change Set作成・確認・実行の分離

```bash
# Change Set作成のみ
./scripts/create-changeset.sh prod

# 変更内容確認（dry-run）
./scripts/describe-changeset.sh prod

# 実行（承認後）
./scripts/execute-changeset.sh prod
```

### ロールバック

```bash
./scripts/rollback.sh prod
```

---

## セキュリティ考慮事項

- **Transit Gateway**: デフォルトルートテーブルを無効化（カスタムルートテーブル使用）
- **Egress VPC**: Network Firewall によるドメイン・ポートフィルタリング
- **Client VPN**: Cognito認証 + クライアント証明書（二要素認証）
- **Security Hub**: AWS Foundational Security Best Practices 適用
- **CloudTrail**: S3バケット暗号化（SSE-S3）、ログ2年保管

---

## トラブルシューティング

### よくあるエラー

#### エラー: "S3 bucket does not exist"
**原因**: ネステッドテンプレート用S3バケットが未作成
**解決策**:
```bash
aws s3 mb s3://facility-cloudformation-templates --region ap-northeast-1
```

#### エラー: "Resource Access Manager (RAM) share not found"
**原因**: Transit Gateway の RAM 共有が未設定
**解決策**: 手動で RAM 共有を作成するか、CloudFormation テンプレートに追加

---

**作成者**: SRE（Claude）
**レビュー状態**: レビュー待ち
