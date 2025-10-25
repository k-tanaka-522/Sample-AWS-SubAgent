#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Template Validation
# ==============================================================================
# 使い方:
#   ./scripts/validate.sh
# ==============================================================================

echo "===================================="
echo "Validating CloudFormation templates"
echo "===================================="
echo ""

TEMPLATES_FOUND=0
TEMPLATES_VALID=0
TEMPLATES_INVALID=0

# ----------------------------------------------------------------------------
# 親スタック検証
# ----------------------------------------------------------------------------
echo "Validating parent stack..."
if aws cloudformation validate-template \
  --template-body file://stack.yaml \
  > /dev/null 2>&1; then
  echo "✅ stack.yaml"
  TEMPLATES_VALID=$((TEMPLATES_VALID + 1))
else
  echo "❌ stack.yaml"
  TEMPLATES_INVALID=$((TEMPLATES_INVALID + 1))
fi
TEMPLATES_FOUND=$((TEMPLATES_FOUND + 1))

# ----------------------------------------------------------------------------
# ネステッドスタック検証
# ----------------------------------------------------------------------------
echo ""
echo "Validating nested templates..."

# nested/配下のすべての.yamlファイルを検証
for TEMPLATE in $(find nested -name "*.yaml"); do
  if aws cloudformation validate-template \
    --template-body file://${TEMPLATE} \
    > /dev/null 2>&1; then
    echo "✅ ${TEMPLATE}"
    TEMPLATES_VALID=$((TEMPLATES_VALID + 1))
  else
    echo "❌ ${TEMPLATE}"
    TEMPLATES_INVALID=$((TEMPLATES_INVALID + 1))
  fi
  TEMPLATES_FOUND=$((TEMPLATES_FOUND + 1))
done

# ----------------------------------------------------------------------------
# 結果サマリー
# ----------------------------------------------------------------------------
echo ""
echo "===================================="
echo "Validation Summary"
echo "===================================="
echo "Total templates: ${TEMPLATES_FOUND}"
echo "Valid:           ${TEMPLATES_VALID}"
echo "Invalid:         ${TEMPLATES_INVALID}"
echo "===================================="
echo ""

if [ ${TEMPLATES_INVALID} -gt 0 ]; then
  echo "❌ Some templates have validation errors"
  exit 1
else
  echo "✅ All templates are valid"
  exit 0
fi
