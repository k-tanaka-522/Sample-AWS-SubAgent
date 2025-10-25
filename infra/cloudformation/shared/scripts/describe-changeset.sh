#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set詳細表示（dry-run）
# ==============================================================================
# 使い方:
#   ./scripts/describe-changeset.sh prod
# ==============================================================================

ENVIRONMENT=${1:-prod}

if [ "$ENVIRONMENT" != "prod" ]; then
  echo "Error: Network Shared account only supports 'prod' environment"
  exit 1
fi

PROJECT_NAME="facility"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-shared"

# Change Set名を一時ファイルから取得
CHANGESET_FILE="/tmp/changeset-${STACK_NAME}.txt"
if [ ! -f "${CHANGESET_FILE}" ]; then
  echo "Error: No Change Set found for stack '${STACK_NAME}'"
  echo "Please run create-changeset.sh first"
  exit 1
fi

CHANGE_SET_NAME=$(cat ${CHANGESET_FILE})

echo "===================================="
echo "Change Set Details (dry-run)"
echo "===================================="
echo "Stack Name: ${STACK_NAME}"
echo "Change Set: ${CHANGE_SET_NAME}"
echo "===================================="
echo ""

# ----------------------------------------------------------------------------
# Change Set詳細を取得
# ----------------------------------------------------------------------------
echo "Fetching Change Set details..."
echo ""

# ステータス確認
STATUS=$(aws cloudformation describe-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME} \
  --query 'Status' \
  --output text)

echo "Status: ${STATUS}"
echo ""

# 変更内容をテーブル形式で表示
echo "Changes:"
echo "--------"
aws cloudformation describe-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME} \
  --query 'Changes[].{Action:ResourceChange.Action,LogicalId:ResourceChange.LogicalResourceId,Type:ResourceChange.ResourceType,Replacement:ResourceChange.Replacement}' \
  --output table

echo ""
echo "===================================="
echo "Summary"
echo "===================================="

# 変更のサマリー（追加・削除・変更の数）
ADD_COUNT=$(aws cloudformation describe-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME} \
  --query 'Changes[?ResourceChange.Action==`Add`] | length(@)' \
  --output text)

MODIFY_COUNT=$(aws cloudformation describe-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME} \
  --query 'Changes[?ResourceChange.Action==`Modify`] | length(@)' \
  --output text)

REMOVE_COUNT=$(aws cloudformation describe-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME} \
  --query 'Changes[?ResourceChange.Action==`Remove`] | length(@)' \
  --output text)

echo "Add:    ${ADD_COUNT}"
echo "Modify: ${MODIFY_COUNT}"
echo "Remove: ${REMOVE_COUNT}"

echo ""
echo "===================================="
echo ""
echo "ℹ️  This is a dry-run. No changes were applied."
echo ""
echo "To execute this Change Set, run:"
echo "  ./scripts/execute-changeset.sh ${ENVIRONMENT}"
echo ""
