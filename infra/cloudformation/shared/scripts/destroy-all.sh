#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Shared Account - Destroy All Stacks
# ==============================================================================
# Usage:
#   ./scripts/destroy-all.sh
#
# DANGER: This will DELETE organization-level infrastructure!
# ==============================================================================

PROJECT_NAME="facilities"
ENVIRONMENT="prod"  # Shared Account is always prod

# スタックを逆順で削除（依存関係を考慮）
STACKS=(
  "3-client-vpn"
  "2-network"
  "1-foundation"
)

echo "===================================="
echo "⚠️  DANGER: Shared Account Stack Deletion"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "Project:     ${PROJECT_NAME}"
echo ""
echo "The following ORGANIZATION-LEVEL stacks will be DELETED:"
for STACK in "${STACKS[@]}"; do
  echo "  - ${PROJECT_NAME}-shared-${STACK}-${ENVIRONMENT}"
done
echo ""
echo "This will affect:"
echo "  - Transit Gateway (ALL Service Accounts will lose connectivity)"
echo "  - CloudTrail, Config, GuardDuty, Security Hub (Organization-wide)"
echo "  - Direct Connect Gateway"
echo ""
echo "This operation is IRREVERSIBLE!"
echo "===================================="
echo ""

# 確認プロンプト
read -p "Are you ABSOLUTELY sure? (type 'DELETE-SHARED' to confirm): " CONFIRM

if [ "$CONFIRM" != "DELETE-SHARED" ]; then
  echo "❌ Deletion cancelled"
  exit 0
fi

echo ""
echo "Starting stack deletion..."
echo ""

# 各スタックを削除
for STACK in "${STACKS[@]}"; do
  STACK_NAME="${PROJECT_NAME}-shared-${STACK}-${ENVIRONMENT}"

  echo "===================================="
  echo "Deleting: ${STACK_NAME}"
  echo "===================================="

  # スタックの存在確認
  if ! aws cloudformation describe-stacks --stack-name ${STACK_NAME} &>/dev/null; then
    echo "⚠️  Stack does not exist: ${STACK_NAME}"
    echo "Skipping..."
    continue
  fi

  # スタック削除
  aws cloudformation delete-stack --stack-name ${STACK_NAME}

  echo "Waiting for stack deletion to complete..."
  aws cloudformation wait stack-delete-complete --stack-name ${STACK_NAME} || {
    echo "❌ Failed to delete stack: ${STACK_NAME}"
    echo ""
    echo "Checking stack events for errors..."
    aws cloudformation describe-stack-events \
      --stack-name ${STACK_NAME} \
      --max-items 10 \
      --query 'StackEvents[?ResourceStatus==`DELETE_FAILED`].[LogicalResourceId,ResourceStatusReason]' \
      --output table

    echo ""
    echo "⚠️  Common issues:"
    echo "  - Transit Gateway has active attachments (delete Service Account stacks first)"
    echo "  - S3 buckets are not empty (manually delete objects)"
    echo "  - Resources have DeletionPolicy: Retain"
    exit 1
  }

  echo "✅ Stack deleted: ${STACK_NAME}"
  echo ""
done

echo "===================================="
echo "✅ All Shared Account stacks deleted"
echo "===================================="
echo ""
echo "⚠️  IMPORTANT: Check for retained resources:"
echo "  - S3 Audit Logs Bucket (DeletionPolicy: Retain)"
echo "  - CloudTrail Logs"
echo "  - CloudWatch Log Groups"
echo ""
echo "These must be deleted manually if needed."
echo "===================================="
