#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set 実行
# ==============================================================================
# 使い方:
#   ./scripts/execute-changeset.sh [changeset-name]
#
#   changeset-name を省略した場合、最後に作成した Change Set を実行
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
STACK_NAME="facilities-shared-network"
CHANGESET_NAME="${1:-}"

# Change Set 名が指定されていない場合、一時ファイルから読み込み
if [ -z "${CHANGESET_NAME}" ]; then
  if [ -f /tmp/changeset-${STACK_NAME}.txt ]; then
    CHANGESET_NAME=$(cat /tmp/changeset-${STACK_NAME}.txt)
    echo "ℹ️  Using last created Change Set: ${CHANGESET_NAME}"
    echo ""
  else
    echo "Error: Change Set name not provided and no recent Change Set found"
    echo "Usage: $0 [changeset-name]"
    exit 1
  fi
fi

echo "==================================="
echo "CloudFormation Change Set 実行"
echo "==================================="
echo "Stack:      ${STACK_NAME}"
echo "ChangeSet:  ${CHANGESET_NAME}"
echo "==================================="
echo ""

# Change Set の変更内容を表示
echo "--- Changes to be applied ---"
aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Changes[].{Action:ResourceChange.Action,LogicalId:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType}' \
  --output table

echo ""

# 最終確認
read -p "⚠️  Do you want to execute this Change Set? (yes/no): " CONFIRMATION

if [ "${CONFIRMATION}" != "yes" ]; then
  echo "Deployment cancelled."
  exit 0
fi

echo ""
echo "Executing Change Set..."
aws cloudformation execute-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}"

echo ""
echo "Waiting for stack operation to complete..."
echo "(This may take several minutes)"
echo ""

# スタックの状態を監視
aws cloudformation wait stack-create-complete \
  --stack-name "${STACK_NAME}" \
  2>/dev/null || \
aws cloudformation wait stack-update-complete \
  --stack-name "${STACK_NAME}" \
  2>/dev/null || {
    echo ""
    echo "❌ Stack operation failed or timed out"
    echo ""
    echo "Check stack events:"
    echo "   aws cloudformation describe-stack-events --stack-name ${STACK_NAME} --max-items 10"
    exit 1
  }

echo ""
echo "==================================="
echo "✅ Deployment completed successfully"
echo "==================================="
echo ""
echo "Stack outputs:"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs' \
  --output table

# 一時ファイル削除
rm -f /tmp/changeset-${STACK_NAME}.txt
