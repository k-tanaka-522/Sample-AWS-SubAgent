#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set 作成
# ==============================================================================
# 使い方:
#   ./scripts/create-changeset.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration
STACK_NAME="facilities-shared-network"
TEMPLATE_FILE="${BASE_DIR}/stack.yaml"
PARAMETERS_FILE="${BASE_DIR}/parameters/prod.json"
CHANGESET_NAME="${STACK_NAME}-$(date +%Y%m%d-%H%M%S)"

echo "==================================="
echo "CloudFormation Change Set 作成"
echo "==================================="
echo "Stack:      ${STACK_NAME}"
echo "Template:   ${TEMPLATE_FILE}"
echo "Parameters: ${PARAMETERS_FILE}"
echo "ChangeSet:  ${CHANGESET_NAME}"
echo ""

# 1. テンプレート検証
echo "Validating template..."
aws cloudformation validate-template \
  --template-body file://"${TEMPLATE_FILE}" \
  > /dev/null
echo "✅ Template is valid"
echo ""

# 2. スタック存在確認
if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &>/dev/null; then
  CHANGESET_TYPE="UPDATE"
  echo "Stack exists. Creating UPDATE change set..."
else
  CHANGESET_TYPE="CREATE"
  echo "Stack does not exist. Creating CREATE change set..."
fi
echo ""

# 3. Change Set 作成
echo "Creating Change Set..."
aws cloudformation create-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --template-body file://"${TEMPLATE_FILE}" \
  --parameters file://"${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --change-set-type "${CHANGESET_TYPE}" \
  --description "Shared Account Network Hub (Transit Gateway + Direct Connect)"

echo ""
echo "Waiting for Change Set creation..."
aws cloudformation wait change-set-create-complete \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  2>/dev/null || {
    echo ""
    echo "⚠️  Change Set creation failed or has no changes"
    echo "Checking status..."
    STATUS=$(aws cloudformation describe-change-set \
      --stack-name "${STACK_NAME}" \
      --change-set-name "${CHANGESET_NAME}" \
      --query 'Status' \
      --output text)

    if [ "$STATUS" = "FAILED" ]; then
      REASON=$(aws cloudformation describe-change-set \
        --stack-name "${STACK_NAME}" \
        --change-set-name "${CHANGESET_NAME}" \
        --query 'StatusReason' \
        --output text)

      if [[ "$REASON" == *"didn't contain changes"* ]]; then
        echo "ℹ️  No changes detected. Stack is already up-to-date."
        exit 0
      else
        echo "❌ Error: ${REASON}"
        exit 1
      fi
    fi
  }

echo ""
echo "==================================="
echo "✅ Change Set created successfully"
echo "==================================="
echo ""
echo "ChangeSet Name: ${CHANGESET_NAME}"
echo ""
echo "Next steps:"
echo "1. Review the change set:"
echo "   ./scripts/describe-changeset.sh ${CHANGESET_NAME}"
echo ""
echo "2. Execute the change set (if approved):"
echo "   ./scripts/execute-changeset.sh ${CHANGESET_NAME}"
echo ""

# Change Set 名を一時ファイルに保存
echo "${CHANGESET_NAME}" > /tmp/changeset-${STACK_NAME}.txt
