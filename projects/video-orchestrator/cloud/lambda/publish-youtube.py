"""
YouTube Video Publisher Lambda
Uploads a generated video to YouTube and returns the videoId.
Supports idempotency - checks for existing videoId before uploading.

Input:
{
  "jobId": "prochat-os-030",
  "privacyStatus": "private"  (or "unlisted", default: "private")
}

Output:
{
  "ok": true,
  "videoId": "R2rq58QmfV0",
  "url": "https://www.youtube.com/watch?v=R2rq58QmfV0",
  "alreadyPublished": false,
  "uploadedAt": "2026-05-31T17:52:51Z"
}
"""

import json
import os
import time
import urllib3
import urllib.parse
import boto3
from botocore.exceptions import ClientError

# AWS clients
s3_client = boto3.client('s3', region_name='eu-north-1')
secrets_client = boto3.client('secretsmanager', region_name='eu-north-1')
http = urllib3.PoolManager()

# Configuration
BUCKET = os.environ.get('BUCKET', 'prochat-video-dev-909439522876-eu-north-1-an')
SECRET_NAME = os.environ.get('YOUTUBE_SECRET_NAME', 'prochat/youtube/says-the-bible/oauth-token')
YOUTUBE_UPLOAD_URL = 'https://www.googleapis.com/upload/youtube/v3/videos'
OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
REFRESH_THRESHOLD_SECONDS = 300  # 5 minutes


def read_publish_json(bucket, job_id):
    """Read publish.json from S3."""
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


def read_secret(secret_name):
    """Read secret from AWS Secrets Manager."""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        raise Exception(f"Failed to read secret {secret_name}: {str(e)}")


def download_from_s3(bucket, key):
    """Download file from S3."""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()
    except ClientError as e:
        raise Exception(f"Failed to download {key}: {str(e)}")


def refresh_token_if_needed(token_data):
    """Refresh OAuth token if expiring soon."""
    access_token = token_data.get('access_token')
    created_at = token_data.get('created_at')
    expires_in = token_data.get('expires_in')

    current_time = int(time.time())
    expiry_time = created_at + expires_in
    seconds_remaining = expiry_time - current_time

    if seconds_remaining < REFRESH_THRESHOLD_SECONDS:
        print(f"Token expiring soon ({seconds_remaining}s), refreshing...")

        refresh_token = token_data.get('refresh_token')
        client_id = token_data.get('client_id')
        client_secret = token_data.get('client_secret')

        if not refresh_token or not client_id or not client_secret:
            raise Exception("Cannot refresh token: missing credentials")

        body = urllib.parse.urlencode({
            'client_id': client_id,
            'client_secret': client_secret,
            'refresh_token': refresh_token,
            'grant_type': 'refresh_token'
        })

        response = http.request(
            'POST',
            OAUTH_TOKEN_URL,
            body=body,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=urllib3.Timeout(connect=5, read=10)
        )

        if response.status != 200:
            raise Exception(f"OAuth refresh failed: {response.status}")

        refresh_response = json.loads(response.data.decode('utf-8'))
        if 'error' in refresh_response:
            raise Exception(f"OAuth error: {refresh_response.get('error_description')}")

        new_access_token = refresh_response.get('access_token')
        new_expires_in = refresh_response.get('expires_in', 3600)

        token_data['access_token'] = new_access_token
        token_data['expires_in'] = new_expires_in
        token_data['created_at'] = current_time

        print("Token refreshed")
        return token_data

    return token_data


def upload_video_to_youtube(access_token, title, description, video_bytes, privacy_status):
    """Upload video to YouTube."""
    # Create metadata
    metadata = {
        "snippet": {
            "title": title or "ProChat OS Internal Test Video",
            "description": description or "",
            "tags": [],
            "categoryId": "22"
        },
        "status": {
            "privacyStatus": privacy_status or "private"
        }
    }

    # Create multipart body manually
    boundary = '===============1234567890=='
    body = (
        f'--{boundary}\r\n'
        f'Content-Type: application/json; charset=UTF-8\r\n'
        f'\r\n'
        f'{json.dumps(metadata)}\r\n'
        f'--{boundary}\r\n'
        f'Content-Type: video/mp4\r\n'
        f'Content-Transfer-Encoding: binary\r\n'
        f'\r\n'
    ).encode('utf-8')
    body += video_bytes
    body += f'\r\n--{boundary}--'.encode('utf-8')

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': f'multipart/related; boundary={boundary}'
    }

    response = http.request(
        'POST',
        f'{YOUTUBE_UPLOAD_URL}?part=snippet,status&uploadType=multipart',
        body=body,
        headers=headers,
        timeout=urllib3.Timeout(connect=10, read=60)
    )

    if response.status not in [200, 201]:
        raise Exception(f"YouTube upload failed: {response.status} {response.data.decode('utf-8')}")

    upload_response = json.loads(response.data.decode('utf-8'))

    if 'error' in upload_response:
        raise Exception(f"YouTube API error: {upload_response['error'].get('message')}")

    video_id = upload_response.get('id')
    if not video_id:
        raise Exception("No video ID returned from YouTube")

    return video_id


def handler(event, context):
    """
    Lambda handler for YouTube video publishing.
    Supports idempotency - checks for existing videoId before uploading.

    Input:
      {
        "jobId": "prochat-os-030",
        "privacyStatus": "private"
      }

    Output:
      {
        "ok": true,
        "videoId": "R2rq58QmfV0",
        "url": "https://www.youtube.com/watch?v=R2rq58QmfV0",
        "alreadyPublished": false,
        "uploadedAt": "2026-05-31T17:52:51Z"
      }
    """
    try:
        job_id = event.get('jobId')
        privacy_status = event.get('privacyStatus', 'private')

        if not job_id:
            raise Exception("jobId required")

        print(f"Publishing job: {job_id}")

        # Step 1: Read publish.json
        print("Reading publish.json from S3...")
        publish_json = read_publish_json(BUCKET, job_id)

        # Step 1b: Get channel ID and load channel config
        channel_id = publish_json.get('channelId', 'says-the-bible')
        print(f"Channel: {channel_id}")

        channel_config = read_channel_config(BUCKET, channel_id)
        yt_config = channel_config.get('platforms', {}).get('youtube', {})

        if not yt_config.get('enabled'):
            raise Exception(f"YouTube publishing not enabled for channel: {channel_id}")

        # Extract YouTube secret from channel config
        secret_name = yt_config.get('secretName')
        if not secret_name:
            raise Exception(f"No YouTube secret configured for channel: {channel_id}")

        # Validate privacy status is allowed
        default_privacy = yt_config.get('defaultPrivacyStatus', 'private')
        allowed_statuses = yt_config.get('allowedPrivacyStatuses', ['private'])

        if privacy_status not in allowed_statuses:
            raise Exception(f"Privacy status not allowed: {privacy_status}")

        if not channel_config.get('publishing', {}).get('allowPublic', True) is False:
            raise Exception("Channel does not allow public videos")

        print(f"Channel config loaded: {channel_config.get('displayName')}")
        print(f"Privacy status: {privacy_status} (allowed: {','.join(allowed_statuses)})")
        print(f"YouTube secret: {secret_name}")

        # Step 2: Check idempotency
        existing_video_id = publish_json.get('platforms', {}).get('youtube', {}).get('videoId')
        existing_status = publish_json.get('platforms', {}).get('youtube', {}).get('status')

        if existing_video_id and existing_status == 'uploaded':
            print(f"Video already published: {existing_video_id}")
            return {
                'ok': True,
                'videoId': existing_video_id,
                'url': f'https://www.youtube.com/watch?v={existing_video_id}',
                'alreadyPublished': True,
                'uploadedAt': publish_json.get('platforms', {}).get('youtube', {}).get('publishedAt')
            }

        # Step 3: Read OAuth token using channel's secret
        print(f"Reading OAuth token from Secrets Manager...")
        token_data = read_secret(secret_name)

        # Step 4: Refresh token if needed
        token_data = refresh_token_if_needed(token_data)
        access_token = token_data['access_token']

        # Step 5: Download video from S3
        print("Downloading video from S3...")
        video_key = publish_json.get('videoKey')
        if not video_key:
            raise Exception("videoKey not in publish.json")

        video_bytes = download_from_s3(BUCKET, video_key)
        print(f"Video downloaded: {len(video_bytes)} bytes")

        # Step 6: Upload to YouTube
        print("Uploading video to YouTube...")
        title = publish_json.get('title', '')
        description = publish_json.get('description', '')

        video_id = upload_video_to_youtube(
            access_token,
            title,
            description,
            video_bytes,
            privacy_status
        )

        print(f"Video uploaded: {video_id}")

        return {
            'ok': True,
            'videoId': video_id,
            'url': f'https://www.youtube.com/watch?v={video_id}',
            'alreadyPublished': False,
            'uploadedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        }

    except Exception as e:
        error_message = str(e)
        print(f"Error: {error_message}")
        return {
            'ok': False,
            'error': error_message
        }
