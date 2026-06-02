"""
Lambda: Create Publishing Contract
Reads completed generation metadata and creates the publishing contract (publish.json).
Bridges generation pipeline to publishing pipeline.
"""
import json
import boto3
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an'


def lambda_handler(event, context):
    """
    Create canonical publish.json after video generation is complete.

    Expected input:
    {
      "jobId": "prochat-os-001"
    }

    Reads: metadata/status.json and metadata/assets.json
    Validates: status == complete, required assets exist
    Writes: metadata/publish.json
    """
    print(f'[CreatePublishContract] Starting for jobId: {event}')

    job_id = event.get('jobId')
    if not job_id:
        raise ValueError('jobId is required')

    try:
        # Read status.json to verify generation is complete
        print(f'[CreatePublishContract] Reading status.json for {job_id}')
        status_response = s3_client.get_object(
            Bucket=BUCKET,
            Key=f'jobs/{job_id}/metadata/status.json'
        )
        status_data = json.loads(status_response['Body'].read().decode('utf-8'))

        status = status_data.get('status')
        if status != 'complete':
            raise ValueError(f'Generation not complete: status={status}')

        print(f'[CreatePublishContract] Generation complete, status={status}')

        # Read assets.json to get video and thumbnail references.
        # If it is missing, infer the canonical assets from the generated exports.
        print(f'[CreatePublishContract] Reading assets.json for {job_id}')
        assets = {}
        try:
            assets_response = s3_client.get_object(
                Bucket=BUCKET,
                Key=f'jobs/{job_id}/metadata/assets.json'
            )
            assets_data = json.loads(assets_response['Body'].read().decode('utf-8'))
            assets = assets_data.get('assets', {})
        except s3_client.exceptions.NoSuchKey:
            print(f'[CreatePublishContract] assets.json missing; inferring from exports')
            exports_prefix = f'jobs/{job_id}/exports/'
            listed = s3_client.list_objects_v2(Bucket=BUCKET, Prefix=exports_prefix, MaxKeys=1000)
            objects = listed.get('Contents', [])
            video_candidates = [obj for obj in objects if obj['Key'].endswith('.mp4') and '-dummy' not in obj['Key']]
            thumbnail_candidates = [obj for obj in objects if obj['Key'].endswith('thumbnail-001.jpg') or obj['Key'].endswith('.jpg')]
            if video_candidates:
                video_candidates.sort(key=lambda obj: obj['LastModified'], reverse=True)
                assets['finalVideo'] = {'path': video_candidates[0]['Key']}
            if thumbnail_candidates:
                thumbnail_candidates.sort(key=lambda obj: obj['LastModified'], reverse=True)
                assets['thumbnail'] = {'path': thumbnail_candidates[0]['Key']}

        # Validate required assets
        if 'finalVideo' not in assets:
            raise ValueError('Required asset missing: finalVideo')
        if 'thumbnail' not in assets:
            raise ValueError('Required asset missing: thumbnail')

        final_video = assets['finalVideo']
        thumbnail = assets['thumbnail']

        video_key = final_video.get('path')
        thumbnail_key = thumbnail.get('path')

        if not video_key or not thumbnail_key or video_key.startswith('REPLACE_') or thumbnail_key.startswith('REPLACE_'):
            raise ValueError('Invalid asset paths')

        print(f'[CreatePublishContract] Found assets: video={video_key}, thumbnail={thumbnail_key}')

        # Verify assets exist in S3
        print(f'[CreatePublishContract] Verifying assets exist in S3')
        try:
            s3_client.head_object(Bucket=BUCKET, Key=video_key)
            print(f'[CreatePublishContract] ✓ Video exists')
        except Exception as e:
            raise ValueError(f'Video asset not found: {video_key}')

        try:
            s3_client.head_object(Bucket=BUCKET, Key=thumbnail_key)
            print(f'[CreatePublishContract] ✓ Thumbnail exists')
        except Exception as e:
            raise ValueError(f'Thumbnail asset not found: {thumbnail_key}')

        # Create publish.json contract
        now = datetime.utcnow().isoformat() + 'Z'
        publish_contract = {
            'jobId': job_id,
            'publishStatus': 'pending',
            'createdAt': now,
            'updatedAt': now,
            'publishedAt': None,
            'title': '',
            'description': '',
            'tags': [],
            'videoKey': video_key,
            'thumbnailKey': thumbnail_key,
            'platforms': {
                'youtube': {
                    'status': 'pending',
                    'videoId': None,
                    'publishedAt': None,
                    'url': None,
                    'error': None
                }
            }
        }

        # Write publish.json to S3
        publish_key = f'jobs/{job_id}/metadata/publish.json'
        print(f'[CreatePublishContract] Writing publish.json to {publish_key}')
        s3_client.put_object(
            Bucket=BUCKET,
            Key=publish_key,
            Body=json.dumps(publish_contract, indent=2),
            ContentType='application/json'
        )
        print(f'[CreatePublishContract] ✓ publish.json written')

        result = {
            'jobId': job_id,
            'publishContractCreated': True,
            'videoKey': video_key,
            'thumbnailKey': thumbnail_key,
            'publishStatus': 'pending'
        }
        print(f'[CreatePublishContract] Success: {result}')
        return result

    except Exception as e:
        error_msg = f'Failed to create publish contract: {str(e)}'
        print(f'[CreatePublishContract] ERROR: {error_msg}')
        raise Exception(error_msg)
