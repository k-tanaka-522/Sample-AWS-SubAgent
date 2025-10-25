#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set 実行（Shared Account - Foundation Stack）
# ==============================================================================
# 使い方:
#   ./scripts/execute-changeset.sh prod <changeset-name>
# ==============================================================================

ENVIRONMENT=${1:-prod}
CHANGESET_NAME=${2:-}

# Configuration
PROJECT_NAME="facilities"
STACK_NAME="${PROJECT_NAME}-shared-foundation-${ENVIRONMENT}"

# Change Set 名が指定されていない場合、一時ファイルから読み込む
if [ -z "${CHANGESET_NAME}" ]; then
  if [ -f "/tmp/changeset-${STACK_NAME}.txt" ]; then
    CHANGESET_NAME=$(cat /tmp/changeset-${STACK_NAME}.txt)
    echo "Using Change Set from last create: ${CHANGESET_NAME}"
  else
    echo "Error: ChangeSet名を指定してください"
    echo "Usage: $0 <environment> <changeset-name>"
    exit 1
  fi
fi

echo "=== CloudFormation Change Set 実行 ==="
echo "Environment: ${ENVIRONMENT}"
echo "Stack: ${STACK_NAME}"
echo "ChangeSet: ${CHANGESET_NAME}"
echo ""

# 最終確認
echo "⚠️  警告: この操作は Shared Account の基盤スタックを変更します"
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

# Change Set 実行
echo "Change Set を実行中..."
aws cloudformation execute-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}"

echo ""
echo "✅ Change Set の実行を開始しました"
echo ""
echo "進捗を確認:"
echo "aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --max-items 10"
echo ""
echo "完了を待機:"
echo "aws cloudformation wait stack-create-complete --stack-name ${STACK_NAME}"
echo "または"
echo "aws cloudformation wait stack-update-complete --stack-name ${STACK_NAME}"

# 一時ファイルを削除
rm -f /tmp/changeset-${STACK_NAME}.txt
