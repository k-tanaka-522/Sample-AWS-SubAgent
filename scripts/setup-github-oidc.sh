#!/bin/bash
set -euo pipefail

# ==============================================================================
# GitHub Actions OIDC Setup for AWS
# ==============================================================================
# このスクリプトは以下を自動設定します:
# 1. AWS IAM OIDC プロバイダー作成
# 2. IAM ロール作成（GitHub Actions用）
# 3. IAM ポリシー作成（CloudFormation権限）
# 4. GitHub Secrets に ROLE ARN を設定
# ==============================================================================

GITHUB_REPO="k-tanaka-522/Sample-AWS-SubAgent"
GITHUB_ORG="k-tanaka-522"
REPO_NAME="Sample-AWS-SubAgent"
AWS_REGION="ap-northeast-1"
ROLE_NAME="GitHubActionsDeployRole"
POLICY_NAME="GitHubActionsCloudFormationPolicy"

echo "===================================="
echo "GitHub Actions OIDC Setup for AWS"
echo "===================================="
echo "GitHub Repo: ${GITHUB_REPO}"
echo "AWS Region:  ${AWS_REGION}"
echo "IAM Role:    ${ROLE_NAME}"
echo "===================================="
echo ""

# ------------------------------------------------------------------------------
# 1. AWS IAM OIDC プロバイダー作成
# ------------------------------------------------------------------------------
echo "Step 1: Creating IAM OIDC Provider for GitHub..."

OIDC_PROVIDER_ARN=$(aws iam list-open-id-connect-providers \
  --query "OpenIDConnectProviderList[?contains(Arn, 'token.actions.githubusercontent.com')].Arn" \
  --output text)

if [ -z "$OIDC_PROVIDER_ARN" ]; then
  echo "Creating new OIDC provider..."

  # GitHubのサムプリント取得
  THUMBPRINT=$(echo | openssl s_client -servername token.actions.githubusercontent.com \
    -showcerts -connect token.actions.githubusercontent.com:443 2>/dev/null \
    | openssl x509 -noout -fingerprint -sha1 \
    | cut -d= -f2 | tr -d :)

  OIDC_PROVIDER_ARN=$(aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "${THUMBPRINT}" \
    --query 'OpenIDConnectProviderArn' \
    --output text)

  echo "✅ OIDC Provider created: ${OIDC_PROVIDER_ARN}"
else
  echo "✅ OIDC Provider already exists: ${OIDC_PROVIDER_ARN}"
fi

echo ""

# ------------------------------------------------------------------------------
# 2. IAM ポリシー作成（CloudFormation権限）
# ------------------------------------------------------------------------------
echo "Step 2: Creating IAM Policy for CloudFormation..."

POLICY_ARN=$(aws iam list-policies \
  --scope Local \
  --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" \
  --output text)

if [ -z "$POLICY_ARN" ]; then
  echo "Creating new IAM policy..."

  cat > github-actions-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "s3:*",
        "ec2:*",
        "ecs:*",
        "rds:*",
        "elasticloadbalancing:*",
        "cognito-idp:*",
        "logs:*",
        "cloudwatch:*",
        "sns:*",
        "iam:*",
        "kms:*",
        "secretsmanager:*",
        "cloudfront:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

  POLICY_ARN=$(aws iam create-policy \
    --policy-name "${POLICY_NAME}" \
    --policy-document file://github-actions-policy.json \
    --description "Policy for GitHub Actions to deploy CloudFormation stacks" \
    --query 'Policy.Arn' \
    --output text)

  echo "✅ Policy created: ${POLICY_ARN}"
else
  echo "✅ Policy already exists: ${POLICY_ARN}"
fi

echo ""

# ------------------------------------------------------------------------------
# 3. IAM ロール作成（GitHub Actions用）
# ------------------------------------------------------------------------------
echo "Step 3: Creating IAM Role for GitHub Actions..."

ROLE_ARN=$(aws iam get-role \
  --role-name "${ROLE_NAME}" \
  --query 'Role.Arn' \
  --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "Creating new IAM role..."

  # Trust Policy（GitHubリポジトリのみ信頼）
  cat > trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

  ROLE_ARN=$(aws iam create-role \
    --role-name "${ROLE_NAME}" \
    --assume-role-policy-document file://trust-policy.json \
    --description "Role for GitHub Actions to deploy CloudFormation stacks" \
    --query 'Role.Arn' \
    --output text)

  echo "✅ Role created: ${ROLE_ARN}"

  # ポリシーをロールにアタッチ
  aws iam attach-role-policy \
    --role-name "${ROLE_NAME}" \
    --policy-arn "${POLICY_ARN}"

  echo "✅ Policy attached to role"
else
  echo "✅ Role already exists: ${ROLE_ARN}"
fi

echo ""

# ------------------------------------------------------------------------------
# 4. GitHub Secrets に ROLE ARN を設定
# ------------------------------------------------------------------------------
echo "Step 4: Setting GitHub Secret (AWS_DEPLOY_ROLE_ARN)..."

echo "Setting secret via gh CLI..."
echo "${ROLE_ARN}" | gh secret set AWS_DEPLOY_ROLE_ARN --repo "${GITHUB_REPO}"

echo "✅ GitHub Secret set: AWS_DEPLOY_ROLE_ARN"
echo ""

# ------------------------------------------------------------------------------
# 完了
# ------------------------------------------------------------------------------
echo "===================================="
echo "✅ Setup completed successfully!"
echo "===================================="
echo ""
echo "📋 Summary:"
echo "  OIDC Provider: ${OIDC_PROVIDER_ARN}"
echo "  IAM Role:      ${ROLE_ARN}"
echo "  IAM Policy:    ${POLICY_ARN}"
echo ""
echo "🔐 GitHub Secret:"
echo "  AWS_DEPLOY_ROLE_ARN = ${ROLE_ARN}"
echo ""
echo "Next steps:"
echo "  1. Create a test PR to verify GitHub Actions"
echo "  2. Check CloudFormation Change Sets in PR comments"
echo "  3. Merge PR to trigger deployment"
echo "===================================="

# クリーンアップ
rm -f github-actions-policy.json trust-policy.json
