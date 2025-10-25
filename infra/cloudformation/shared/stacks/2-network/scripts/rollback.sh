#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation スタック ロールバック
# ==============================================================================
# 使い方:
#   ./scripts/rollback.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
STACK_NAME="facilities-shared-network"

echo "==================================="
echo "CloudFormation スタック ロールバック"
echo "==================================="
echo "Stack: ${STACK_NAME}"
echo "==================================="
echo ""

# スタックの存在確認
if ! aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &>/dev/null; then
  echo "Error: Stack '${STACK_NAME}' does not exist"
  exit 1
fi

# 現在のスタック状態を表示
STACK_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' \
  --output text)

echo "Current stack status: ${STACK_STATUS}"
echo ""

# ロールバック可能な状態かチェック
if [[ ! "${STACK_STATUS}" =~ (UPDATE_FAILED|UPDATE_ROLLBACK_FAILED|CREATE_FAILED) ]]; then
  echo "⚠️  Warning: Stack is in '${STACK_STATUS}' state"
  echo "Rollback is typically used when stack is in UPDATE_FAILED or CREATE_FAILED state"
  echo ""
fi

# 最終確認
echo "⚠️  WARNING: This operation will rollback to the previous stable state"
echo "All changes made in the last update will be reverted."
echo ""
read -p "Are you sure you want to rollback? (yes/no): " CONFIRMATION

if [ "${CONFIRMATION}" != "yes" ]; then
  echo "Rollback cancelled."
  exit 0
fi

echo ""
echo "Initiating rollback..."

# ロールバック実行
aws cloudformation rollback-stack \
  --stack-name "${STACK_NAME}"

echo ""
echo "Waiting for rollback to complete..."
echo "(This may take several minutes)"
echo ""

# ロールバック完了を待機
aws cloudformation wait stack-rollback-complete \
  --stack-name "${STACK_NAME}" \
  2>/dev/null || {
    echo ""
    echo "❌ Rollback failed or timed out"
    echo ""
    echo "Check stack events:"
    echo "   aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --max-items 10"
    exit 1
  }

echo ""
echo "==================================="
echo "✅ Rollback completed successfully"
echo "==================================="
echo ""
echo "Stack status:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].{Status:StackStatus,StatusReason:StackStatusReason}' \
  --output table
