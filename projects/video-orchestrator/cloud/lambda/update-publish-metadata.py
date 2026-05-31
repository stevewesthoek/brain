"""
Update Publish Metadata Lambda
Writes canonical publish.json with YouTube video metadata.
Supports partial updates and recovery scenarios.

Input (Video Upload Success):
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0",
  "videoUrl": "https://www.youtube.com/watch?v=R2rq58QmfV0",
  "publishedAt": "2026-05-31T17:52:51Z"
}

Input (Thumbnail Success):
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0",
  "thumbnailUrl": "https://i.ytimg.com/vi/R2rq58QmfV0/default.jpg"
}

Input (Failure Recovery):
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0",
  "error": "Thumbnail upload failed: ...",
  "status": "thumbnail_failed"
}

Output:
{
  "ok": true,
  "videoId": "R2rq58QmfV0",
  "status": "uploaded"
}
"""

import json
import os
import time
import boto3
from botocore.exceptions import ClientError

# AWS clients
s3_client = boto3.client('s3', region_name='eu-north-1')

# Configuration
BUCKET = os.environ.get('BUCKET', 'prochat-video-dev-909439522876-eu-north-1-an')


def read_publish_json(bucket, job_id):
    """Read current publish.json from S3."""
    try:
        response = s3_client.get_object(
            Bucket=bucket,
            Key=f'jobs/{job_id}/metadata/publish.json'
        )
        return json.loads(response['Body'].read().decode('utf-8'))
    except ClientError as e:
        raise Exception(f"Failed to read publish.json: {str(e)}")


def read_channel_config(bucket, channel_id):
    """Read channel configuration from S3."""
    try:
        response = s3_client.get_object(
            Bucket=bucket,
            Key=f'channels/{channel_id}/channel.json'
        )
        return json.loads(response['Body'].read().decode('utf-8'))
    except ClientError as e:
        raise Exception(f"Failed to read channel config {channel_id}: {str(e)}")


def write_publish_json(bucket, job_id, publish_json):
    """Write publish.json to S3."""
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=f'jobs/{job_id}/metadata/publish.json',
            Body=json.dumps(publish_json, indent=2),
            ContentType='application/json'
        )
        return True
    except ClientError as e:
        raise Exception(f"Failed to write publish.json: {str(e)}")


def handler(event, context):
    """
    Lambda handler for updating publish metadata.
    Canonically updates publish.json with YouTube video and platform info.

    Input: Various metadata update payloads
    Output:
      {
        "ok": true,
        "videoId": "R2rq58QmfV0",
        "status": "uploaded"
      }
    """
    try:
        job_id = event.get('jobId')
        video_id = event.get('videoId')
        video_url = event.get('videoUrl')
        thumbnail_url = event.get('thumbnailUrl')
        published_at = event.get('publishedAt')
        error_message = event.get('error')
        status = event.get('status', 'uploaded')

        if not job_id:
            raise Exception("jobId required")

        print(f"Updating metadata for job: {job_id}")

        # Read current publish.json
        publish_json = read_publish_json(BUCKET, job_id)

        # Read channel config for context logging
        channel_id = publish_json.get('channelId', 'says-the-bible')
        try:
            channel_config = read_channel_config(BUCKET, channel_id)
            display_name = channel_config.get('displayName', channel_id)
            print(f"Channel: {display_name} ({channel_id})")
        except Exception as e:
            print(f"Warning: Could not load channel config: {str(e)}")
            display_name = channel_id

        # Initialize platforms.youtube if not present
        if 'platforms' not in publish_json:
            publish_json['platforms'] = {}
        if 'youtube' not in publish_json['platforms']:
            publish_json['platforms']['youtube'] = {}

        yt_platform = publish_json['platforms']['youtube']

        # Update with provided fields
        if video_id:
            yt_platform['videoId'] = video_id
            if not video_url:
                video_url = f'https://www.youtube.com/watch?v={video_id}'

        if video_url:
            yt_platform['url'] = video_url

        if thumbnail_url:
            yt_platform['thumbnailUrl'] = thumbnail_url

        if published_at:
            yt_platform['publishedAt'] = published_at

        # Set status
        if status:
            yt_platform['status'] = status

        # Handle error
        if error_message:
            yt_platform['error'] = error_message
        else:
            # Clear error on success
            if 'error' in yt_platform and status == 'uploaded':
                yt_platform['error'] = None

        # Update top-level metadata
        now = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        publish_json['updatedAt'] = now

        # Only set publishStatus to 'uploaded' when fully successful
        if status == 'uploaded' and video_id and not error_message:
            publish_json['publishStatus'] = 'uploaded'
            if not published_at:
                yt_platform['publishedAt'] = now

        print(f"Updated YouTube platform: {json.dumps(yt_platform, default=str)}")

        # Write updated publish.json
        write_publish_json(BUCKET, job_id, publish_json)

        return {
            'ok': True,
            'videoId': video_id,
            'status': yt_platform.get('status', 'uploaded')
        }

    except Exception as e:
        error_msg = str(e)
        print(f"Error: {error_msg}")
        return {
            'ok': False,
            'error': error_msg
        }
