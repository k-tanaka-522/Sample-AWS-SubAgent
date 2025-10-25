#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Master Stack デプロイ（Change Sets使用）
# ==============================================================================
# 使い方:
#   ./scripts/deploy-master-stack.sh dev
# ==============================================================================

ENVIRONMENT=${1:-}
SCRIPT_DIR=$(cd $(dirname $0) && pwd)
PROJECT_ROOT=$(cd ${SCRIPT_DIR}/.. && pwd)

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  echo "  environment: dev, stg, prod"
  exit 1
fi

# パラメータファイルの存在確認
PARAM_FILE="${PROJECT_ROOT}/parameters/${ENVIRONMENT}.json"
if [ ! -f "$PARAM_FILE" ]; then
  echo "Error: Parameter file not found: $PARAM_FILE"
  exit 1
fi

STACK_NAME="facility-${ENVIRONMENT}-master"
CHANGESET_NAME="${STACK_NAME}-$(date +%Y%m%d-%H%M%S)"

echo "===================================="
echo "CloudFormation Master Stack デプロイ"
echo "===================================="
echo "Environment:  ${ENVIRONMENT}"
echo "Stack Name:   ${STACK_NAME}"
echo "ChangeSet:    ${CHANGESET_NAME}"
echo "===================================="
echo ""

# ============================================================================
# Step 1: ネステッドテンプレートのS3アップロード
# ============================================================================
echo "Step 1/5: ネステッドテンプレートをS3にアップロード"

# パラメータファイルからS3バケット名を取得
S3_BUCKET=$(cat "$PARAM_FILE" | grep TemplateS3Bucket | awk -F'"' '{print $4}')
S3_PREFIX=$(cat "$PARAM_FILE" | grep TemplateS3Prefix | awk -F'"' '{print $4}')

echo "S3 Bucket: s3://${S3_BUCKET}/${S3_PREFIX}"

# S3バケットの存在確認
if ! aws s3 ls "s3://${S3_BUCKET}" > /dev/null 2>&1; then
  echo "Error: S3 bucket '${S3_BUCKET}' does not exist"
  echo "Please create the bucket first or update TemplateS3Bucket parameter"
  exit 1
fi

# ネステッドテンプレートのアップロード
echo "Uploading nested templates..."
aws s3 sync "${PROJECT_ROOT}/nested" "s3://${S3_BUCKET}/${S3_PREFIX}/nested" \
  --exclude "*" \
  --include "*.yaml" \
  --delete

echo "✅ Upload complete"
echo ""

# ============================================================================
# Step 2: Change Set作成
# ============================================================================
echo "Step 2/5: Change Set作成（dry-run）"

# スタックが既に存在するか確認
if aws cloudformation describe-stacks --stack-name "${STACK_NAME}" > /dev/null 2>&1; then
  CHANGESET_TYPE="UPDATE"
  echo "既存スタックを更新します"
else
  CHANGESET_TYPE="CREATE"
  echo "新規スタックを作成します"
fi

# Change Set作成
aws cloudformation create-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --template-body "file://${PROJECT_ROOT}/stack.yaml" \
  --parameters "file://${PARAM_FILE}" \
  --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
  --change-set-type "${CHANGESET_TYPE}" \
  --description "Deploy master stack for ${ENVIRONMENT} environment"

echo "Change Set作成中..."
aws cloudformation wait change-set-create-complete \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" || {
  echo ""
  echo "Change Set作成失敗または変更なし"

  # 変更がない場合のエラーを確認
  STATUS=$(aws cloudformation describe-change-set \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}" \
    --query 'Status' \
    --output text)

  STATUS_REASON=$(aws cloudformation describe-change-set \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}" \
    --query 'StatusReason' \
    --output text)

  echo "Status: ${STATUS}"
  echo "Reason: ${STATUS_REASON}"

  if [[ "$STATUS_REASON" == *"didn't contain changes"* ]]; then
    echo "✅ デプロイ済み（変更なし）"
    aws cloudformation delete-change-set \
      --stack-name "${STACK_NAME}" \
      --change-set-name "${CHANGESET_NAME}"
    exit 0
  else
    exit 1
  fi
}

echo "✅ Change Set作成完了"
echo ""

# ============================================================================
# Step 3: Change Set詳細表示
# ============================================================================
echo "Step 3/5: Change Set内容確認"

echo "--- 変更内容 ---"
aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Changes[*].[ResourceChange.Action, ResourceChange.LogicalResourceId, ResourceChange.ResourceType]' \
  --output table

echo ""
echo "--- 統計 ---"
CHANGES=$(aws cloudformation describe-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}" \
  --query 'Changes' \
  --output json)

ADD_COUNT=$(echo "$CHANGES" | grep -c '"Action": "Add"' || true)
MODIFY_COUNT=$(echo "$CHANGES" | grep -c '"Action": "Modify"' || true)
REMOVE_COUNT=$(echo "$CHANGES" | grep -c '"Action": "Remove"' || true)

echo "Add:    ${ADD_COUNT}"
echo "Modify: ${MODIFY_COUNT}"
echo "Remove: ${REMOVE_COUNT}"
echo ""

# ============================================================================
# Step 4: 実行確認
# ============================================================================
echo "Step 4/5: 実行確認"
echo "⚠️  この Change Set を実行しますか？"
echo "   Stack: ${STACK_NAME}"
echo "   Environment: ${ENVIRONMENT}"
echo ""

read -p "実行する場合は 'yes' と入力してください: " CONFIRMATION

if [ "${CONFIRMATION}" != "yes" ]; then
  echo "キャンセルされました"
  echo "Change Set を削除しています..."
  aws cloudformation delete-change-set \
    --stack-name "${STACK_NAME}" \
    --change-set-name "${CHANGESET_NAME}"
  exit 0
fi

echo ""

# ============================================================================
# Step 5: Change Set実行
# ============================================================================
echo "Step 5/5: Change Set実行"

aws cloudformation execute-change-set \
  --stack-name "${STACK_NAME}" \
  --change-set-name "${CHANGESET_NAME}"

echo "Change Set実行中..."
echo "スタック作成/更新を監視しています（Ctrl+Cで監視停止、デプロイは継続）"
echo ""

# スタック作成/更新の完了を待機
if [ "${CHANGESET_TYPE}" == "CREATE" ]; then
  aws cloudformation wait stack-create-complete \
    --stack-name "${STACK_NAME}" || {
    echo "❌ スタック作成失敗"
    exit 1
  }
else
  aws cloudformation wait stack-update-complete \
    --stack-name "${STACK_NAME}" || {
    echo "❌ スタック更新失敗"
    exit 1
  }
fi

echo ""
echo "===================================="
echo "✅ デプロイ完了"
echo "===================================="
echo ""

# スタック出力の表示
echo "--- Stack Outputs ---"
aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query 'Stacks[0].Outputs[*].[OutputKey, OutputValue]' \
  --output table

echo ""
echo "Stack URL: https://console.aws.amazon.com/cloudformation/home#/stacks/stackinfo?stackId=${STACK_NAME}"
