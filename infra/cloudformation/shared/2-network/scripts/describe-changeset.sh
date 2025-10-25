#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set 詳細表示（dry-run）
# ==============================================================================
# 使い方:
#   ./scripts/describe-changeset.sh [changeset-name]
#
#   changeset-name を省略した場合、最後に作成した Change Set を表示
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
echo "Change Set Details (dry-run)"
echo "==================================="
echo "Stack:      ${STACK_NAME}"
echo "ChangeSet:  ${CHANGESET_NAME}"
echo "==================================="
echo ""

# Change Set のステータス確認
echo "--- Status ---"
STATUS=$(aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Status' \
  --output text)
echo "Status: ${STATUS}"
echo ""

# Change Set の変更内容を表示
echo "--- Changes ---"
aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Changes[].{Action:ResourceChange.Action,LogicalId:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType,Replacement:ResourceChange.Replacement}' \
  --output table

echo ""
echo "--- Summary ---"
CHANGE_COUNT=$(aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'length(Changes)' \
  --output text)
echo "Total changes: ${CHANGE_COUNT}"
echo ""

echo "==================================="
echo "ℹ️  This is a dry-run. No changes were applied."
echo ""
echo "To apply these changes, run:"
echo "   ./scripts/execute-changeset.sh ${CHANGESET_NAME}"
echo "==================================="
