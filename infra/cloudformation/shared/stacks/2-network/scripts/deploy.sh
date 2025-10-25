#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation デプロイ（オーケストレーション）
# ==============================================================================
# 使い方:
#   ./scripts/deploy.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

echo "==================================="
echo "CloudFormation デプロイ"
echo "==================================="
echo "Stack: facilities-shared-network"
echo "==================================="
echo ""

# 1. テンプレート検証
echo "Step 1/4: Validating templates..."
"${SCRIPT_DIR}/validate.sh"
echo ""

# 2. Change Set 作成
echo "Step 2/4: Creating Change Set..."
"${SCRIPT_DIR}/create-changeset.sh"
echo ""

# 3. Change Set 詳細表示
echo "Step 3/4: Reviewing Change Set..."
"${SCRIPT_DIR}/describe-changeset.sh"
echo ""

# 4. Change Set 実行
echo "Step 4/4: Executing Change Set..."
"${SCRIPT_DIR}/execute-changeset.sh"
echo ""

echo "==================================="
echo "✅ Deployment completed successfully"
echo "==================================="
