# Shared Account - 1-foundation Stack

## 概要

Shared Account の基盤スタック（組織管理・監査基盤）を構築する CloudFormation テンプレート集です。

### 含まれるリソース

| サービス | 説明 | スコープ |
|---------|------|---------|
| **CloudTrail** | 組織全体のAPI呼び出しを記録 | 組織全体（Shared + Service） |
| **Config** | 組織全体のリソース設定変更を記録 | 組織全体（Shared + Service） |
| **GuardDuty** | 組織全体の脅威検知 | 組織全体（Shared + Service） |
| **Security Hub** | 組織全体のセキュリティ統合管理 | 組織全体（Shared + Service） |
| **S3 Bucket** | 監査ログの長期保管 | Shared Account |

### アーキテクチャ

```
Shared Account
  ├── S3 Bucket（監査ログ）
  │   ├── cloudtrail/
  │   ├── config/
  │   └── vpc-flow-logs/
  ├── CloudTrail（組織証跡）
  ├── Config（組織Aggregator）
  ├── GuardDuty（管理アカウント）
  └── Security Hub（管理アカウント）
```

---

## ディレクトリ構成

```
1-foundation/
├── README.md                          # このファイル
├── stack.yaml                         # マスタースタック（Nested Stacks統合）
├── parameters/
│   └── prod.json                      # パラメーターファイル
├── nested/
│   ├── s3-audit-logs.yaml             # S3 監査ログバケット
│   ├── cloudtrail-org.yaml            # CloudTrail（組織全体）
│   ├── config-org.yaml                # Config（組織全体）
│   ├── guardduty-org.yaml             # GuardDuty（組織全体）
│   └── security-hub-org.yaml          # Security Hub（組織全体）
└── scripts/
    ├── create-changeset.sh            # Change Set 作成
    ├── describe-changeset.sh          # Change Set 確認
    ├── execute-changeset.sh           # Change Set 実行
    ├── rollback.sh                    # ロールバック
    └── validate.sh                    # テンプレート検証
```

---

## デプロイ方法

### 前提条件

1. **AWS CLI 設定済み**:
   ```bash
   aws configure
   ```

2. **Shared Account の認証情報**:
   - Shared Account の管理者権限を持つIAMユーザーまたはロールで認証

3. **Service Account ID の確認**:
   - `parameters/prod.json` の `ServiceAccountId` を実際のService Account IDに変更

### 手順

#### 1. テンプレート検証

```bash
cd infra/cloudformation/shared/1-foundation
./scripts/validate.sh
```

#### 2. Change Set 作成（dry-run）

```bash
./scripts/create-changeset.sh prod
```

**出力例**:
```
=== CloudFormation Change Set 作成 ===
Environment: prod
Stack: facilities-shared-foundation-prod
Template: stack.yaml
Parameters: parameters/prod.json
ChangeSet: facilities-shared-foundation-prod-20251025-123456

✅ Change Set が作成されました

Change Set Name: facilities-shared-foundation-prod-20251025-123456

次のステップ:
1. ./scripts/describe-changeset.sh prod facilities-shared-foundation-prod-20251025-123456
   （変更内容を確認）

2. ./scripts/execute-changeset.sh prod facilities-shared-foundation-prod-20251025-123456
   （承認後に実行）
```

#### 3. Change Set 確認

```bash
./scripts/describe-changeset.sh prod
```

**出力例**:
```
=== CloudFormation Change Set 内容確認 ===
Environment: prod
Stack: facilities-shared-foundation-prod
ChangeSet: facilities-shared-foundation-prod-20251025-123456

--- ステータス ---
Status: CREATE_COMPLETE

--- 変更内容 ---
-----------------------------------------------------------
| Action | LogicalResourceId        | ResourceType        |
-----------------------------------------------------------
| Add    | AuditLogsBucket          | AWS::S3::Bucket     |
| Add    | CloudTrailOrg            | AWS::CloudTrail     |
| Add    | ConfigOrg                | AWS::Config         |
| Add    | GuardDutyDetector        | AWS::GuardDuty      |
| Add    | SecurityHub              | AWS::SecurityHub    |
-----------------------------------------------------------
```

#### 4. Change Set 実行（本番デプロイ）

```bash
./scripts/execute-changeset.sh prod
```

**確認プロンプト**:
```
⚠️  警告: この操作は Shared Account の基盤スタックを変更します
         - CloudTrail（組織全体）
         - Config（組織全体）
         - GuardDuty（組織全体）
         - Security Hub（組織全体）

本当に実行しますか？ (yes/no):
```

**`yes` と入力すると実行開始**

#### 5. デプロイ完了の確認

```bash
aws cloudformation describe-stacks \
  --stack-name facilities-shared-foundation-prod \
  --query 'Stacks[0].StackStatus'
```

**期待される出力**: `CREATE_COMPLETE` または `UPDATE_COMPLETE`

---

## ロールバック

デプロイに失敗した場合、または問題が発生した場合:

```bash
./scripts/rollback.sh prod
```

**確認プロンプト**:
```
⚠️  警告: この操作は前回の安定した状態にロールバックします
         - CloudTrail（組織全体）
         - Config（組織全体）
         - GuardDuty（組織全体）
         - Security Hub（組織全体）

本当に実行しますか？ (yes/no):
```

---

## 重要な注意事項

### 1. 削除保護

以下のリソースには `DeletionPolicy: Retain` が設定されており、CloudFormation スタック削除時も保持されます：

- **S3 Bucket（監査ログ）**: 監査証跡の保護のため
- **CloudTrail**: 監査証跡の継続性のため
- **CloudWatch Logs**: ログの長期保管のため

### 2. 組織レベルのリソース

このスタックは **組織全体** に影響を与えます：

- CloudTrail は Shared Account + Service Account のすべてのAPI呼び出しを記録
- Config は Shared Account + Service Account のすべてのリソース設定を記録
- GuardDuty は Shared Account + Service Account のすべての脅威を検知
- Security Hub は Shared Account + Service Account のすべてのセキュリティ検出結果を統合

### 3. Service Account との連携

このスタックをデプロイした後、以下の設定が必要です：

1. **Service Account のメンバーアカウント登録**:
   - GuardDuty、Security Hub、Config で Service Account を自動的にメンバーアカウントとして登録
   - AWS Organizations の OU（Organizational Unit）設定が必要

2. **RAM（Resource Access Manager）での共有**:
   - Transit Gateway を Service Account に共有（別スタックで実施）

---

## トラブルシューティング

### Change Set 作成に失敗する

**原因**: テンプレートに文法エラーがある

**対処**:
```bash
./scripts/validate.sh
```

### Change Set 実行に失敗する

**原因1**: 権限不足

**対処**: Shared Account の管理者権限があることを確認

**原因2**: リソースの制約

**対処**: AWS サポートに問い合わせて制限緩和を依頼

### CloudTrail が記録されない

**原因**: S3 Bucket Policy が正しく設定されていない

**対処**: `nested/s3-audit-logs.yaml` の Bucket Policy を確認

---

## 参照ドキュメント

- 基本設計書: `docs/03_基本設計/08_セキュリティ設計.md`
- パラメーターシート: `docs/03_基本設計/11_パラメーターシート.md`
- CloudFormation 規約: `.claude/docs/40_standards/45_cloudformation.md`
- セキュリティ基準: `.claude/docs/40_standards/49_security.md`

---

**作成者**: SRE サブエージェント
**最終更新**: 2025-10-25
