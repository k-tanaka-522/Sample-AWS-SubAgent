#!/bin/bash
set -euo pipefail

# ==============================================================================
# CloudFormation Service Account Stack Deploy Script
# ==============================================================================
# Usage:
#   ./scripts/deploy.sh dev 01-network
#   ./scripts/deploy.sh prod 02-database
# ==============================================================================

ENVIRONMENT=$1
STACK_TYPE=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$STACK_TYPE" ]; then
  echo "Usage: $0 <environment> <stack-type>"
  echo "  Example: $0 dev 01-network"
  echo ""
  echo "Available stacks:"
  echo "  01-network    - VPC, Subnets, NAT Gateway, Security Groups, Transit Gateway Attachment"
  echo "  02-database   - RDS PostgreSQL, DB Subnet Group, Parameter Group"
  echo "  03-compute    - ECS Cluster, Task Definitions, Services, ALB, Target Groups"
  echo "  04-auth       - Cognito User Pools (staff, vendor)"
  echo "  05-storage    - S3 (frontend, logs), CloudFront"
  echo "  06-monitoring - CloudWatch Alarms, SNS Topic"
  exit 1
fi

PROJECT_NAME="facilities"
STACK_NAME="${PROJECT_NAME}-${ENVIRONMENT}-${STACK_TYPE}"
TEMPLATE_FILE="${STACK_TYPE}/stack.yaml"
PARAMETERS_FILE="parameters/${ENVIRONMENT}.json"

echo "===================================="
echo "CloudFormation Deploy (Service Account)"
echo "===================================="
echo "Environment: ${ENVIRONMENT}"
echo "Stack:       ${STACK_NAME}"
echo "Template:    ${TEMPLATE_FILE}"
echo "Parameters:  ${PARAMETERS_FILE}"
echo "===================================="
echo ""

# 1. Validate template
echo "Step 1: Validating template..."
aws cloudformation validate-template \
  --template-body file://${TEMPLATE_FILE} \
  > /dev/null

echo "✅ Template is valid"
echo ""

# 2. Create Change Set
CHANGESET_NAME="${STACK_NAME}-$(date +%Y%m%d-%H%M%S)"
echo "Step 2: Creating Change Set: ${CHANGESET_NAME}"

CHANGESET_TYPE="UPDATE"
if ! aws cloudformation describe-stacks --stack-name ${STACK_NAME} &>/dev/null; then
  CHANGESET_TYPE="CREATE"
fi

aws cloudformation create-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGESET_NAME} \
  --template-body file://${TEMPLATE_FILE} \
  --parameters file://${PARAMETERS_FILE} \
  --capabilities CAPABILITY_NAMED_IAM \
  --change-set-type ${CHANGESET_TYPE} \
  --description "Deploy ${STACK_TYPE} for ${ENVIRONMENT} environment"

echo "Waiting for Change Set creation..."
aws cloudformation wait change-set-create-complete \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGESET_NAME}

echo "✅ Change Set created"
echo ""

# 3. Describe Change Set (dry-run)
echo "Step 3: Reviewing changes (dry-run)..."
echo "===================================="
aws cloudformation describe-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGESET_NAME} \
  --query 'Changes[*].[ResourceChange.Action,ResourceChange.LogicalResourceId,ResourceChange.ResourceType,ResourceChange.Replacement]' \
  --output table

echo ""
echo "===================================="
echo ""

# 4. Confirmation (production only)
if [ "$ENVIRONMENT" = "prod" ]; then
  read -p "Execute Change Set on PRODUCTION? (yes/no): " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    aws cloudformation delete-change-set \
      --stack-name ${STACK_NAME} \
      --change-set-name ${CHANGESET_NAME}
    exit 0
  fi
fi

# 5. Execute Change Set
echo "Step 4: Executing Change Set..."
aws cloudformation execute-change-set \
  --stack-name ${STACK_NAME} \
  --change-set-name ${CHANGESET_NAME}

echo "Waiting for stack operation to complete..."
if [ "$CHANGESET_TYPE" = "CREATE" ]; then
  aws cloudformation wait stack-create-complete --stack-name ${STACK_NAME}
else
  aws cloudformation wait stack-update-complete --stack-name ${STACK_NAME}
fi

echo ""
echo "===================================="
echo "✅ Deployment completed successfully"
echo "===================================="
echo "Stack:       ${STACK_NAME}"
echo "Status:      $(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --query 'Stacks[0].StackStatus' --output text)"
echo "===================================="
