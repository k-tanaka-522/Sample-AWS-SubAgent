#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set実行
# ==============================================================================
# 使い方:
#   ./scripts/execute-changeset.sh dev network
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
echo "CloudFormation Change Set実行"
echo "===================================="
echo "Environment:  ${ENVIRONMENT}"
echo "Stack:        ${STACK_NAME}"
echo "ChangeSet:    ${CHANGE_SET_NAME}"
echo "===================================="
echo ""

# 本番環境のみ承認プロンプト
if [ "$ENVIRONMENT" = "prod" ]; then
  echo "⚠️  本番環境へのデプロイです"
  echo ""
  read -p "本当に実行しますか？ (yes/no): " CONFIRMATION

  if [ "${CONFIRMATION}" != "yes" ]; then
    echo "デプロイをキャンセルしました"
    exit 0
  fi
fi

# Change Set実行
echo "Change Set を実行中..."
aws cloudformation execute-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGE_SET_NAME}"

echo "✅ Change Set実行開始"
echo ""

# スタックが作成中か更新中か判定
if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" --query 'Stacks[0].StackStatus' --output text | grep -q "CREATE"; then
  WAIT_COMMAND="stack-create-complete"
  echo "スタック作成完了待ち..."
else
  WAIT_COMMAND="stack-update-complete"
  echo "スタック更新完了待ち..."
fi

# 完了待機
aws cloudformation wait "${WAIT_COMMAND}" \
  --stack-name "${STACK_NAME}"

echo ""
echo "===================================="
echo "✅ デプロイ完了: ${STACK_NAME}"
echo "===================================="
echo ""

# Change Set名を削除
rm -f "${CHANGE_SET_FILE}"

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
