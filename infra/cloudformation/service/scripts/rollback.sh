#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Service Account Stack Rollback Script
# ==============================================================================
# Usage:
#   ./scripts/rollback.sh dev 01-network
# ==============================================================================

ENVIRONMENT=$1
STACK_TYPE=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$STACK_TYPE" ]; then
  echo "Usage: $0 <environment> <stack-type>"
  echo "  Example: $0 dev 01-network"
  exit 1
fi

PROJECT_NAME="facilities"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-${STACK_TYPE}"

echo "===================================="
echo "CloudFormation Rollback"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "Stack:       ${STACK_NAME}"
echo "===================================="
echo ""
echo "⚠️  WARNING: This will rollback the stack to the previous stable state."
echo ""

read -p "Are you sure you want to rollback? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "❌ Rollback cancelled"
  exit 0
fi

echo ""
echo "Rolling back stack..."
aws cloudformation rollback-stack --stack-name ${STACK_NAME}

echo "Waiting for rollback to complete..."
aws cloudformation wait stack-rollback-complete --stack-name ${STACK_NAME}

echo ""
echo "===================================="
echo "✅ Rollback completed"
echo "===================================="
echo "Stack:       ${STACK_NAME}"
echo "Status:      $(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --query 'Stacks[0].StackStatus' --output text)"
echo "===================================="
