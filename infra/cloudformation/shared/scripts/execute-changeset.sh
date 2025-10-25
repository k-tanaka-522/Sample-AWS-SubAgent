#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set実行
# ==============================================================================
# 使い方:
#   ./scripts/execute-changeset.sh prod
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
echo "Execute Change Set"
echo "===================================="
echo "Stack Name: ${STACK_NAME}"
echo "Change Set: ${CHANGE_SET_NAME}"
echo "===================================="
echo ""

# ----------------------------------------------------------------------------
# 確認プロンプト（本番環境）
# ----------------------------------------------------------------------------
read -p "⚠️  Are you sure you want to execute this Change Set? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Deployment cancelled."
  exit 0
fi

# ----------------------------------------------------------------------------
# Change Set実行
# ----------------------------------------------------------------------------
echo ""
echo "Executing Change Set..."
aws cloudformation execute-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME}

echo ""
echo "✅ Change Set execution started"
echo ""

# ----------------------------------------------------------------------------
# スタック作成/更新完了を待機
# ----------------------------------------------------------------------------
echo "Waiting for stack operation to complete..."
echo "(This may take 10-20 minutes for Network Shared infrastructure)"
echo ""

# スタックの状態を取得
STACK_EXISTS=$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} 2>/dev/null || echo "false")

if [ "$STACK_EXISTS" != "false" ]; then
  # UPDATEの場合
  aws cloudformation wait stack-update-complete --stack-name ${STACK_NAME} 2>/dev/null || \
  # CREATEの場合
  aws cloudformation wait stack-create-complete --stack-name ${STACK_NAME}
else
  # CREATEの場合
  aws cloudformation wait stack-create-complete --stack-name ${STACK_NAME}
fi

echo ""
echo "===================================="
echo "✅ Deployment completed successfully"
echo "===================================="
echo "Stack Name: ${STACK_NAME}"
echo ""

# ----------------------------------------------------------------------------
# スタック出力を表示
# ----------------------------------------------------------------------------
echo "Stack Outputs:"
echo "--------------"
aws cloudformation describe-stacks \
  --stack-name ${STACK_NAME} \
  --query 'Stacks[0].Outputs[].{Key:OutputKey,Value:OutputValue,Description:Description}' \
  --output table

echo ""
echo "===================================="
echo ""

# 一時ファイルを削除
rm -f ${CHANGESET_FILE}

echo "✅ Done"
