"""
Lambda: Verify Output
Verifies that the final output file exists and is accessible.
"""
import json
import boto3

s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Verify output file exists and is accessible.
    Primary: Use actualOutputKey from wait-mediaconvert if available.
    Secondary: Use expectedOutputKey from mediaconvert Lambda.
    Tertiary: List S3 and find newest *-final.mp4 in exports directory.

    Expected input (from Step Functions):
    {
      "jobId": "test-001",
      "outputPath": "s3://bucket/path/dir/",
      "expectedOutputKey": "s3://bucket/path/dir/generated-001-final.mp4",  (optional, from mediaconvert)
      "actualOutputKey": "s3://bucket/path/dir/generated-001-final.mp4"     (optional, from wait-mediaconvert)
    }
    """
    job_id = event.get('jobId')
    output_dir = event.get('outputPath')
    actual_output_key = event.get('actualOutputKey')
    expected_output_key = event.get('expectedOutputKey')
    mediaconvert_job_id = event.get('mediaConvertJobId')

    if not job_id or not output_dir:
        raise ValueError('jobId and outputPath are required')

    # Neither actualOutputKey nor expectedOutputKey can be empty if both are provided
    # But one or both can be None/missing, and we fall back to S3 list
    if not actual_output_key and not expected_output_key:
        # Both missing is OK - will use S3 list fallback
        pass

    try:
        # Parse S3 destination directory
        # Format: s3://bucket/path/to/dir/
        dest_str = output_dir.replace('s3://', '')
        parts = dest_str.split('/', 1)
        if len(parts) != 2:
            raise ValueError(f'Invalid S3 path format: {output_dir}')

        bucket = parts[0]
        dest_prefix = parts[1].rstrip('/')

        # Determine which output file to verify
        source_key = None

        # Priority 1: Use actualOutputKey from wait-mediaconvert (most reliable)
        if actual_output_key:
            source_key = actual_output_key.replace(f's3://{bucket}/', '')
        # Priority 2: Use expectedOutputKey from mediaconvert Lambda
        elif expected_output_key:
            source_key = expected_output_key.replace(f's3://{bucket}/', '')
        # Priority 3: Check multiple possible output names
        else:
            possible_outputs = [
                f'{dest_prefix}/generated-001-final.mp4',
                f'{dest_prefix}/sample-transcoded-final.mp4'
            ]

            for candidate_key in possible_outputs:
                try:
                    s3_client.head_object(Bucket=bucket, Key=candidate_key)
                    source_key = candidate_key
                    break
                except s3_client.exceptions.NoSuchKey:
                    pass

        # Priority 4: List S3 and find newest *-final.mp4 in exports directory
        if not source_key:
            try:
                response = s3_client.list_objects_v2(
                    Bucket=bucket,
                    Prefix=dest_prefix,
                    MaxKeys=1000
                )

                if 'Contents' in response:
                    # Find all *-final.mp4 files, sort by LastModified (newest first)
                    final_files = [
                        obj for obj in response['Contents']
                        if obj['Key'].endswith('-final.mp4')
                    ]
                    if final_files:
                        # Sort by LastModified descending, take newest
                        final_files.sort(key=lambda x: x['LastModified'], reverse=True)
                        source_key = final_files[0]['Key']
            except Exception as list_err:
                pass

        if not source_key:
            raise Exception(
                f'MediaConvert output not found. Checked: actualOutputKey={actual_output_key}, '
                f'expectedOutputKey={expected_output_key}, prefix={dest_prefix}'
            )

        # Verify source output exists and is not empty
        try:
            response = s3_client.head_object(Bucket=bucket, Key=source_key)
            file_size = response['ContentLength']

            if file_size == 0:
                raise Exception(f'Output file is empty: s3://{bucket}/{source_key}')

            return {
                'jobId': job_id,
                'mediaConvertJobId': mediaconvert_job_id,
                'mediaconvertOutput': f's3://{bucket}/{source_key}',
                'exists': True,
                'fileSize': file_size,
                'lastModified': response['LastModified'].isoformat(),
                'contentType': response.get('ContentType', 'video/mp4'),
                'verified': True,
                'usedActualOutputKey': bool(actual_output_key),
                'usedExpectedOutputKey': bool(expected_output_key and not actual_output_key)
            }

        except s3_client.exceptions.NoSuchKey:
            raise Exception(f'MediaConvert output not found: s3://{bucket}/{source_key}')

    except Exception as e:
        raise Exception(f'Failed to verify output: {str(e)}')
