"""
Lambda: Select and normalize frame 2 (3-second mark) as thumbnail (I-4.2)
Copies frame-0000002.jpg to normalized path: thumbnails/thumbnail-001.jpg
"""
import json
import boto3

s3_client = boto3.client('s3', region_name='eu-north-1')


def lambda_handler(event, context):
    """
    Copy the 3-second frame (index 2) to normalized thumbnail path.

    Expected input from Step Functions:
    {
      "jobId": "test-001",
      "bucket": "prochat-video-dev-909439522876-eu-north-1-an",
      "thumbnailOutputPrefix": "jobs/test-001/thumbnails/",
      "normalizedThumbnailKey": "jobs/test-001/thumbnails/thumbnail-001.jpg"
    }

    Output: Normalized thumbnail location and verification
    """
    job_id = event.get('jobId')
    bucket = event.get('bucket')
    thumbnail_output_prefix = event.get('thumbnailOutputPrefix')
    normalized_thumbnail_key = event.get('normalizedThumbnailKey')

    if not all([job_id, bucket, thumbnail_output_prefix, normalized_thumbnail_key]):
        raise ValueError('Missing required fields')

    print(f'Selecting frame 2 (3-second mark) as thumbnail for: {job_id}')

    try:
        # Find frame-0000002.jpg (3-second mark)
        response = s3_client.list_objects_v2(
            Bucket=bucket,
            Prefix=thumbnail_output_prefix,
            MaxKeys=10
        )

        frame_2_key = None
        if 'Contents' in response:
            for obj in response['Contents']:
                if '0000002.jpg' in obj['Key']:
                    frame_2_key = obj['Key']
                    break

        if not frame_2_key:
            raise ValueError('Frame index 2 (3-second mark) not found')

        print(f'  Found frame 2: {frame_2_key}')

        # Copy to normalized path
        copy_source = {
            'Bucket': bucket,
            'Key': frame_2_key
        }

        s3_client.copy_object(
            CopySource=copy_source,
            Bucket=bucket,
            Key=normalized_thumbnail_key,
            ContentType='image/jpeg',
            MetadataDirective='COPY'
        )

        print(f'  ✓ Copied to: {normalized_thumbnail_key}')

        # Verify normalized thumbnail exists
        response = s3_client.head_object(
            Bucket=bucket,
            Key=normalized_thumbnail_key
        )

        thumbnail_size = response['ContentLength']
        thumbnail_etag = response['ETag']

        print(f'  ✓ Verified: {thumbnail_size} bytes, ETag: {thumbnail_etag}')

        return {
            'jobId': job_id,
            'normalizedThumbnailKey': normalized_thumbnail_key,
            'size': thumbnail_size,
            'etag': thumbnail_etag,
            'frameTime': 3,
            'resolution': '1280x720',
            'selected': True
        }

    except Exception as e:
        error_message = f'Failed to select thumbnail: {str(e)}'
        print(f'✗ Error: {error_message}')
        raise Exception(error_message)
