"""
Lambda: Trigger MediaConvert frame capture for thumbnail generation (I-4.2)
Runs AFTER successful video assembly (I-3) to extract thumbnail frames.
Separate job from main video assembly (lower risk).
"""
import json
import os
import boto3

mediaconvert_client = boto3.client('mediaconvert', region_name='eu-north-1')
s3_client = boto3.client('s3', region_name='eu-north-1')


def lambda_handler(event, context):
    """
    Create a MediaConvert frame capture job for thumbnail generation.

    Expected input from Step Functions:
    {
      "jobId": "test-001",
      "videoKey": "jobs/test-001/exports/generated-001-final.mp4",
      "bucket": "prochat-video-dev-909439522876-eu-north-1-an",
      "mediaConvertJobId": "1780237282541-8af0jq",
      "status": "complete"
    }

    Output: Frame capture job ID and thumbnail output location
    """
    job_id = event.get('jobId')
    video_key = event.get('videoKey')
    bucket = event.get('bucket')

    if not all([job_id, video_key, bucket]):
        raise ValueError(f'Missing required fields: jobId, videoKey, bucket')

    print(f'Creating frame capture job for: {job_id}')

    # Handle both full S3 paths (from verifyOutput) and relative paths (from testing)
    if video_key.startswith('s3://'):
        video_input = video_key
        print(f'Input video: {video_input}')
    else:
        video_input = f's3://{bucket}/{video_key}'
        print(f'Input video: {video_input}')

    # Get MediaConvert endpoint
    endpoints = mediaconvert_client.describe_endpoints()
    endpoint_url = endpoints['Endpoints'][0]['Url']
    print(f'MediaConvert endpoint: {endpoint_url}')

    # Get working role from environment (should be set via Lambda env vars)
    role_arn = os.getenv('MEDIACONVERT_ROLE')
    if not role_arn:
        # Fallback: use the role from event (for step functions compatibility)
        role_arn = event.get('roleArn', 'arn:aws:iam::909439522876:role/service-role/MediaConvert_Default_Role')

    print(f'Using role: {role_arn}')

    # Thumbnail output directory: jobs/{jobId}/exports/ (same writable prefix as video assembly)
    # Frame naming will be: {input}-frame.{sequence}.jpg
    thumbnail_output_prefix = f'jobs/{job_id}/exports/'

    # Frame capture job settings (MediaConvert requires at least one full video output)
    job_settings = {
        'Inputs': [
            {
                'FileInput': video_input
            }
        ],
        'OutputGroups': [
            {
                'Name': 'Dummy Video',
                'OutputGroupSettings': {
                    'Type': 'FILE_GROUP_SETTINGS',
                    'FileGroupSettings': {
                        'Destination': f's3://{bucket}/{thumbnail_output_prefix}'
                    }
                },
                'Outputs': [
                    {
                        'NameModifier': '-dummy',
                        'ContainerSettings': {
                            'Container': 'MP4'
                        },
                        'VideoDescription': {
                            'CodecSettings': {
                                'Codec': 'H_264',
                                'H264Settings': {
                                    'RateControlMode': 'QVBR',
                                    'MaxBitrate': 5000000,
                                    'QvbrSettings': {
                                        'QvbrQualityLevel': 7
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            {
                'Name': 'Frame Captures',
                'OutputGroupSettings': {
                    'Type': 'FILE_GROUP_SETTINGS',
                    'FileGroupSettings': {
                        'Destination': f's3://{bucket}/{thumbnail_output_prefix}'
                    }
                },
                'Outputs': [
                    {
                        'NameModifier': '-frame',
                        'ContainerSettings': {
                            'Container': 'RAW'
                        },
                        'VideoDescription': {
                            'CodecSettings': {
                                'Codec': 'FRAME_CAPTURE',
                                'FrameCaptureSettings': {
                                    'FramerateNumerator': 1,
                                    'FramerateDenominator': 1,
                                    'MaxCaptures': 4
                                }
                            },
                            'Width': 1280,
                            'Height': 720
                        }
                    }
                ]
            }
        ],
        'TimecodeConfig': {
            'Source': 'ZEROBASED'
        }
    }

    try:
        # Create job with custom endpoint
        mc = boto3.client('mediaconvert', region_name='eu-north-1', endpoint_url=endpoint_url)
        response = mc.create_job(
            Role=role_arn,
            Settings=job_settings
        )

        thumbnail_job_id = response['Job']['Id']
        status = response['Job']['Status']

        print(f'✓ Frame capture job created: {thumbnail_job_id}')
        print(f'  Status: {status}')
        print(f'  Output prefix: {thumbnail_output_prefix}')

        return {
            'jobId': job_id,
            'thumbnailJobId': thumbnail_job_id,
            'thumbnailJobStatus': status,
            'thumbnailOutputPrefix': thumbnail_output_prefix,
            'preferredFrame': f'{thumbnail_output_prefix}*.0000002.jpg',
            'normalizedThumbnailKey': f'jobs/{job_id}/exports/thumbnail-001.jpg',
            'status': 'frame_capture_triggered'
        }

    except Exception as e:
        error_message = f'Failed to create frame capture job: {str(e)}'
        print(f'✗ Error: {error_message}')
        raise Exception(error_message)
