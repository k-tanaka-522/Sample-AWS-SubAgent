#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set詳細表示（dry-run）
# ==============================================================================
# 使い方:
#   ./scripts/describe-changeset.sh dev network
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
CHANGE_SET_FILE="/tmp/changeset-${STACK_NAME}.txt"

if [ ! -f "${CHANGE_SET_FILE}" ]; then
  echo "Error: Change Set名が見つかりません"
  echo "先に ./scripts/create-changeset.sh ${ENVIRONMENT} ${STACK_TYPE} を実行してください"
  exit 1
fi

CHANGE_SET_NAME=$(cat "${CHANGE_SET_FILE}")

echo "===================================="
echo "Change Set詳細表示（dry-run）"
echo "===================================="
echo "Stack:        ${STACK_NAME}"
echo "ChangeSet:    ${CHANGE_SET_NAME}"
echo "===================================="
echo ""

# Change Set のステータス確認
echo "--- ステータス ---"
STATUS=$(aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGE_SET_NAME}" \
  --query 'Status' \
  --output text)

echo "Status: ${STATUS}"
echo ""

# 変更内容の表示
echo "--- 変更内容 ---"
aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGE_SET_NAME}" \
  --query 'Changes[*].[ResourceChange.Action, ResourceChange.LogicalResourceId, ResourceChange.ResourceType, ResourceChange.Replacement]' \
  --output table

echo ""
echo "===================================="
echo "変更内容の確認完了"
echo "===================================="
echo ""
echo "詳細を確認する場合:"
echo "aws cloudformation describe-change-set --stack-name ${STACK_NAME} --change-set-name ${CHANGE_SET_NAME}"
echo ""
echo "次のステップ:"
echo "./scripts/execute-changeset.sh ${ENVIRONMENT} ${STACK_TYPE}"
echo ""
