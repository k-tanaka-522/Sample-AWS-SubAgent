#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation デプロイ（オーケストレーション）
# ==============================================================================
# 使い方:
#   ./scripts/deploy.sh prod
#
# このスクリプトは以下を順番に実行します:
#   1. create-changeset.sh
#   2. describe-changeset.sh
#   3. execute-changeset.sh
# ==============================================================================

ENVIRONMENT=${1:-prod}

if [ "$ENVIRONMENT" != "prod" ]; then
  echo "Error: Network Shared account only supports 'prod' environment"
  exit 1
fi

echo "===================================="
echo "CloudFormation Deployment"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "===================================="
echo ""

# ----------------------------------------------------------------------------
# Step 1: Change Set作成
# ----------------------------------------------------------------------------
echo "Step 1/3: Creating Change Set..."
./scripts/create-changeset.sh ${ENVIRONMENT}

echo ""
echo "Press Enter to continue to Change Set review..."
read

# ----------------------------------------------------------------------------
# Step 2: Change Set詳細表示
# ----------------------------------------------------------------------------
echo ""
echo "Step 2/3: Reviewing Change Set..."
./scripts/describe-changeset.sh ${ENVIRONMENT}

echo ""
echo "Press Enter to execute the Change Set..."
read

# ----------------------------------------------------------------------------
# Step 3: Change Set実行
# ----------------------------------------------------------------------------
echo ""
echo "Step 3/3: Executing Change Set..."
./scripts/execute-changeset.sh ${ENVIRONMENT}

echo ""
echo "===================================="
echo "✅ Deployment completed"
echo "===================================="
