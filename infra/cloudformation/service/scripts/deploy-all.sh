#!/bin/bash
set -euo pipefail

# ==============================================================================
# 全スタックデプロイ（依存関係順）
# ==============================================================================
# 使い方:
#   ./scripts/deploy-all.sh dev
# ==============================================================================

ENVIRONMENT=${1:-}

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  echo "  environment: dev, stg, prod"
  exit 1
fi

echo "===================================="
echo "全スタックデプロイ"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "===================================="
echo ""

# 本番環境のみ承認プロンプト
if [ "$ENVIRONMENT" = "prod" ]; then
  echo "⚠️  本番環境へのデプロイです"
  echo ""
  echo "以下のスタックを順番にデプロイします:"
  echo "  1. network"
  echo "  2. database"
  echo "  3. auth"
  echo "  4. compute"
  echo "  5. frontend"
  echo "  6. monitoring"
  echo "  7. batch"
  echo ""
  read -p "本当に実行しますか？ (yes/no): " CONFIRMATION

  if [ "${CONFIRMATION}" != "yes" ]; then
    echo "デプロイをキャンセルしました"
    exit 0
  fi
fi

# 1. Network Stack（他のスタックが依存）
echo ""
echo "===================================="
echo "[1/7] Network Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" network

# 2. Database Stack（Network Stackに依存）
echo ""
echo "===================================="
echo "[2/7] Database Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" database

# 3. Auth Stack（Network Stackに依存）
echo ""
echo "===================================="
echo "[3/7] Auth Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" auth

# 4. Compute Stack（Network, Database, Auth Stackに依存）
echo ""
echo "===================================="
echo "[4/7] Compute Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" compute

# 5. Frontend Stack（Network Stackに依存）
echo ""
echo "===================================="
echo "[5/7] Frontend Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" frontend

# 6. Monitoring Stack（Compute Stackに依存）
echo ""
echo "===================================="
echo "[6/7] Monitoring Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" monitoring

# 7. Batch Stack（Compute Stackに依存）
echo ""
echo "===================================="
echo "[7/7] Batch Stack デプロイ中..."
echo "===================================="
./scripts/deploy.sh "${ENVIRONMENT}" batch

echo ""
echo "===================================="
echo "✅ 全スタックデプロイ完了"
echo "===================================="
echo ""
echo "デプロイされたスタック:"
echo "  - facility-${ENVIRONMENT}-network"
echo "  - facility-${ENVIRONMENT}-database"
echo "  - facility-${ENVIRONMENT}-auth"
echo "  - facility-${ENVIRONMENT}-compute"
echo "  - facility-${ENVIRONMENT}-frontend"
echo "  - facility-${ENVIRONMENT}-monitoring"
echo "  - facility-${ENVIRONMENT}-batch"
echo ""
