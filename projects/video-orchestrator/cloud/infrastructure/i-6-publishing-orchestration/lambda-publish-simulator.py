"""
Lambda: Publishing Simulator
Proof-of-concept publishing layer (no external APIs).
Demonstrates publishing workflow without YouTube integration.
"""
import json
import boto3
from datetime import datetime

s3_client = boto3.client('s3')

BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an'


def lambda_handler(event, context):
    """
    Simulate publishing workflow for proof-of-concept.

    Expected input:
    {
      "jobId": "prochat-os-001"
    }

    Reads: metadata/publish.json
    Verifies: video and thumbnail exist
    Writes: metadata/published.json
    Updates: metadata/publish.json with publishStatus=published
    """
    print(f'[PublishSimulator] Starting for jobId: {event}')

    job_id = event.get('jobId')
    if not job_id:
        raise ValueError('jobId is required')

    try:
        # Read publish.json to get video and thumbnail references
        print(f'[PublishSimulator] Reading publish.json for {job_id}')
        publish_response = s3_client.get_object(
            Bucket=BUCKET,
            Key=f'jobs/{job_id}/metadata/publish.json'
        )
        publish_data = json.loads(publish_response['Body'].read().decode('utf-8'))

        video_key = publish_data.get('videoKey')
        thumbnail_key = publish_data.get('thumbnailKey')

        if not video_key or not thumbnail_key:
            raise ValueError('Missing videoKey or thumbnailKey in publish.json')

        print(f'[PublishSimulator] Video: {video_key}, Thumbnail: {thumbnail_key}')

        # Verify video exists
        print(f'[PublishSimulator] Verifying video exists')
        try:
            video_head = s3_client.head_object(Bucket=BUCKET, Key=video_key)
            video_size = video_head.get('ContentLength', 0)
            print(f'[PublishSimulator] ✓ Video exists ({video_size} bytes)')
        except Exception as e:
            raise ValueError(f'Video not found: {video_key}')

        # Verify thumbnail exists
        print(f'[PublishSimulator] Verifying thumbnail exists')
        try:
            thumbnail_head = s3_client.head_object(Bucket=BUCKET, Key=thumbnail_key)
            thumbnail_size = thumbnail_head.get('ContentLength', 0)
            print(f'[PublishSimulator] ✓ Thumbnail exists ({thumbnail_size} bytes)')
        except Exception as e:
            raise ValueError(f'Thumbnail not found: {thumbnail_key}')

        # Create published.json record
        now = datetime.utcnow().isoformat() + 'Z'
        published_record = {
            'jobId': job_id,
            'status': 'published',
            'platform': 'simulator',
            'publishedAt': now,
            'videoKey': video_key,
            'thumbnailKey': thumbnail_key,
            'videoSize': video_size,
            'thumbnailSize': thumbnail_size
        }

        # Write published.json
        published_key = f'jobs/{job_id}/metadata/published.json'
        print(f'[PublishSimulator] Writing published.json to {published_key}')
        s3_client.put_object(
            Bucket=BUCKET,
            Key=published_key,
            Body=json.dumps(published_record, indent=2),
            ContentType='application/json'
        )
        print(f'[PublishSimulator] ✓ published.json written')

        # Update publish.json with published status
        print(f'[PublishSimulator] Updating publish.json status to published')
        publish_data['publishStatus'] = 'published'
        publish_data['publishedAt'] = now
        publish_data['platforms']['youtube']['status'] = 'pending'  # Would be populated by real YouTube integration
        publish_data['updatedAt'] = now

        publish_key = f'jobs/{job_id}/metadata/publish.json'
        s3_client.put_object(
            Bucket=BUCKET,
            Key=publish_key,
            Body=json.dumps(publish_data, indent=2),
            ContentType='application/json'
        )
        print(f'[PublishSimulator] ✓ publish.json updated')

        result = {
            'jobId': job_id,
            'publishStatus': 'published',
            'platform': 'simulator',
            'publishedAt': now,
            'videoSize': video_size,
            'thumbnailSize': thumbnail_size
        }
        print(f'[PublishSimulator] Success: {result}')
        return result

    except Exception as e:
        error_msg = f'Publishing simulation failed: {str(e)}'
        print(f'[PublishSimulator] ERROR: {error_msg}')
        raise Exception(error_msg)
