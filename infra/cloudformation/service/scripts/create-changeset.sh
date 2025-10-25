#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set作成
# ==============================================================================
# 使い方:
#   ./scripts/create-changeset.sh dev network
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
TEMPLATE_FILE="nested/${STACK_TYPE}/main.yaml"
PARAMETERS_FILE="parameters/${ENVIRONMENT}.json"
CHANGE_SET_NAME="deploy-$(date +%Y%m%d-%H%M%S)"
TEMPLATES_BUCKET="${PROJECT_NAME}-cloudformation-templates-${ENVIRONMENT}"

echo "===================================="
echo "CloudFormation Change Set作成"
echo "===================================="
echo "Environment:  ${ENVIRONMENT}"
echo "Stack:        ${STACK_NAME}"
echo "Template:     ${TEMPLATE_FILE}"
echo "Parameters:   ${PARAMETERS_FILE}"
echo "ChangeSet:    ${CHANGE_SET_NAME}"
echo "===================================="
echo ""

# 1. S3にネステッドテンプレートをアップロード
echo "[1/4] S3にネステッドテンプレートをアップロード中..."
aws s3 sync nested/ "s3://${TEMPLATES_BUCKET}/nested/" --exclude "*.md" --exclude "README.md"
echo "✅ アップロード完了"
echo ""

# 2. テンプレート検証
echo "[2/4] テンプレート検証中..."
aws cloudformation validate-template \
  --template-body "file://${TEMPLATE_FILE}" \
  > /dev/null
echo "✅ テンプレート検証成功"
echo ""

# 3. Change Set作成
echo "[3/4] Change Set作成中..."

# スタックが存在するか確認
if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" &>/dev/null; then
  CHANGE_SET_TYPE="UPDATE"
  echo "既存スタックを更新します"
else
  CHANGE_SET_TYPE="CREATE"
  echo "新規スタックを作成します"
fi

aws cloudformation create-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGE_SET_NAME}" \
  --template-body "file://${TEMPLATE_FILE}" \
  --parameters "file://${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --change-set-type "${CHANGE_SET_TYPE}" \
  --tags \
    Key=Environment,Value="${ENVIRONMENT}" \
    Key=ManagedBy,Value=CloudFormation \
    Key=Project,Value="${PROJECT_NAME}"

echo "✅ Change Set作成リクエスト送信完了"
echo ""

# 4. 待機
echo "[4/4] Change Set作成完了待ち..."
aws cloudformation wait change-set-create-complete \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGE_SET_NAME}"

echo "✅ Change Set作成完了"
echo ""

# Change Set名を一時ファイルに保存
echo "${CHANGE_SET_NAME}" > "/tmp/changeset-${STACK_NAME}.txt"

echo "===================================="
echo "✅ Change Set作成成功"
echo "===================================="
echo ""
echo "次のステップ:"
echo "1. ./scripts/describe-changeset.sh ${ENVIRONMENT} ${STACK_TYPE}"
echo "   （変更内容を確認）"
echo ""
echo "2. ./scripts/execute-changeset.sh ${ENVIRONMENT} ${STACK_TYPE}"
echo "   （承認後に実行）"
echo ""
