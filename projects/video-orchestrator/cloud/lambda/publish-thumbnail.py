"""
YouTube Thumbnail Publisher Lambda
Uploads thumbnail to YouTube video and returns success/failure.
Supports retry mode without re-uploading video.

Input:
{
  "jobId": "prochat-os-030",
  "videoId": "R2rq58QmfV0"
}

Output:
{
  "ok": true,
  "videoId": "R2rq58QmfV0",
  "thumbnailUrl": "https://i.ytimg.com/vi/R2rq58QmfV0/default.jpg"
}
"""

import json
import os
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
YOUTUBE_THUMBNAIL_URL = 'https://www.googleapis.com/upload/youtube/v3/thumbnails/set'
OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
REFRESH_THRESHOLD_SECONDS = 300  # 5 minutes


def read_secret(secret_name):
    """Read secret from AWS Secrets Manager."""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        raise Exception(f"Failed to read secret: {str(e)}")


def download_from_s3(bucket, key):
    """Download file from S3."""
    try:
        response = s3_client.get_object(Bucket=bucket, Key=key)
        return response['Body'].read()
    except ClientError as e:
        raise Exception(f"Failed to download {key}: {str(e)}")


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


def refresh_token_if_needed(token_data):
    """Refresh OAuth token if expiring soon."""
    import time

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
        token_data['access_token'] = new_access_token
        token_data['created_at'] = current_time

        print("Token refreshed")

    return token_data


def upload_thumbnail_to_youtube(access_token, video_id, thumbnail_bytes):
    """Upload thumbnail to YouTube video."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'image/jpeg'
    }

    response = http.request(
        'POST',
        f'{YOUTUBE_THUMBNAIL_URL}?videoId={video_id}',
        body=thumbnail_bytes,
        headers=headers,
        timeout=urllib3.Timeout(connect=10, read=30)
    )

    if response.status not in [200, 201]:
        error_data = response.data.decode('utf-8')
        raise Exception(f"YouTube thumbnail upload failed: {response.status} {error_data}")

    # Response contains items array with thumbnail URLs
    response_json = json.loads(response.data.decode('utf-8'))

    if 'error' in response_json:
        raise Exception(f"YouTube API error: {response_json['error'].get('message')}")

    # Extract thumbnail URL from response
    default_url = response_json.get('items', [{}])[0].get('default', {}).get('url')
    if not default_url:
        # If no default URL, construct it (YouTube always provides this URL)
        default_url = f'https://i.ytimg.com/vi/{video_id}/default.jpg'

    return default_url


def handler(event, context):
    """
    Lambda handler for YouTube thumbnail publishing.

    Input:
      {
        "jobId": "prochat-os-030",
        "videoId": "R2rq58QmfV0"
      }

    Output:
      {
        "ok": true,
        "videoId": "R2rq58QmfV0",
        "thumbnailUrl": "https://i.ytimg.com/vi/R2rq58QmfV0/default.jpg"
      }
    """
    try:
        job_id = event.get('jobId')
        video_id = event.get('videoId')

        if not job_id or not video_id:
            raise Exception("jobId and videoId required")

        print(f"Publishing thumbnail for video: {video_id}")

        # Step 1: Read publish.json to get channel ID
        response = s3_client.get_object(
            Bucket=BUCKET,
            Key=f'jobs/{job_id}/metadata/publish.json'
        )
        publish_json = json.loads(response['Body'].read().decode('utf-8'))
        channel_id = publish_json.get('channelId', 'says-the-bible')

        # Step 1b: Load channel config
        channel_config = read_channel_config(BUCKET, channel_id)
        yt_config = channel_config.get('platforms', {}).get('youtube', {})
        secret_name = yt_config.get('secretName')

        if not secret_name:
            raise Exception(f"No YouTube secret configured for channel: {channel_id}")

        print(f"Channel: {channel_id}")
        print(f"YouTube secret: {secret_name}")

        # Step 2: Read OAuth token using channel's secret
        print("Reading OAuth token...")
        token_data = read_secret(secret_name)

        # Step 2: Refresh token if needed
        token_data = refresh_token_if_needed(token_data)
        access_token = token_data['access_token']

        # Step 3: Download thumbnail from S3
        print("Downloading thumbnail from S3...")
        # Read from publish.json to get thumbnail key
        response = s3_client.get_object(
            Bucket=BUCKET,
            Key=f'jobs/{job_id}/metadata/publish.json'
        )
        publish_json = json.loads(response['Body'].read().decode('utf-8'))
        thumbnail_key = publish_json.get('thumbnailKey')

        if not thumbnail_key:
            raise Exception("thumbnailKey not in publish.json")

        thumbnail_bytes = download_from_s3(BUCKET, thumbnail_key)
        print(f"Thumbnail downloaded: {len(thumbnail_bytes)} bytes")

        # Step 4: Upload to YouTube
        print("Uploading thumbnail to YouTube...")
        thumbnail_url = upload_thumbnail_to_youtube(access_token, video_id, thumbnail_bytes)

        print(f"Thumbnail uploaded: {thumbnail_url}")

        return {
            'ok': True,
            'videoId': video_id,
            'thumbnailUrl': thumbnail_url
        }

    except Exception as e:
        error_message = str(e)
        print(f"Error: {error_message}")
        return {
            'ok': False,
            'error': error_message
        }
