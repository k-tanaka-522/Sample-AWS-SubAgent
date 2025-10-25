#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation デプロイ（オーケストレーション）
# ==============================================================================
# 使い方:
#   ./scripts/deploy.sh dev network
# ==============================================================================

ENVIRONMENT=${1:-}
STACK_TYPE=${2:-}

if [ -z "$ENVIRONMENT" ] || [ -z "$STACK_TYPE" ]; then
  echo "Usage: $0 <environment> <stack-type>"
  echo "  environment: dev, stg, prod"
  echo "  stack-type: network, database, compute, auth, frontend, monitoring, batch"
  exit 1
fi

echo "===================================="
echo "CloudFormation デプロイ"
echo "===================================="
echo "Environment:  ${ENVIRONMENT}"
echo "Stack Type:   ${STACK_TYPE}"
echo "===================================="
echo ""

# 1. Change Set作成
echo "Step 1/3: Change Set作成"
./scripts/create-changeset.sh "${ENVIRONMENT}" "${STACK_TYPE}"

# 2. Change Set詳細表示（dry-run）
echo ""
echo "Step 2/3: Change Set詳細表示（dry-run）"
./scripts/describe-changeset.sh "${ENVIRONMENT}" "${STACK_TYPE}"

# 3. Change Set実行
echo ""
echo "Step 3/3: Change Set実行"
./scripts/execute-changeset.sh "${ENVIRONMENT}" "${STACK_TYPE}"

echo ""
echo "===================================="
echo "✅ デプロイ完了"
echo "===================================="
