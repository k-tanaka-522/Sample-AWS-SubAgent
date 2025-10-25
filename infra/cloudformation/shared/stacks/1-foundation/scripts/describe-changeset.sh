#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set 内容確認（Shared Account - Foundation Stack）
# ==============================================================================
# 使い方:
#   ./scripts/describe-changeset.sh prod <changeset-name>
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

echo "=== CloudFormation Change Set 内容確認 ==="
echo "Environment: ${ENVIRONMENT}"
echo "Stack: ${STACK_NAME}"
echo "ChangeSet: ${CHANGESET_NAME}"
echo ""

# Change Set のステータス確認
echo "--- ステータス ---"
STATUS=$(aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Status' \
  --output text)

echo "Status: ${STATUS}"
echo ""

# 変更内容の表示
echo "--- 変更内容 ---"
aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Changes[*].[ResourceChange.Action, ResourceChange.LogicalResourceId, ResourceChange.ResourceType, ResourceChange.Replacement]' \
  --output table

echo ""
echo "詳細を確認する場合:"
echo "aws cloudformation describe-change-set --stack-name ${STACK_NAME} --change-set-name ${CHANGESET_NAME}"
echo ""
echo "次のステップ:"
echo "./scripts/execute-changeset.sh ${ENVIRONMENT} ${CHANGESET_NAME}"
