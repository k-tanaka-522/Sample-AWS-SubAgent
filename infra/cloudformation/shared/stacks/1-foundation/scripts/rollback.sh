#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation スタック ロールバック（Shared Account - Foundation Stack）
# ==============================================================================
# 使い方:
#   ./scripts/rollback.sh prod
# ==============================================================================

ENVIRONMENT=${1:-prod}

# Configuration
PROJECT_NAME="facilities"
STACK_NAME="${PROJECT_NAME}-shared-foundation-${ENVIRONMENT}"

echo "=== CloudFormation スタック ロールバック ==="
echo "Environment: ${ENVIRONMENT}"
echo "Stack: ${STACK_NAME}"
echo ""

# 最終確認
echo "⚠️  警告: この操作は前回の安定した状態にロールバックします"
echo "         - CloudTrail（組織全体）"
echo "         - Config（組織全体）"
echo "         - GuardDuty（組織全体）"
echo "         - Security Hub（組織全体）"
echo ""
read -p "本当に実行しますか？ (yes/no): " CONFIRMATION

if [ "${CONFIRMATION}" != "yes" ]; then
  echo "キャンセルされました"
  exit 0
fi

# ロールバック実行
echo "ロールバック中..."
aws cloudformation rollback-stack \
  --stack-name "${STACK_NAME}"

echo ""
echo "✅ ロールバックを開始しました"
echo ""
echo "進捗を確認:"
echo "aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --max-items 10"
echo ""
echo "完了を待機:"
echo "aws cloudformation wait stack-rollback-complete --stack-name ${STACK_NAME}"
