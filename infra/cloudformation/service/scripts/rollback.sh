#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation スタック ロールバック
# ==============================================================================
# 使い方:
#   ./scripts/rollback.sh dev network
# ==============================================================================

ENVIRONMENT=${1:-}
STACK_TYPE=${2:-}

if [ -z "$ENVIRONMENT" ] || [ -z "$STACK_TYPE" ]; then
  echo "Usage: $0 <environment> <stack-type>"
  echo "  environment: dev, stg, prod"
  echo "  stack-type: network, database, compute, auth, frontend, monitoring, batch"
  exit 1
fi

PROJECT_NAME="facility"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-${STACK_TYPE}"

echo "===================================="
echo "CloudFormation ロールバック"
echo "===================================="
echo "Stack: ${STACK_NAME}"
echo "===================================="
echo ""

# スタック存在確認
if ! aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &>/dev/null; then
  echo "Error: スタック ${STACK_NAME} が見つかりません"
  exit 1
fi

# 現在のスタック状態
CURRENT_STATUS=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].StackStatus' \
  --output text)

echo "現在の状態: ${CURRENT_STATUS}"
echo ""

# ロールバック可能か確認
if [[ "${CURRENT_STATUS}" != "UPDATE_FAILED" && "${CURRENT_STATUS}" != "UPDATE_ROLLBACK_FAILED" ]]; then
  echo "⚠️  ロールバックできる状態ではありません"
  echo "ロールバック可能な状態: UPDATE_FAILED, UPDATE_ROLLBACK_FAILED"
  exit 1
fi

# 最終確認
echo "⚠️  警告: この操作は前回の安定した状態にロールバックします"
echo ""
read -p "本当に実行しますか？ (yes/no): " CONFIRMATION

if [ "${CONFIRMATION}" != "yes" ]; then
  echo "ロールバックをキャンセルしました"
  exit 0
fi

# ロールバック実行
echo "ロールバック中..."
aws cloudformation rollback-stack \
  --stack-name "${STACK_NAME}"

echo "✅ ロールバック開始"
echo ""

# 完了待機
echo "ロールバック完了待ち..."
aws cloudformation wait stack-rollback-complete \
  --stack-name "${STACK_NAME}"

echo ""
echo "===================================="
echo "✅ ロールバック完了: ${STACK_NAME}"
echo "===================================="
echo ""

# スタック情報表示
echo "スタック情報:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].[StackName, StackStatus, LastUpdatedTime]' \
  --output table

echo ""
echo "進捗を確認:"
echo "aws cloudformation describe-stack-events --stack-name ${STACK_NAME}"
echo ""
