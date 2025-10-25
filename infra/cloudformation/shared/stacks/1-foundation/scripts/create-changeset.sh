#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set 作成（Shared Account - Foundation Stack）
# ==============================================================================
# 使い方:
#   ./scripts/create-changeset.sh prod
# ==============================================================================

ENVIRONMENT=${1:-prod}

# Configuration
PROJECT_NAME="facilities"
STACK_NAME="${PROJECT_NAME}-shared-foundation-${ENVIRONMENT}"
TEMPLATE_FILE="stack.yaml"
PARAMETERS_FILE="parameters/${ENVIRONMENT}.json"
CHANGESET_NAME="${STACK_NAME}-$(date +%Y%m%d-%H%M%S)"

echo "=== CloudFormation Change Set 作成 ==="
echo "Environment: ${ENVIRONMENT}"
echo "Stack: ${STACK_NAME}"
echo "Template: ${TEMPLATE_FILE}"
echo "Parameters: ${PARAMETERS_FILE}"
echo "ChangeSet: ${CHANGESET_NAME}"
echo ""

# Change Set のタイプを判定（新規作成 or 更新）
if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &>/dev/null; then
  CHANGESET_TYPE="UPDATE"
  echo "Stack exists. Creating UPDATE Change Set..."
else
  CHANGESET_TYPE="CREATE"
  echo "Stack does not exist. Creating CREATE Change Set..."
fi

# Change Set 作成（dry-run）
aws cloudformation create-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --template-body "file://${TEMPLATE_FILE}" \
  --parameters "file://${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --change-set-type "${CHANGESET_TYPE}" \
  --description "Foundation stack for Shared Account: Organizations, CloudTrail, Config, GuardDuty, Security Hub"

echo ""
echo "Waiting for Change Set creation..."
aws cloudformation wait change-set-create-complete \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}"

echo ""
echo "✅ Change Set が作成されました"
echo ""
echo "Change Set Name: ${CHANGESET_NAME}"
echo ""
echo "次のステップ:"
echo "1. ./scripts/describe-changeset.sh ${ENVIRONMENT} ${CHANGESET_NAME}"
echo "   （変更内容を確認）"
echo ""
echo "2. ./scripts/execute-changeset.sh ${ENVIRONMENT} ${CHANGESET_NAME}"
echo "   （承認後に実行）"
echo ""

# Change Set 名を一時ファイルに保存
echo "${CHANGESET_NAME}" > /tmp/changeset-${STACK_NAME}.txt
