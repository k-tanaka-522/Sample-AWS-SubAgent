# CICD設計

## 概要

このプロジェクトでは、GitHub Actions + AWS OIDC を使用した安全で自動化されたCICDパイプラインを構築しています。

---

## アーキテクチャ

### 全体フロー

```
開発者
  ↓
コード変更
  ↓
Pull Request作成
  ↓
GitHub Actions (preview job) ← OIDC認証
  ├─ CloudFormation Change Set作成（全スタック）
  ├─ 差分をPRコメントに投稿
  └─ Status Check: ✅ / ❌
  ↓
レビュアーが承認（1人以上）
  ↓
マージ
  ↓
GitHub Actions (deploy job) ← OIDC認証
  └─ CloudFormation Change Set実行（全スタック）
```

---

## 認証方式: AWS OIDC

### OIDC（OpenID Connect）を選択した理由

| 方式 | メリット | デメリット |
|------|----------|------------|
| **OIDC（採用）** | ✅ 長期的な認証情報不要<br>✅ IAMロールで細かい権限制御<br>✅ 認証情報ローテーション不要<br>✅ セキュアな一時認証情報 | ⚠️ 初回セットアップがやや複雑 |
| アクセスキー | 🔹 セットアップが簡単 | ❌ 長期的な認証情報をGitHubに保存<br>❌ 定期的なローテーション必要<br>❌ 漏洩リスク |

### OIDC認証フロー

```
GitHub Actions
  ↓
1. GitHub が OIDC トークン発行
   （リポジトリ情報を含む JWT）
  ↓
2. AWS STS に AssumeRoleWithWebIdentity リクエスト
   （OIDC トークンを提示）
  ↓
3. AWS が Trust Policy を検証
   ✅ token.actions.githubusercontent.com
   ✅ repo: k-tanaka-522/Sample-AWS-SubAgent
  ↓
4. 一時認証情報（15分〜12時間）を発行
  ↓
5. GitHub Actions が AWS API を実行
```

### 設定済みのAWSリソース

**OIDCプロバイダー**:
```
arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com
```

**IAMロール**:
```
arn:aws:iam::897167645238:role/GitHubActionsDeployRole

Trust Policy:
- Principal: token.actions.githubusercontent.com（OIDC Provider）
- Condition: repo:k-tanaka-522/Sample-AWS-SubAgent:*
```

**IAMポリシー**:
```
arn:aws:iam::897167645238:policy/GitHubActionsCloudFormationPolicy

Permissions:
- cloudformation:*
- s3:*, ec2:*, ecs:*, rds:*
- elasticloadbalancing:*, cognito-idp:*
- logs:*, cloudwatch:*, sns:*
- iam:*, kms:*, secretsmanager:*
- cloudfront:*, ssm:*
```

---

## リポジトリ戦略

### Branch Protection Rules（main ブランチ）

以下のルールが設定されています：

#### 1. Pull Request必須

```
☑️ Require a pull request before merging
```

- mainブランチへの直接pushを禁止
- 必ずPRを経由してマージ

#### 2. 承認必須

```
☑️ Require approvals: 1
☑️ Dismiss stale pull request approvals when new commits are pushed
```

- 1人以上のレビュアーによる承認が必要
- 新しいコミットがpushされたら、古い承認は無効化

#### 3. Status Check必須

```
☑️ Require status checks to pass before merging
  - preview (GitHub Actions の preview job)
☑️ Require branches to be up to date before merging
```

- GitHub Actions の `preview` ジョブが成功しないとマージ不可
- マージ前にブランチを最新に保つ必要あり

#### 4. その他の保護

```
☑️ Prohibit force pushes
☑️ Prohibit branch deletions
☐ Enforce admins (管理者は緊急時にバイパス可能)
```

---

## GitHub Actions ワークフロー

### ファイル構成

```
.github/
└── workflows/
    └── cloudformation-deploy.yml
```

### ジョブ構成

#### 1. preview ジョブ（PR時）

**トリガー**:
```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - 'infra/cloudformation/service/**'
```

**実行内容**:
1. AWS OIDC認証
2. 全スタック（01〜06）で Change Set 作成
3. 各スタックの差分をPRコメントに投稿

**Change Set 作成のみ**:
- 実行はしない（dry-run）
- AWSリソースは変更されない

#### 2. deploy ジョブ（マージ後）

**トリガー**:
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'infra/cloudformation/service/**'
```

**実行内容**:
1. AWS OIDC認証
2. 全スタック（01〜06）を順次デプロイ
3. 各スタックで Change Set 作成 + 実行
4. 変更がないスタックは自動スキップ

---

## パラメーターフィルタリング

### 課題

`parameters/dev.json` には全スタック分のパラメーターが混在しています：

```json
[
  {"ParameterKey": "VpcCidr", "ParameterValue": "10.0.0.0/16"},
  {"ParameterKey": "DBInstanceClass", "ParameterValue": "db.t4g.micro"},
  {"ParameterKey": "ECRRepositoryUri", "ParameterValue": "..."},
  ...
]
```

各スタックは必要なパラメーターのみを使用するため、不要なパラメーターがあるとエラーになります。

### 解決策: 動的フィルタリング

**GitHub Actions / deploy.sh** で実装：

```bash
# 1. テンプレートが要求するパラメーターを取得
REQUIRED_PARAMS=$(aws cloudformation get-template-summary \
  --template-body file://$TEMPLATE_FILE \
  --query 'Parameters[*].ParameterKey' \
  --output json)

# 2. jq でフィルタリング
FILTERED_PARAMS=$(jq --argjson required "$REQUIRED_PARAMS" '
  [ .[] | select(.ParameterKey as $k | $required | index($k)) ]
' $PARAMETERS_FILE)

# 3. フィルタリングされたパラメーターを使用
aws cloudformation create-change-set \
  --parameters file://<(echo "$FILTERED_PARAMS") \
  ...
```

**メリット**:
- 各スタックに必要なパラメーターのみ自動抽出
- パラメーターファイルを分割する必要がない
- スタック追加時もパラメーターファイルを変更するだけ

---

## デプロイフロー

### 通常デプロイ（CICD経由）

```
1. ブランチ作成
   $ git checkout -b feature/add-monitoring

2. コード変更
   $ vim infra/cloudformation/service/templates/monitoring/sns-topic.yaml

3. コミット・プッシュ
   $ git add .
   $ git commit -m "feat: Add SNS topic for alarms"
   $ git push origin feature/add-monitoring

4. PR作成
   $ gh pr create --title "Add monitoring stack"

5. GitHub Actions 実行（preview）
   - Change Set 作成
   - 差分をPRコメントに表示

6. レビュー・承認
   - レビュアーが差分を確認
   - 承認（Approve）

7. マージ
   $ gh pr merge --squash

8. GitHub Actions 実行（deploy）
   - Change Set 実行
   - 自動デプロイ
```

### 緊急デプロイ（CLI手動実行）

```
1. 緊急対応が必要
   例: RDS接続エラー、SecurityGroup設定ミス

2. ローカルでコード修正
   $ vim infra/cloudformation/service/templates/network/security-groups.yaml

3. CLI で即座にデプロイ
   $ cd infra/cloudformation/service
   $ ./scripts/deploy.sh prod 01-network

   ✅ 5分で復旧

4. コードに反映（Drift解消）
   $ git checkout -b hotfix/security-group
   $ git add .
   $ git commit -m "hotfix: Fix RDS SecurityGroup port"
   $ git push origin hotfix/security-group

5. PR作成 → マージ
   $ gh pr create --title "hotfix: RDS SecurityGroup"

   → GitHub Actions 実行
   → Change Set: "No changes"（すでに適用済み）
   → IaCと実態が一致
```

---

## Change Set による安全なデプロイ

### Change Set とは

CloudFormation の機能で、**実行前に変更内容を確認できる**仕組み。

```
Change Set = 実行前の差分プレビュー

| Action | ResourceId | ResourceType | Replacement |
|--------|-----------|--------------|-------------|
| Modify | RDSInstance | AWS::RDS::DBInstance | False |
| Add    | NewSecurityGroupRule | AWS::EC2::SecurityGroupIngress | N/A |
| Remove | OldLogGroup | AWS::Logs::LogGroup | N/A |
```

### Change Set のメリット

1. **Dry-run**: 実行前に変更内容を確認
2. **安全性**: 意図しない削除・置換を防止
3. **監査**: 変更履歴が記録される
4. **ロールバック**: 問題があれば Change Set を削除

### Change Set フロー（deploy.sh）

```bash
# 1. テンプレート検証
aws cloudformation validate-template --template-body file://stack.yaml

# 2. パラメーターフィルタリング
FILTERED_PARAMS=$(jq ...)

# 3. Change Set 作成
aws cloudformation create-change-set \
  --stack-name facilities-dev-01-network \
  --change-set-name facilities-dev-01-network-20251026-123456 \
  --change-set-type CREATE/UPDATE

# 4. Change Set 完了待ち
aws cloudformation wait change-set-create-complete

# 5. 差分表示（dry-run）
aws cloudformation describe-change-set | jq

# 6. 本番環境の場合は手動承認
if [ "$ENVIRONMENT" = "prod" ]; then
  read -p "Execute? (yes/no): " CONFIRM
fi

# 7. Change Set 実行
aws cloudformation execute-change-set

# 8. スタック操作完了待ち
aws cloudformation wait stack-create-complete / stack-update-complete
```

---

## スタック構成

### Service Account

| スタック | 変更頻度 | 含まれるリソース |
|---------|--------|----------------|
| **01-network** | 年1回 | VPC, Subnets, NAT Gateway, Security Groups, Transit Gateway Attachment |
| **02-database** | 月1回 | RDS PostgreSQL, DB Subnet Group, Parameter Group |
| **03-compute** | 週数回 | ECS Cluster, Task Definitions, Services, ALB, Target Groups |
| **04-auth** | 月1回 | Cognito User Pools (staff, vendor) |
| **05-storage** | 月1回 | S3 (frontend, logs), CloudFront |
| **06-monitoring** | 月1回 | CloudWatch Alarms, SNS Topic |

### Shared Account

| スタック | 変更頻度 | 含まれるリソース |
|---------|--------|----------------|
| **1-foundation** | 年1回 | CloudTrail, Config, GuardDuty, Security Hub（組織全体） |
| **2-network** | 年1回 | Transit Gateway, Direct Connect Gateway, RAM Share |
| **3-client-vpn** | 年1回 | Client VPN Endpoint, VPC, Transit Gateway Attachment |

---

## セキュリティ

### 最小権限の原則

IAMポリシーは必要最小限の権限のみ付与：

```json
{
  "Effect": "Allow",
  "Action": [
    "cloudformation:*",  // CloudFormation操作
    "s3:*", "ec2:*", ... // リソース操作
  ],
  "Resource": "*"
}
```

**今後の改善案**:
- Resource を特定のリソースARNに制限
- 環境別（dev/stg/prod）にIAMロールを分離

### シークレット管理

**AWS Secrets Manager 使用**:
- DB パスワード
- API キー

**パラメーターファイルには含めない**:
```json
{
  "ParameterKey": "DBMasterPassword",
  "ParameterValue": "CHANGE_ME_IN_SECRETS_MANAGER"  // ダミー値
}
```

**CloudFormation テンプレートで動的参照**:
```yaml
MasterUserPassword: !Sub '{{resolve:secretsmanager:${DBPasswordSecret}:SecretString:password}}'
```

---

## トラブルシューティング

### GitHub Actions エラー: OIDC認証失敗

**エラーメッセージ**:
```
Error: Could not assume role with OIDC
```

**原因**:
- IAMロールの Trust Policy が正しくない
- GitHub Secret `AWS_DEPLOY_ROLE_ARN` が設定されていない

**対処**:
```bash
# Trust Policy 確認
aws iam get-role --role-name GitHubActionsDeployRole

# GitHub Secret 確認
gh secret list

# 再設定
gh secret set AWS_DEPLOY_ROLE_ARN --body "arn:aws:iam::897167645238:role/GitHubActionsDeployRole"
```

### Change Set 作成失敗: パラメーターエラー

**エラーメッセージ**:
```
Parameters: [XXX] do not exist in the template
```

**原因**:
- パラメーターフィルタリングが正しく動作していない
- jq がインストールされていない

**対処**:
```bash
# jq インストール確認
which jq

# 手動でパラメーターフィルタリング
REQUIRED_PARAMS=$(aws cloudformation get-template-summary \
  --template-body file://stack.yaml \
  --query 'Parameters[*].ParameterKey' \
  --output json)

echo $REQUIRED_PARAMS
```

### デプロイ失敗: リソース依存関係エラー

**エラーメッセージ**:
```
Resource [XXX] depends on resource [YYY] which does not exist
```

**原因**:
- スタックのデプロイ順序が間違っている
- 前提リソースが存在しない

**対処**:
```bash
# 依存関係順にデプロイ
./scripts/deploy-all.sh dev  # 自動的に依存順でデプロイ

# 個別デプロイの場合は順序を守る
./scripts/deploy.sh dev 01-network  # 先
./scripts/deploy.sh dev 02-database # 後（networkに依存）
```

---

## 参考資料

- [GitHub Actions - AWS OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [CloudFormation Change Sets](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

---

**作成者**: PM + SRE
**作成日**: 2025-10-26
**検証状況**: ✅ OIDC認証、パラメーターフィルタリング、Branch Protection検証済み
