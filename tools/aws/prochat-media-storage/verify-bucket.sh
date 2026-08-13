#!/usr/bin/env bash
set -uo pipefail

BUCKET="prochat-media-prod-909439522876-us-east-1"
EXPECTED_ACCOUNT="909439522876"
PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS: $label"
    ((PASS++))
  else
    echo "FAIL: $label"
    ((FAIL++))
  fi
}

echo "Verifying bucket: $BUCKET"
echo "---"

check "AWS account = $EXPECTED_ACCOUNT" \
  bash -c "rtk proxy aws sts get-caller-identity --query Account --output text | grep -qx $EXPECTED_ACCOUNT"

check "Bucket exists" \
  aws s3api head-bucket --bucket "$BUCKET"

check "All four public-access settings are true" \
  bash -c "rtk proxy aws s3api get-public-access-block --bucket $BUCKET --query 'join(\`,\`, [to_string(PublicAccessBlockConfiguration.BlockPublicAcls), to_string(PublicAccessBlockConfiguration.IgnorePublicAcls), to_string(PublicAccessBlockConfiguration.BlockPublicPolicy), to_string(PublicAccessBlockConfiguration.RestrictPublicBuckets)])' --output text | grep -qx 'true,true,true,true'"

check "Ownership = BucketOwnerEnforced" \
  bash -c "rtk proxy aws s3api get-bucket-ownership-controls --bucket $BUCKET --query 'OwnershipControls.Rules[0].ObjectOwnership' --output text | grep -qx BucketOwnerEnforced"

check "Encryption = AES256" \
  bash -c "rtk proxy aws s3api get-bucket-encryption --bucket $BUCKET --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' --output text | grep -qx AES256"

check "BucketKeyEnabled = false" \
  bash -c "rtk proxy aws s3api get-bucket-encryption --bucket $BUCKET --query 'ServerSideEncryptionConfiguration.Rules[0].BucketKeyEnabled' --output text | grep -qxi false"

check "Lifecycle: temp/ expires in 7 days" \
  bash -c "rtk proxy aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET --query 'Rules[?ID==\`expire-temp-7d\`].Expiration.Days' --output text | grep -qx 7"

check "Lifecycle: abort multipart after 1 day" \
  bash -c "rtk proxy aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET --query 'Rules[?ID==\`abort-incomplete-multipart-1d\`].AbortIncompleteMultipartUpload.DaysAfterInitiation' --output text | grep -qx 1"

check "Versioning not enabled" \
  bash -c "rtk proxy aws s3api get-bucket-versioning --bucket $BUCKET --output text | grep -qvE 'Enabled|Suspended' || [ -z \"\$(rtk proxy aws s3api get-bucket-versioning --bucket $BUCKET --output text)\" ]"

check "Bucket policy exists (HTTPS-only deny)" \
  bash -c "rtk proxy aws s3api get-bucket-policy --bucket $BUCKET --query Policy --output text | grep -q DenyInsecureTransport"

check "Bucket policy contains no Allow" \
  bash -c "! rtk proxy aws s3api get-bucket-policy --bucket $BUCKET --query Policy --output text | grep -q '\"Effect\":\"Allow\"'"

echo "---"
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
