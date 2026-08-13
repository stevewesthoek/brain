#!/usr/bin/env bash
set -euo pipefail

BUCKET="prochat-media-prod-909439522876-us-east-1"
REGION="us-east-1"
EXPECTED_ACCOUNT="909439522876"

ACTUAL_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [ "$ACTUAL_ACCOUNT" != "$EXPECTED_ACCOUNT" ]; then
  echo "Refusing to provision from AWS account $ACTUAL_ACCOUNT; expected $EXPECTED_ACCOUNT." >&2
  exit 1
fi

echo "Provisioning bucket: $BUCKET in $REGION"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket already exists. Applying configuration."
else
  echo "Creating bucket."
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION"
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-ownership-controls \
  --bucket "$BUCKET" \
  --ownership-controls 'Rules=[{ObjectOwnership=BucketOwnerEnforced}]'

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"},
      "BucketKeyEnabled": false
    }]
  }'

aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "DenyInsecureTransport",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::'"$BUCKET"'",
        "arn:aws:s3:::'"$BUCKET"'/*"
      ],
      "Condition": {"Bool": {"aws:SecureTransport": "false"}}
    }]
  }'

aws s3api put-bucket-lifecycle-configuration \
  --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "expire-temp-7d",
        "Filter": {"Prefix": "temp/"},
        "Status": "Enabled",
        "Expiration": {"Days": 7}
      },
      {
        "ID": "abort-incomplete-multipart-1d",
        "Filter": {"Prefix": ""},
        "Status": "Enabled",
        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1}
      }
    ]
  }'

echo "Done. Bucket $BUCKET is ready."
