"""
Lambda: Trigger MediaConvert Job
Creates and submits a MediaConvert job for final assembly.
"""
import json
import os
import boto3

# Read MediaConvert endpoint from environment
MEDIACONVERT_ENDPOINT = os.environ.get('MEDIACONVERT_ENDPOINT')
if not MEDIACONVERT_ENDPOINT:
    raise RuntimeError(
        'MEDIACONVERT_ENDPOINT environment variable not set. '
        'Set via: aws lambda update-function-configuration '
        '--function-name video-orchestrator-mediaconvert '
        '--environment Variables={MEDIACONVERT_ENDPOINT=...}'
    )

mediaconvert_client = boto3.client('mediaconvert', endpoint_url=MEDIACONVERT_ENDPOINT)


def lambda_handler(event, context):
    """
    Create and submit MediaConvert job for final assembly.

    Expected input:
    {
      "jobId": "test-001",
      "videoInput": "s3://bucket/path/video.mp4",
      "audioInput": "s3://bucket/path/audio.mp3",
      "outputPath": "s3://bucket/path/",
      "outputFilename": "test-001-final.mp4"
    }
    """
    job_id = event.get('jobId')
    video_input = event.get('videoInput')
    audio_input = event.get('audioInput')
    output_path = event.get('outputPath')
    output_filename = event.get('outputFilename')

    required = ['jobId', 'videoInput', 'audioInput', 'outputPath', 'outputFilename']
    if not all(k in event for k in required):
        raise ValueError(f'Missing required fields: {required}')

    try:
        # MediaConvert job settings
        # Extract base name from output filename to use with NameModifier
        # MediaConvert uses NameModifier to append to input name, not direct Filename
        name_modifier = output_filename.replace('.mp4', '')

        # I-3: Use generated clip instead of placeholder
        # Placeholder: s3://.../jobs/test-001/exports/sample-transcoded.mp4
        # Generated:   s3://.../jobs/test-001/video-generated/generated-001.mp4
        video_input_path = video_input
        if 'sample-transcoded' in video_input:
            # Replace entire exports path with video-generated path
            video_input_path = video_input.replace(
                'exports/sample-transcoded.mp4',
                'video-generated/generated-001.mp4'
            )

        # CRITICAL: Validate path never has double nesting
        if '/exports/video-generated/' in video_input_path:
            raise ValueError(
                f'CRITICAL: Invalid path construction detected: {video_input_path}. '
                'Path must be video-generated/ not exports/video-generated/'
            )

        job_settings = {
            'TimecodeConfig': {
                'Source': 'ZEROBASED'
            },
            'Inputs': [
                {
                    'FileInput': video_input_path,
                    'AudioSelectors': {
                        'Audio Selector 1': {
                            'DefaultSelection': 'DEFAULT',
                            'ExternalAudioFileInput': audio_input
                        }
                    },
                    'VideoSelector': {}
                }
            ],
            'OutputGroups': [
                {
                    'Name': 'File Group',
                    'Outputs': [
                        {
                            'NameModifier': '-final',
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
                            },
                            'AudioDescriptions': [
                                {
                                    'AudioSourceName': 'Audio Selector 1',
                                    'CodecSettings': {
                                        'Codec': 'AAC',
                                        'AacSettings': {
                                            'Bitrate': 128000,
                                            'CodingMode': 'CODING_MODE_2_0',
                                            'SampleRate': 48000
                                        }
                                    }
                                }
                            ],
                            'ContainerSettings': {
                                'Container': 'MP4'
                            }
                        }
                    ],
                    'OutputGroupSettings': {
                        'Type': 'FILE_GROUP_SETTINGS',
                        'FileGroupSettings': {
                            'Destination': output_path
                        }
                    }
                }
            ]
        }

        # Submit job (do not pass Queue or JobTemplate parameters)
        # MediaConvert will use the account default queue
        response = mediaconvert_client.create_job(
            UserMetadata={
                'jobId': job_id,
                'phase': 'i-2'
            },
            Role='arn:aws:iam::909439522876:role/service-role/MediaConvert_Default_Role',
            Settings=job_settings
        )

        mediaconvert_job_id = response['Job']['Id']

        # Compute expected output filename based on input basename + NameModifier
        # MediaConvert uses input filename + NameModifier to create output
        input_basename = video_input_path.split('/')[-1].replace('.mp4', '')
        expected_output_filename = f'{input_basename}-final.mp4'
        expected_output_key = f'{output_path.rstrip("/")}/{expected_output_filename}'

        return {
            'jobId': job_id,
            'mediaConvertJobId': mediaconvert_job_id,
            'status': response['Job']['Status'],
            'created': True,
            'expectedOutputFilename': expected_output_filename,
            'expectedOutputKey': expected_output_key
        }

    except Exception as e:
        raise Exception(f'Failed to create MediaConvert job: {str(e)}')
