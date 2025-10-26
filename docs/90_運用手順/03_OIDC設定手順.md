# OIDC設定手順

## 目次

1. [OIDC認証とは](#oidc認証とは)
2. [初回セットアップ](#初回セットアップ)
3. [設定内容の確認](#設定内容の確認)
4. [トラブルシューティング](#トラブルシューティング)
5. [更新・ローテーション](#更新ローテーション)

---

## OIDC認証とは

### 概要

**OpenID Connect (OIDC)** は、GitHub Actions が AWS にアクセスする際に、長期クレデンシャル（Access Key / Secret Key）を使わずに、**一時的な認証トークン**で安全にアクセスするための仕組みです。

### メリット

| 従来の方法 (Access Key) | OIDC認証 |
|----------------------|---------|
| ❌ 長期クレデンシャルをGitHub Secretに保存 | ✅ 長期クレデンシャル不要 |
| ❌ 漏洩リスク（Secretが盗まれると永続的にアクセス可能） | ✅ 一時的なトークン（15分〜1時間で失効） |
| ❌ ローテーション手動 | ✅ 自動ローテーション |
| ❌ 削除時にGitHub Secret削除忘れ | ✅ IAM Roleを削除すれば即座に無効化 |

### 仕組み

```
GitHub Actions
   ↓ (1) リクエスト: "repo:k-tanaka-522/Sample-AWS-SubAgent:ref:refs/heads/main"
GitHub OIDC Provider (token.actions.githubusercontent.com)
   ↓ (2) JWTトークン発行
AWS STS (AssumeRoleWithWebIdentity)
   ↓ (3) Trust Policy で検証
       - リポジトリ: k-tanaka-522/Sample-AWS-SubAgent
       - Audience: sts.amazonaws.com
   ↓ (4) 一時的なクレデンシャル発行（有効期限: 1時間）
GitHub Actions
   ↓ (5) AWS APIコール（CloudFormation, S3, etc.）
AWS
```

**Trust Policy の重要性**:
- リポジトリを限定（`repo:k-tanaka-522/Sample-AWS-SubAgent:*`）
- 他のリポジトリからのアクセスを拒否
- ブランチ・タグ・PRごとに制限可能

---

## 初回セットアップ

### 前提条件

- ✅ AWS CLI インストール済み
- ✅ AWS CLI に管理者権限でログイン済み
- ✅ GitHub CLI (`gh`) インストール済み
- ✅ GitHub CLI で認証済み (`gh auth login`)
- ✅ リポジトリ: `k-tanaka-522/Sample-AWS-SubAgent`

### Step 1: セットアップスクリプト実行

```bash
# スクリプトに実行権限を付与
chmod +x scripts/setup-github-oidc.sh

# スクリプト実行
bash scripts/setup-github-oidc.sh
```

### Step 2: 実行内容の確認

スクリプトは以下を自動実行します：

#### 2-1: OIDC Provider 作成

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
  --thumbprint-list 1c58a3a8518e8759bf075b76b750d4f2df264fcd
```

**作成されるリソース**:
- **OIDC Provider ARN**: `arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com`

#### 2-2: IAM Policy 作成

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*", "ec2:*", "ecs:*", "rds:*",
        "elasticloadbalancing:*", "cognito-idp:*",
        "logs:*", "cloudwatch:*", "sns:*",
        "iam:*", "kms:*", "secretsmanager:*",
        "cloudfront:*", "ssm:*"
      ],
      "Resource": "*"
    }
  ]
}
```

**作成されるリソース**:
- **Policy ARN**: `arn:aws:iam::897167645238:policy/GitHubActionsDeployPolicy`

#### 2-3: IAM Role 作成

**Trust Policy**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:k-tanaka-522/Sample-AWS-SubAgent:*"
        }
      }
    }
  ]
}
```

**作成されるリソース**:
- **Role ARN**: `arn:aws:iam::897167645238:role/GitHubActionsDeployRole`

**重要な制約**:
- `token.actions.githubusercontent.com:sub`: リポジトリを限定
  - `repo:k-tanaka-522/Sample-AWS-SubAgent:*` → このリポジトリのみアクセス可能
  - 他のリポジトリ（例: `repo:other-user/other-repo:*`）は拒否される

#### 2-4: Policy を Role にアタッチ

```bash
aws iam attach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::897167645238:policy/GitHubActionsDeployPolicy
```

#### 2-5: GitHub Secret 設定

```bash
gh secret set AWS_ROLE_ARN \
  --repo k-tanaka-522/Sample-AWS-SubAgent \
  --body "arn:aws:iam::897167645238:role/GitHubActionsDeployRole"
```

**設定される Secret**:
- `AWS_ROLE_ARN`: GitHubリポジトリのSecretsに保存される

### Step 3: 完了確認

スクリプト実行後、以下が表示されます：

```
====================================
✅ OIDC Setup Complete
====================================

OIDC Provider ARN:
  arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com

IAM Role ARN:
  arn:aws:iam::897167645238:role/GitHubActionsDeployRole

IAM Policy ARN:
  arn:aws:iam::897167645238:policy/GitHubActionsDeployPolicy

GitHub Secret:
  AWS_ROLE_ARN (set in repository secrets)

====================================
Next Steps:
  1. Verify GitHub Actions workflow: .github/workflows/cloudformation-deploy.yml
  2. Create a test PR to verify OIDC authentication
  3. Check CloudFormation Change Sets in PR comments
====================================
```

---

## 設定内容の確認

### AWS Console で確認

#### 1. OIDC Provider

1. AWS Console → IAM → Identity providers
2. `token.actions.githubusercontent.com` を選択
3. 確認項目:
   - **Provider Type**: OpenID Connect
   - **Provider URL**: `https://token.actions.githubusercontent.com`
   - **Audience**: `sts.amazonaws.com`
   - **Thumbprints**: 2つ登録されていること

#### 2. IAM Role

1. AWS Console → IAM → Roles
2. `GitHubActionsDeployRole` を選択
3. 確認項目:
   - **Trust relationships**: OIDC Provider が Federated Principal として登録
   - **Permissions**: `GitHubActionsDeployPolicy` がアタッチ済み

#### 3. IAM Policy

1. AWS Console → IAM → Policies
2. `GitHubActionsDeployPolicy` を選択
3. 確認項目:
   - CloudFormation, S3, EC2, ECS, RDS等の権限があること
   - SSM権限があること（パラメーターストア用）

### GitHub で確認

#### 1. GitHub Secret

```bash
# GitHub CLI で確認
gh secret list --repo k-tanaka-522/Sample-AWS-SubAgent
```

**期待される出力**:
```
AWS_ROLE_ARN  Updated 2025-10-26
```

#### 2. GitHub Actions ワークフロー

```bash
# ワークフローファイル確認
cat .github/workflows/cloudformation-deploy.yml
```

**確認項目**:
```yaml
permissions:
  id-token: write  # ← OIDC認証に必須
  contents: read
  pull-requests: write

- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}  # ← Secret参照
    aws-region: ap-northeast-1
```

---

## トラブルシューティング

### Error 1: OIDC Provider Already Exists

**エラー**:
```
An error occurred (EntityAlreadyExists) when calling the CreateOpenIDConnectProvider operation
```

**原因**: OIDC Provider がすでに存在

**対処**:
```bash
# すでに存在する場合はスキップ（スクリプトが自動判定）
# または手動確認
aws iam get-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com
```

### Error 2: IAM Role Already Exists

**エラー**:
```
An error occurred (EntityAlreadyExists) when calling the CreateRole operation
```

**原因**: IAM Role がすでに存在

**対処**:
```bash
# Trust Policy を更新（スクリプトが自動実行）
aws iam update-assume-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-document file://trust-policy.json
```

### Error 3: Not Authorized to Perform sts:AssumeRoleWithWebIdentity

**エラー（GitHub Actions）**:
```
Error: User: arn:aws:sts::897167645238:assumed-role/GitHubActionsDeployRole/GitHubActions
is not authorized to perform: sts:AssumeRoleWithWebIdentity
```

**原因1**: Trust Policy の `sub` が間違っている

**対処**:
```bash
# Trust Policy を確認
aws iam get-role --role-name GitHubActionsDeployRole \
  --query 'Role.AssumeRolePolicyDocument'

# リポジトリ名が正しいか確認
# "token.actions.githubusercontent.com:sub": "repo:k-tanaka-522/Sample-AWS-SubAgent:*"
```

**原因2**: GitHub Actions の `permissions` が不足

**対処**:
```yaml
# .github/workflows/cloudformation-deploy.yml に追加
permissions:
  id-token: write  # ← これが必須
  contents: read
  pull-requests: write
```

### Error 4: Access Denied (SSM, S3, etc.)

**エラー**:
```
User: arn:aws:sts::897167645238:assumed-role/GitHubActionsDeployRole/GitHubActions
is not authorized to perform: ssm:GetParameters
```

**原因**: IAM Policy に権限が不足

**対処**:
```bash
# Policy を更新（スクリプト再実行）
bash scripts/setup-github-oidc.sh

# または手動で Policy Version を追加
aws iam create-policy-version \
  --policy-arn arn:aws:iam::897167645238:policy/GitHubActionsDeployPolicy \
  --policy-document file://github-actions-policy.json \
  --set-as-default
```

### Error 5: Invalid Thumbprint

**エラー**:
```
Error: Unable to verify thumbprint
```

**原因**: GitHub OIDC Provider の証明書が更新された

**対処**:
```bash
# 最新の Thumbprint を取得
openssl s_client -servername token.actions.githubusercontent.com \
  -showcerts -connect token.actions.githubusercontent.com:443 < /dev/null 2>/dev/null \
  | openssl x509 -fingerprint -sha1 -noout -in /dev/stdin

# OIDC Provider を更新
aws iam update-open-id-connect-provider-thumbprint \
  --open-id-connect-provider-arn arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 1c58a3a8518e8759bf075b76b750d4f2df264fcd
```

---

## 更新・ローテーション

### IAM Policy の更新

**いつ更新するか**:
- 新しいAWSサービスを使う場合（例: DynamoDB追加）
- 権限を絞る場合（最小権限の原則）

**更新方法**:
```bash
# 1. スクリプトの github-actions-policy.json を編集
vim scripts/setup-github-oidc.sh

# 2. スクリプト再実行（既存の場合は Policy Version を追加）
bash scripts/setup-github-oidc.sh
```

**例: DynamoDB 権限追加**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*", "ec2:*", "ecs:*", "rds:*",
        "dynamodb:*",  // ← 追加
        ...
      ],
      "Resource": "*"
    }
  ]
}
```

### Trust Policy の更新

**いつ更新するか**:
- リポジトリ名を変更した場合
- ブランチ制限を追加する場合（例: `main` ブランチのみ）

**更新方法**:
```bash
# 1. Trust Policy を編集
cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:k-tanaka-522/Sample-AWS-SubAgent:ref:refs/heads/main"
        }
      }
    }
  ]
}
EOF

# 2. Trust Policy を更新
aws iam update-assume-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-document file://trust-policy.json
```

**例: main ブランチのみに制限**:
```json
"token.actions.githubusercontent.com:sub": "repo:k-tanaka-522/Sample-AWS-SubAgent:ref:refs/heads/main"
```

### GitHub Secret のローテーション

**通常は不要**:
- OIDC認証では `AWS_ROLE_ARN` は Role ARN（固定値）
- Access Key / Secret Key のような定期ローテーションは不要

**Role ARN が変わった場合のみ更新**:
```bash
gh secret set AWS_ROLE_ARN \
  --repo k-tanaka-522/Sample-AWS-SubAgent \
  --body "arn:aws:iam::897167645238:role/NewRoleName"
```

### OIDC Provider の削除・再作成

**削除手順**:
```bash
# 1. Role から Policy をデタッチ
aws iam detach-role-policy \
  --role-name GitHubActionsDeployRole \
  --policy-arn arn:aws:iam::897167645238:policy/GitHubActionsDeployPolicy

# 2. Role を削除
aws iam delete-role --role-name GitHubActionsDeployRole

# 3. Policy を削除
aws iam delete-policy \
  --policy-arn arn:aws:iam::897167645238:policy/GitHubActionsDeployPolicy

# 4. OIDC Provider を削除
aws iam delete-open-id-connect-provider \
  --open-id-connect-provider-arn arn:aws:iam::897167645238:oidc-provider/token.actions.githubusercontent.com
```

**再作成**:
```bash
bash scripts/setup-github-oidc.sh
```

---

## 参考資料

- [GitHub Actions: OIDC for AWS](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [AWS: IAM OIDC Identity Providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [aws-actions/configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials)

---

**作成者**: PM + SRE
**作成日**: 2025-10-26
