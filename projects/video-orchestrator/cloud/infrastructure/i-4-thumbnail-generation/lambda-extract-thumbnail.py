"""
Lambda: Extract Thumbnail from Final Video
Extracts a single frame from the generated MP4 and stores as PNG thumbnail.

Approach: Use moviepy (included in Lambda runtime) to extract frame.
Fallback: If moviepy unavailable, download and use ffmpeg (not available in base Lambda).

For MVP: Use boto3 + ffmpeg-python wrapper if available, or local ffmpeg fallback.
"""
import json
import os
import boto3
import subprocess
import tempfile

s3_client = boto3.client('s3')


def lambda_handler(event, context):
    """
    Extract thumbnail frame from final video and upload to S3.

    Expected input:
    {
      "jobId": "test-001",
      "videoKey": "jobs/test-001/exports/generated-001-final.mp4",
      "bucket": "prochat-video-dev-909439522876-eu-north-1-an",
      "frameTime": 3,
      "thumbnailKey": "jobs/test-001/thumbnails/thumbnail-001.png",
      "resolution": "1280x720"
    }
    """
    job_id = event.get('jobId')
    video_key = event.get('videoKey')
    bucket = event.get('bucket')
    frame_time = event.get('frameTime', 3)
    thumbnail_key = event.get('thumbnailKey')
    resolution = event.get('resolution', '1280x720')

    required = ['jobId', 'videoKey', 'bucket', 'thumbnailKey']
    if not all(k in event for k in required):
        raise ValueError(f'Missing required fields: {required}')

    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            video_local = os.path.join(tmpdir, 'video.mp4')
            thumbnail_local = os.path.join(tmpdir, 'thumbnail.png')

            # Step 1: Download video from S3
            print(f'Downloading video: s3://{bucket}/{video_key}')
            s3_client.download_file(bucket, video_key, video_local)

            video_size = os.path.getsize(video_local)
            print(f'Downloaded: {video_size} bytes')

            # Step 2: Extract frame using ffmpeg
            # ffmpeg command: ffmpeg -i input.mp4 -ss 3 -vframes 1 -vf scale=1280:720:... output.png
            print(f'Extracting frame at {frame_time}s with resolution {resolution}')

            cmd = [
                'ffmpeg',
                '-i', video_local,
                '-ss', str(frame_time),
                '-vframes', '1',
                '-vf', f'scale={resolution}',
                '-update', '1',
                '-y',
                thumbnail_local
            ]

            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode != 0:
                raise Exception(
                    f'ffmpeg failed: {result.stderr}\n'
                    'Ensure ffmpeg is available in Lambda layer or Docker image.'
                )

            thumbnail_size = os.path.getsize(thumbnail_local)
            print(f'Thumbnail extracted: {thumbnail_size} bytes')

            # Step 3: Upload to S3
            print(f'Uploading to s3://{bucket}/{thumbnail_key}')
            s3_client.upload_file(
                thumbnail_local,
                bucket,
                thumbnail_key,
                ExtraArgs={'ContentType': 'image/png'}
            )

            # Step 4: Verify upload
            response = s3_client.head_object(Bucket=bucket, Key=thumbnail_key)
            s3_size = response['ContentLength']
            s3_etag = response['ETag']

            print(f'Verified in S3: {s3_size} bytes, ETag: {s3_etag}')

            return {
                'jobId': job_id,
                'thumbnailKey': f's3://{bucket}/{thumbnail_key}',
                'size': s3_size,
                'etag': s3_etag,
                'frameTime': frame_time,
                'resolution': resolution,
                'extracted': True
            }

    except Exception as e:
        raise Exception(f'Failed to extract thumbnail: {str(e)}')
