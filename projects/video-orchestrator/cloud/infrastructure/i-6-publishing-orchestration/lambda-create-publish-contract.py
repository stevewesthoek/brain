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


def normalize_s3_key(value, bucket):
    """
    Normalize S3 reference to object key (without bucket or s3://).
    Handles:
    - Full S3 URI: s3://bucket/jobs/id/...  -> jobs/id/...
    - Partial URI: /jobs/id/...             -> jobs/id/...
    - Object key: jobs/id/...               -> jobs/id/...
    """
    if not value:
        return None
    value = value.strip()
    # Remove s3://bucket/ prefix if present
    if value.startswith(f's3://{bucket}/'):
        value = value[len(f's3://{bucket}/'):]
    elif value.startswith('s3://'):
        # Different bucket or format - extract after bucket name
        parts = value.replace('s3://', '').split('/', 1)
        if len(parts) == 2:
            value = parts[1]
    # Remove leading slash
    if value.startswith('/'):
        value = value[1:]
    return value if value else None


def lambda_handler(event, context):
    """
    Create canonical publish.json after video generation is complete.

    Expected input:
    {
      "jobId": "prochat-os-001",
      "finalVideoUri": "s3://bucket/jobs/.../exports/generated-001-final.mp4" (optional, from VerifyOutput),
      "thumbnailKey": "jobs/.../exports/thumbnail-001.jpg" (optional, from SelectThumbnailFrame)
    }

    Reads: metadata/status.json and metadata/assets.json
    Validates: status == complete, required assets exist
    Writes: metadata/publish.json with generation metadata preserved
    """
    print(f'[CreatePublishContract] Starting for event: {event}')

    job_id = event.get('jobId')
    if not job_id:
        raise ValueError('jobId is required')

    final_video_uri = event.get('finalVideoUri')
    thumbnail_key_param = event.get('thumbnailKey')

    # Initialize metadata containers (will be populated from assets.json/status.json)
    metadata = {}
    assets_data_full = {}

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

        # Extract generation metadata from status.json for preservation
        if 'mediaSource' in status_data:
            metadata['mediaSource'] = status_data['mediaSource']
        if 'generationMode' in status_data:
            metadata['generationMode'] = status_data['generationMode']
        if 'aiGenerated' in status_data:
            metadata['aiGenerated'] = status_data['aiGenerated']

        # Priority 1: Use parameters passed from Step Functions (fast path)
        video_key = None
        thumbnail_key = None

        if final_video_uri:
            video_key = normalize_s3_key(final_video_uri, BUCKET)
            print(f'[CreatePublishContract] Using video from finalVideoUri parameter: {video_key}')

        if thumbnail_key_param:
            thumbnail_key = normalize_s3_key(thumbnail_key_param, BUCKET)
            print(f'[CreatePublishContract] Using thumbnail from thumbnailKey parameter: {thumbnail_key}')

        # Priority 2: Read assets.json to get video and thumbnail references if not yet resolved
        if not video_key or not thumbnail_key:
            print(f'[CreatePublishContract] Reading assets.json for {job_id}')
            assets = {}
            try:
                assets_response = s3_client.get_object(
                    Bucket=BUCKET,
                    Key=f'jobs/{job_id}/metadata/assets.json'
                )
                assets_data_full = json.loads(assets_response['Body'].read().decode('utf-8'))
                assets = assets_data_full.get('assets', {})

                if not video_key and 'finalVideo' in assets:
                    video_key = assets['finalVideo'].get('path')
                    print(f'[CreatePublishContract] Got video from assets.json: {video_key}')

                if not thumbnail_key and 'thumbnail' in assets:
                    thumbnail_key = assets['thumbnail'].get('path')
                    print(f'[CreatePublishContract] Got thumbnail from assets.json: {thumbnail_key}')

                # Preserve generation metadata from assets.json (overrides status.json)
                metadata_fields = [
                    'mediaSource', 'generationMode', 'aiGenerated',
                    'scenePlanKey', 'narrationScriptKey', 'videoSourceKey',
                    'audioSourceKey', 'providers', 'warnings'
                ]
                for field in metadata_fields:
                    if field in assets_data_full:
                        metadata[field] = assets_data_full[field]
                        print(f'[CreatePublishContract] Preserved from assets.json: {field}')

            except s3_client.exceptions.NoSuchKey:
                print(f'[CreatePublishContract] assets.json missing')

        # Priority 3: Infer from S3 exports directory (fallback)
        if not video_key or not thumbnail_key:
            print(f'[CreatePublishContract] Inferring assets from S3 exports directory')
            exports_prefix = f'jobs/{job_id}/exports/'
            try:
                listed = s3_client.list_objects_v2(Bucket=BUCKET, Prefix=exports_prefix, MaxKeys=1000)
                objects = listed.get('Contents', [])

                if not video_key:
                    video_candidates = [obj for obj in objects if obj['Key'].endswith('.mp4') and '-dummy' not in obj['Key']]
                    if video_candidates:
                        video_candidates.sort(key=lambda obj: obj['LastModified'], reverse=True)
                        video_key = video_candidates[0]['Key']
                        print(f'[CreatePublishContract] Inferred video from S3 listing: {video_key}')

                if not thumbnail_key:
                    thumbnail_candidates = [obj for obj in objects if obj['Key'].endswith('thumbnail-001.jpg') or obj['Key'].endswith('.jpg')]
                    if thumbnail_candidates:
                        thumbnail_candidates.sort(key=lambda obj: obj['LastModified'], reverse=True)
                        thumbnail_key = thumbnail_candidates[0]['Key']
                        print(f'[CreatePublishContract] Inferred thumbnail from S3 listing: {thumbnail_key}')
            except Exception as e:
                print(f'[CreatePublishContract] Warning: S3 listing failed: {str(e)}')

        # Priority 4: Use canonical standard paths
        if not video_key:
            video_key = f'jobs/{job_id}/exports/generated-001-final.mp4'
            print(f'[CreatePublishContract] Using canonical video path: {video_key}')

        if not thumbnail_key:
            thumbnail_key = f'jobs/{job_id}/exports/thumbnail-001.jpg'
            print(f'[CreatePublishContract] Using canonical thumbnail path: {thumbnail_key}')

        # Validate resolved assets
        if not video_key or not thumbnail_key:
            raise ValueError('Could not resolve video and thumbnail keys')

        if video_key.startswith('REPLACE_') or thumbnail_key.startswith('REPLACE_'):
            raise ValueError('Invalid asset paths (placeholder values)')

        print(f'[CreatePublishContract] Resolved assets: video={video_key}, thumbnail={thumbnail_key}')

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

        # Merge preserved generation metadata into publish_contract
        publish_contract.update(metadata)

        # Log which metadata fields are included
        if metadata:
            print(f'[CreatePublishContract] Preserved metadata fields: {list(metadata.keys())}')
        else:
            print(f'[CreatePublishContract] No generation metadata found; using fixture defaults')

        # Write publish.json to S3
        publish_key = f'jobs/{job_id}/metadata/publish.json'
        print(f'[CreatePublishContract] Writing publish.json to {publish_key}')
        s3_client.put_object(
            Bucket=BUCKET,
            Key=publish_key,
            Body=json.dumps(publish_contract, indent=2),
            ContentType='application/json'
        )
        print(f'[CreatePublishContract] ✓ publish.json written to {publish_key}')

        result = {
            'jobId': job_id,
            'publishContractCreated': True,
            'videoKey': video_key,
            'thumbnailKey': thumbnail_key,
            'publishStatus': 'pending',
            'metadataPreserved': len(metadata) > 0
        }
        print(f'[CreatePublishContract] Success: {result}')
        return result

    except Exception as e:
        error_msg = f'Failed to create publish contract: {str(e)}'
        print(f'[CreatePublishContract] ERROR: {error_msg}')
        raise Exception(error_msg)
