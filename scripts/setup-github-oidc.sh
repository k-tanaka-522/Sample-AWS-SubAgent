#!/bin/bash
set -euo pipefail

# ==============================================================================
# GitHub Actions OIDC Setup for AWS
# ==============================================================================
# Usage:
#   bash scripts/setup-github-oidc.sh
#
# Prerequisites:
#   - AWS CLI configured with admin credentials
#   - gh CLI authenticated
#   - Repository: k-tanaka-522/Sample-AWS-SubAgent
# ==============================================================================

GITHUB_ORG="k-tanaka-522"
GITHUB_REPO="Sample-AWS-SubAgent"
AWS_ACCOUNT_ID="897167645238"
ROLE_NAME="GitHubActionsDeployRole"
POLICY_NAME="GitHubActionsDeployPolicy"

echo "===================================="
echo "GitHub Actions OIDC Setup"
echo "===================================="
echo "AWS Account: ${AWS_ACCOUNT_ID}"
echo "GitHub Repo: ${GITHUB_ORG}/${GITHUB_REPO}"
echo "IAM Role:    ${ROLE_NAME}"
echo "===================================="
echo ""

# ==============================================================================
# Step 1: Create OIDC Provider
# ==============================================================================
echo "Step 1: Creating OIDC Provider..."

OIDC_PROVIDER_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn ${OIDC_PROVIDER_ARN} &>/dev/null; then
  echo "⚠️  OIDC Provider already exists"
else
  aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    --thumbprint-list 1c58a3a8518e8759bf075b76b750d4f2df264fcd

  echo "✅ OIDC Provider created"
fi

echo ""

# ==============================================================================
# Step 2: Create IAM Policy
# ==============================================================================
echo "Step 2: Creating IAM Policy..."

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
        "cloudfront:*",
        "ssm:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

POLICY_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn ${POLICY_ARN} &>/dev/null; then
  echo "⚠️  Policy already exists: ${POLICY_NAME}"
  echo "Updating policy version..."

  aws iam create-policy-version \
    --policy-arn ${POLICY_ARN} \
    --policy-document file://github-actions-policy.json \
    --set-as-default

  echo "✅ Policy updated"
else
  aws iam create-policy \
    --policy-name ${POLICY_NAME} \
    --policy-document file://github-actions-policy.json \
    --description "Policy for GitHub Actions CloudFormation deployments"

  echo "✅ Policy created: ${POLICY_NAME}"
fi

rm -f github-actions-policy.json
echo ""

# ==============================================================================
# Step 3: Create IAM Role with Trust Policy
# ==============================================================================
echo "Step 3: Creating IAM Role..."

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
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_ORG}/${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"

if aws iam get-role --role-name ${ROLE_NAME} &>/dev/null; then
  echo "⚠️  Role already exists: ${ROLE_NAME}"
  echo "Updating trust policy..."

  aws iam update-assume-role-policy \
    --role-name ${ROLE_NAME} \
    --policy-document file://trust-policy.json

  echo "✅ Trust policy updated"
else
  aws iam create-role \
    --role-name ${ROLE_NAME} \
    --assume-role-policy-document file://trust-policy.json \
    --description "Role for GitHub Actions to deploy CloudFormation stacks"

  echo "✅ Role created: ${ROLE_NAME}"
fi

rm -f trust-policy.json
echo ""

# ==============================================================================
# Step 4: Attach Policy to Role
# ==============================================================================
echo "Step 4: Attaching policy to role..."

aws iam attach-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-arn ${POLICY_ARN}

echo "✅ Policy attached to role"
echo ""

# ==============================================================================
# Step 5: Set GitHub Secret
# ==============================================================================
echo "Step 5: Setting GitHub Secret..."

gh secret set AWS_ROLE_ARN \
  --repo ${GITHUB_ORG}/${GITHUB_REPO} \
  --body "${ROLE_ARN}"

echo "✅ GitHub Secret set: AWS_ROLE_ARN"
echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo "===================================="
echo "✅ OIDC Setup Complete"
echo "===================================="
echo ""
echo "OIDC Provider ARN:"
echo "  ${OIDC_PROVIDER_ARN}"
echo ""
echo "IAM Role ARN:"
echo "  ${ROLE_ARN}"
echo ""
echo "IAM Policy ARN:"
echo "  ${POLICY_ARN}"
echo ""
echo "GitHub Secret:"
echo "  AWS_ROLE_ARN (set in repository secrets)"
echo ""
echo "===================================="
echo "Next Steps:"
echo "  1. Verify GitHub Actions workflow: .github/workflows/cloudformation-deploy.yml"
echo "  2. Create a test PR to verify OIDC authentication"
echo "  3. Check CloudFormation Change Sets in PR comments"
echo "===================================="
