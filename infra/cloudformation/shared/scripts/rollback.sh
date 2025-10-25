#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Rollback
# ==============================================================================
# 使い方:
#   ./scripts/rollback.sh prod
# ==============================================================================

ENVIRONMENT=${1:-prod}

if [ "$ENVIRONMENT" != "prod" ]; then
  echo "Error: Network Shared account only supports 'prod' environment"
  exit 1
fi

PROJECT_NAME="facility"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-shared"

echo "===================================="
echo "CloudFormation Rollback"
echo "===================================="
echo "Stack Name: ${STACK_NAME}"
echo "===================================="
echo ""

# ----------------------------------------------------------------------------
# スタック存在確認
# ----------------------------------------------------------------------------
if ! aws cloudformation describe-stacks --stack-name ${STACK_NAME} > /dev/null 2>&1; then
  echo "Error: Stack '${STACK_NAME}' does not exist"
  exit 1
fi

# ----------------------------------------------------------------------------
# スタック状態確認
# ----------------------------------------------------------------------------
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query 'Stacks[0].StackStatus' \
  --output text)

echo "Current stack status: ${STACK_STATUS}"
echo ""

# ロールバック可能な状態か確認
if [[ "${STACK_STATUS}" != "UPDATE_COMPLETE" && "${STACK_STATUS}" != "UPDATE_FAILED" ]]; then
  echo "Error: Stack is not in a state that can be rolled back"
  echo "Current status: ${STACK_STATUS}"
  exit 1
fi

# ----------------------------------------------------------------------------
# 確認プロンプト
# ----------------------------------------------------------------------------
echo "⚠️  WARNING: This will roll back the stack to the previous stable state"
echo ""
read -p "Are you sure you want to rollback? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Rollback cancelled."
  exit 0
fi

# ----------------------------------------------------------------------------
# ロールバック実行
# ----------------------------------------------------------------------------
echo ""
echo "Starting rollback..."
aws cloudformation rollback-stack --stack-name ${STACK_NAME}

echo ""
echo "✅ Rollback started"
echo ""

# ----------------------------------------------------------------------------
# ロールバック完了を待機
# ----------------------------------------------------------------------------
echo "Waiting for rollback to complete..."
aws cloudformation wait stack-rollback-complete --stack-name ${STACK_NAME}

echo ""
echo "===================================="
echo "✅ Rollback completed successfully"
echo "===================================="
echo "Stack Name: ${STACK_NAME}"
echo ""

# スタック出力を表示
echo "Stack Outputs:"
echo "--------------"
aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue,Description:Description}' \
  --output table

echo ""
echo "✅ Done"
