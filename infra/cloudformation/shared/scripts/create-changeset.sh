#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Change Set作成（共通系アカウント）
# ==============================================================================
# 使い方:
#   ./scripts/create-changeset.sh prod
# ==============================================================================

ENVIRONMENT=${1:-prod}

if [ "$ENVIRONMENT" != "prod" ]; then
  echo "Error: Network Shared account only supports 'prod' environment"
  exit 1
fi

PROJECT_NAME="facility"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-shared"
TEMPLATE_FILE="stack.yaml"
PARAMETERS_FILE="parameters/${ENVIRONMENT}.json"
CHANGE_SET_NAME="deploy-$(date +%Y%m%d-%H%M%S)"
TEMPLATES_BUCKET="${PROJECT_NAME}-cloudformation-templates"

echo "===================================="
echo "Creating Change Set for Network Shared"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "Stack Name: ${STACK_NAME}"
echo "Change Set: ${CHANGE_SET_NAME}"
echo ""

# ----------------------------------------------------------------------------
# 1. S3バケット存在確認
# ----------------------------------------------------------------------------
echo "Checking S3 bucket..."
if ! aws s3 ls "s3://${TEMPLATES_BUCKET}" > /dev/null 2>&1; then
  echo "Error: S3 bucket '${TEMPLATES_BUCKET}' does not exist"
  echo "Please create it first:"
  echo "  aws s3 mb s3://${TEMPLATES_BUCKET} --region ap-northeast-1"
  exit 1
fi

# ----------------------------------------------------------------------------
# 2. ネステッドテンプレートをS3にアップロード
# ----------------------------------------------------------------------------
echo "Uploading nested templates to S3..."
aws s3 sync nested/ s3://${TEMPLATES_BUCKET}/shared/nested/ \
  --exclude "*.md" \
  --exclude ".*" \
  --delete

echo "✅ Templates uploaded to s3://${TEMPLATES_BUCKET}/shared/nested/"

# ----------------------------------------------------------------------------
# 3. テンプレート検証
# ----------------------------------------------------------------------------
echo ""
echo "Validating CloudFormation templates..."
aws cloudformation validate-template \
  --template-body file://${TEMPLATE_FILE} \
  > /dev/null

echo "✅ Template validation passed"

# ----------------------------------------------------------------------------
# 4. スタック存在確認（CREATE or UPDATE）
# ----------------------------------------------------------------------------
echo ""
echo "Checking if stack exists..."
if aws cloudformation describe-stacks --stack-name ${STACK_NAME} > /dev/null 2>&1; then
  CHANGE_SET_TYPE="UPDATE"
  echo "Stack exists. Change Set Type: UPDATE"
else
  CHANGE_SET_TYPE="CREATE"
  echo "Stack does not exist. Change Set Type: CREATE"
fi

# ----------------------------------------------------------------------------
# 5. Change Set作成
# ----------------------------------------------------------------------------
echo ""
echo "Creating Change Set..."
aws cloudformation create-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME} \
  --template-body file://${TEMPLATE_FILE} \
  --parameters file://${PARAMETERS_FILE} \
  --capabilities CAPABILITY_NAMED_IAM \
  --change-set-type ${CHANGE_SET_TYPE} \
  --description "Deploy Network Shared infrastructure"

# ----------------------------------------------------------------------------
# 6. Change Set作成完了を待機
# ----------------------------------------------------------------------------
echo ""
echo "Waiting for Change Set creation..."
aws cloudformation wait change-set-create-complete \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGE_SET_NAME}

echo ""
echo "===================================="
echo "✅ Change Set created successfully"
echo "===================================="
echo "Change Set Name: ${CHANGE_SET_NAME}"
echo ""
echo "Next steps:"
echo "  1. Review changes: ./scripts/describe-changeset.sh ${ENVIRONMENT}"
echo "  2. Execute: ./scripts/execute-changeset.sh ${ENVIRONMENT}"
echo ""

# Change Set名を一時ファイルに保存（describe/executeスクリプトで使用）
echo "${CHANGE_SET_NAME}" > /tmp/changeset-${STACK_NAME}.txt
