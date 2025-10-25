# GitHub Actions ワークフロー

## 概要

このディレクトリには、AWS ECS移行プロジェクトのCI/CDワークフローが含まれています。

⚠️ **重要**: これらのワークフローは**テンプレート**です。AWS認証情報は設定されていないため、そのままでは動作しません。

## ワークフロー一覧

### 1. CloudFormation Validation (`validate-cloudformation.yml`)

**トリガー**:
- Pull Request（CloudFormationファイル変更時）
- main ブランチへのプッシュ
- 手動実行（workflow_dispatch）

**機能**:
- CloudFormationテンプレートの構文検証
- cfn-lint によるベストプラクティスチェック

**AWS認証**: 不要（ローカル検証のみ）

### 2. Deploy Shared Account (`deploy-shared.yml`)

**トリガー**:
- 手動実行のみ（workflow_dispatch）

**機能**:
- 共通系アカウント（network-shared）のデプロイ
- CloudFormation Change Sets使用
- 手動承認ステップ

**AWS認証**: 必須（現在は未設定）

## AWS認証の設定方法

これらのワークフローを実際にAWSにデプロイするには、以下の設定が必要です：

### ステップ1: AWS OIDC設定

1. AWSでOIDCプロバイダーを作成
2. IAMロールを作成し、GitHubリポジトリに信頼関係を設定

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
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

### ステップ2: GitHub Secrets設定

リポジトリの Settings > Secrets and variables > Actions で以下を追加：

- `AWS_ROLE_ARN`: `arn:aws:iam::123456789012:role/GitHubActionsRole`
- `AWS_REGION`: `ap-northeast-1`

### ステップ3: ワークフローの有効化

`deploy-shared.yml` 等のコメントアウトされたステップを有効化します。

## 参考資料

- [AWS OIDC設定ガイド](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)
- [基本設計書: CI/CD設計](../../docs/03_基本設計/09_CI_CD設計.md)
- [デプロイ手順書](../../docs/06_運用ドキュメント/01_デプロイ手順書.md)

## セキュリティ

- ✅ AWS認証情報はハードコードされていません
- ✅ OIDC使用（長期認証情報不要）
- ✅ 手動承認ステップあり（本番デプロイ時）
- ✅ Change Sets必須（dry-run）

---

**作成日**: 2025-10-25  
**更新日**: 2025-10-25
