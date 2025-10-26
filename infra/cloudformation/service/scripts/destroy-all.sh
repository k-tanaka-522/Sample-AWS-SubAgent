#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Service Account - Destroy All Stacks
# ==============================================================================
# Usage:
#   ./scripts/destroy-all.sh dev
#
# DANGER: This will DELETE all infrastructure resources!
# ==============================================================================

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  echo "  Example: $0 dev"
  exit 1
fi

PROJECT_NAME="facilities"

# スタックを逆順で削除（依存関係を考慮）
STACKS=(
  "06-monitoring"
  "05-storage"
  "04-auth"
  "03-compute"
  "02-database"
  "01-network"
)

echo "===================================="
echo "⚠️  DANGER: CloudFormation Stack Deletion"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "Project:     ${PROJECT_NAME}"
echo ""
echo "The following stacks will be DELETED:"
for STACK in "${STACKS[@]}"; do
  echo "  - ${PROJECT_NAME}-${ENVIRONMENT}-${STACK}"
done
echo ""
echo "This operation is IRREVERSIBLE!"
echo "===================================="
echo ""

# 確認プロンプト
read -p "Are you sure you want to DELETE all stacks? (type 'DELETE' to confirm): " CONFIRM

if [ "$CONFIRM" != "DELETE" ]; then
  echo "❌ Deletion cancelled"
  exit 0
fi

echo ""
echo "Starting stack deletion..."
echo ""

# 各スタックを削除
for STACK in "${STACKS[@]}"; do
  STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-${STACK}"

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
    echo "⚠️  You may need to:"
    echo "  1. Manually delete resources that failed to delete"
    echo "  2. Re-run this script to delete remaining stacks"
    exit 1
  }

  echo "✅ Stack deleted: ${STACK_NAME}"
  echo ""
done

echo "===================================="
echo "✅ All stacks deleted successfully"
echo "===================================="
echo ""
echo "Note: Some resources may have DeletionPolicy: Retain"
echo "Check AWS Console for retained resources:"
echo "  - S3 Buckets"
echo "  - CloudWatch Log Groups"
echo "  - RDS Snapshots"
echo "===================================="
