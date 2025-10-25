#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Service Account - Deploy All Stacks
# ==============================================================================
# Usage:
#   ./scripts/deploy-all.sh dev
# ==============================================================================

ENVIRONMENT=$1

if [ -z "$ENVIRONMENT" ]; then
  echo "Usage: $0 <environment>"
  echo "  Example: $0 dev"
  exit 1
fi

echo "===================================="
echo "Deploying all stacks in order"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "===================================="
echo ""

# Deploy in dependency order
STACKS=(
  "01-network"
  "02-database"
  "03-compute"
  "04-auth"
  "05-storage"
  "06-monitoring"
)

for STACK in "${STACKS[@]}"; do
  echo ""
  echo "===================================="
  echo "Deploying: ${STACK}"
  echo "===================================="
  ./scripts/deploy.sh ${ENVIRONMENT} ${STACK}
done

echo ""
echo "===================================="
echo "✅ All stacks deployed successfully"
echo "===================================="
