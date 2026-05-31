"""
YouTube OAuth Token Validation Lambda
Validates YouTube OAuth token from Secrets Manager and auto-refreshes if needed.

Environment variables:
- YOUTUBE_SECRET_NAME: AWS Secrets Manager secret name
  Default: prochat/youtube/says-the-bible/oauth-token

Returns:
  {
    "ok": true,
    "channelId": "UCTET3QhCzrA1nwMkcNj8LmQ",
    "channelTitle": "Says the Bible",
    "tokenRefreshed": false,
    "expiresIn": 1234
  }
"""

import json
import os
import time
import urllib3
import boto3
from botocore.exceptions import ClientError

# AWS clients
secrets_client = boto3.client('secretsmanager', region_name='eu-north-1')
http = urllib3.PoolManager()

# Configuration
SECRET_NAME = os.environ.get('YOUTUBE_SECRET_NAME', 'prochat/youtube/says-the-bible/oauth-token')
YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3/channels'
OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
REFRESH_THRESHOLD_SECONDS = 300  # 5 minutes

# Constants
OAUTH_CLIENT_ID_DEFAULT = None  # Will be read from secret
OAUTH_CLIENT_SECRET_DEFAULT = None  # Will be read from secret


def read_secret(secret_name):
    """Read secret from AWS Secrets Manager."""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        raise Exception(f"Failed to read secret {secret_name}: {str(e)}")


def update_secret(secret_name, token_json):
    """Update secret in AWS Secrets Manager with new token."""
    try:
        secrets_client.update_secret(
            SecretId=secret_name,
            SecretString=json.dumps(token_json)
        )
        return True
    except ClientError as e:
        raise Exception(f"Failed to update secret {secret_name}: {str(e)}")


def refresh_token(refresh_token, client_id, client_secret):
    """Refresh YouTube OAuth token using refresh_token."""
    try:
        body = urllib3.util.urlencode({
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
            raise Exception(f"OAuth refresh failed with status {response.status}")

        token_response = json.loads(response.data.decode('utf-8'))

        if 'error' in token_response:
            raise Exception(f"OAuth error: {token_response.get('error_description', token_response['error'])}")

        return token_response

    except Exception as e:
        raise Exception(f"Token refresh failed: {str(e)}")


def validate_youtube_token(access_token):
    """Validate token by calling YouTube API."""
    try:
        response = http.request(
            'GET',
            f'{YOUTUBE_API_URL}?part=snippet,statistics&mine=true',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=urllib3.Timeout(connect=5, read=10)
        )

        if response.status != 200:
            raise Exception(f"YouTube API returned {response.status}")

        api_response = json.loads(response.data.decode('utf-8'))

        if 'error' in api_response:
            raise Exception(f"YouTube API error: {api_response['error'].get('message', str(api_response['error']))}")

        if not api_response.get('items'):
            raise Exception("No channel found for authenticated user")

        channel = api_response['items'][0]
        channel_id = channel.get('id')
        channel_title = channel.get('snippet', {}).get('title')

        if not channel_id or not channel_title:
            raise Exception("Invalid channel data from YouTube API")

        return {
            'channelId': channel_id,
            'channelTitle': channel_title
        }

    except Exception as e:
        raise Exception(f"YouTube API validation failed: {str(e)}")


def handler(event, context):
    """
    Lambda handler for YouTube OAuth token validation.

    Returns:
        {
            "ok": true/false,
            "channelId": "...",
            "channelTitle": "...",
            "tokenRefreshed": true/false,
            "expiresIn": 1234,
            "error": "..." (if ok is false)
        }
    """
    try:
        # Read token from Secrets Manager
        token_data = read_secret(SECRET_NAME)

        # Validate required fields
        required_fields = ['access_token', 'refresh_token', 'created_at', 'expires_in']
        for field in required_fields:
            if field not in token_data:
                raise Exception(f"Token missing required field: {field}")

        access_token = token_data['access_token']
        refresh_token_val = token_data['refresh_token']
        created_at = token_data['created_at']
        expires_in = token_data['expires_in']

        # Calculate expiry and check if refresh needed
        current_time = int(time.time())
        expiry_time = created_at + expires_in
        seconds_remaining = expiry_time - current_time
        token_refreshed = False

        if seconds_remaining < REFRESH_THRESHOLD_SECONDS:
            print(f"Token expiring soon ({seconds_remaining}s remaining), refreshing...")

            # Extract OAuth client credentials from token data
            # These should be stored in the secret along with tokens
            client_id = token_data.get('client_id')
            client_secret = token_data.get('client_secret')

            if not client_id or not client_secret:
                # If not in token, they must be provided or error
                raise Exception("OAuth client credentials not found in token secret")

            # Refresh the token
            refresh_response = refresh_token(refresh_token_val, client_id, client_secret)

            # Extract new tokens
            new_access_token = refresh_response.get('access_token')
            new_expires_in = refresh_response.get('expires_in', 3600)

            if not new_access_token:
                raise Exception("Token refresh returned no access_token")

            # Update token data
            token_data['access_token'] = new_access_token
            token_data['expires_in'] = new_expires_in
            token_data['created_at'] = current_time

            # Update secret in Secrets Manager
            update_secret(SECRET_NAME, token_data)

            # Update local variables for API validation
            access_token = new_access_token
            expires_in = new_expires_in
            token_refreshed = True
            seconds_remaining = expires_in

            print(f"Token refreshed successfully")

        # Validate token by calling YouTube API
        channel_info = validate_youtube_token(access_token)

        return {
            'ok': True,
            'channelId': channel_info['channelId'],
            'channelTitle': channel_info['channelTitle'],
            'tokenRefreshed': token_refreshed,
            'expiresIn': seconds_remaining
        }

    except Exception as e:
        error_message = str(e)
        print(f"Error: {error_message}")
        return {
            'ok': False,
            'error': error_message
        }
