#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Template Validation
# ==============================================================================
# 使い方:
#   ./scripts/validate.sh
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(dirname "$SCRIPT_DIR")"

echo "==================================="
echo "CloudFormation Template Validation"
echo "==================================="
echo ""

# マスタースタック検証
echo "Validating: stack.yaml"
aws cloudformation validate-template \
  --template-body file://"${BASE_DIR}/stack.yaml" \
  > /dev/null
echo "✅ stack.yaml"
echo ""

# Nested スタック検証
TEMPLATES=$(find "${BASE_DIR}/nested" -name "*.yaml" 2>/dev/null || true)

if [ -z "$TEMPLATES" ]; then
  echo "No nested templates found"
else
  for TEMPLATE in $TEMPLATES; do
    TEMPLATE_NAME=$(basename "$TEMPLATE")
    echo "Validating: nested/${TEMPLATE_NAME}"
    aws cloudformation validate-template \
      --template-body file://"${TEMPLATE}" \
      > /dev/null
    echo "✅ nested/${TEMPLATE_NAME}"
  done
fi

echo ""
echo "==================================="
echo "✅ All templates are valid"
echo "==================================="
