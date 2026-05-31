"""
Lambda: Wait for MediaConvert Completion
Polls MediaConvert job status until completion or failure.
"""
import json
import os
import boto3
import time

# Read MediaConvert endpoint from environment
MEDIACONVERT_ENDPOINT = os.environ.get('MEDIACONVERT_ENDPOINT')
if not MEDIACONVERT_ENDPOINT:
    raise RuntimeError(
        'MEDIACONVERT_ENDPOINT environment variable not set. '
        'Set via: aws lambda update-function-configuration '
        '--function-name video-orchestrator-wait-mediaconvert '
        '--environment Variables={MEDIACONVERT_ENDPOINT=...}'
    )

mediaconvert_client = boto3.client('mediaconvert', endpoint_url=MEDIACONVERT_ENDPOINT)


def lambda_handler(event, context):
    """
    Poll MediaConvert job until completion.

    Expected input:
    {
      "mediaConvertJobId": "string",
      "jobId": "test-001",
      "maxAttempts": 120,
      "delaySeconds": 5
    }
    """
    mediaconvert_job_id = event.get('mediaConvertJobId')
    job_id = event.get('jobId')
    max_attempts = event.get('maxAttempts', 120)
    delay_seconds = event.get('delaySeconds', 5)

    if not mediaconvert_job_id:
        raise ValueError('mediaConvertJobId is required')

    try:
        attempt = 0
        while attempt < max_attempts:
            # Get job status
            response = mediaconvert_client.get_job(Id=mediaconvert_job_id)
            job = response['Job']
            status = job['Status']

            if status == 'COMPLETE':
                # Extract actual output information from MediaConvert job response
                output_group_details = None
                output_files = []

                # Try to get actual output path from OutputGroupDetails
                if 'OutputGroupDetails' in job:
                    output_group_details = job['OutputGroupDetails']
                    if output_group_details and len(output_group_details) > 0:
                        output_files = output_group_details[0].get('OutputDetails', [])

                # Derive actual output key from job settings and output details
                actual_output_key = None
                if output_files and len(output_files) > 0:
                    # MediaConvert provides the actual output file path
                    actual_output_key = output_files[0].get('OutputFile')

                # If no explicit output file, construct from job settings
                if not actual_output_key and 'Settings' in job:
                    settings = job['Settings']
                    if 'OutputGroups' in settings and len(settings['OutputGroups']) > 0:
                        output_group = settings['OutputGroups'][0]
                        if 'OutputGroupSettings' in output_group:
                            og_settings = output_group['OutputGroupSettings']
                            if 'FileGroupSettings' in og_settings:
                                destination = og_settings['FileGroupSettings'].get('Destination', '')
                                # Destination is directory; construct filename
                                if 'Outputs' in output_group and len(output_group['Outputs']) > 0:
                                    output_obj = output_group['Outputs'][0]
                                    name_modifier = output_obj.get('NameModifier', '')
                                    # Get input name from Settings.Inputs
                                    if 'Inputs' in settings and len(settings['Inputs']) > 0:
                                        input_obj = settings['Inputs'][0]
                                        input_file = input_obj.get('FileInput', '')
                                        input_basename = input_file.split('/')[-1].replace('.mp4', '')
                                        output_filename = f'{input_basename}{name_modifier}.mp4'
                                        actual_output_key = f'{destination}{output_filename}'

                return {
                    'jobId': job_id,
                    'mediaConvertJobId': mediaconvert_job_id,
                    'status': status,
                    'completed': True,
                    'attempts': attempt + 1,
                    'actualOutputKey': actual_output_key,
                    'outputGroupDetails': bool(output_group_details),
                    'errorCode': job.get('ErrorCode'),
                    'errorMessage': job.get('ErrorMessage')
                }

            elif status == 'ERROR':
                error_code = job.get('ErrorCode', 'UNKNOWN')
                error_msg = job.get('ErrorMessage', 'No error message provided')
                raise Exception(
                    f'MediaConvert job ERROR: Code={error_code}, Message={error_msg}'
                )

            elif status == 'FAILED':
                error_code = job.get('ErrorCode', 'UNKNOWN')
                error_msg = job.get('ErrorMessage', 'Unknown error')
                raise Exception(
                    f'MediaConvert job failed: Code={error_code}, Message={error_msg}'
                )

            elif status in ['CANCELED', 'CANCELING']:
                raise Exception(f'MediaConvert job was canceled: {status}')

            # Job still processing, wait and retry
            attempt += 1
            if attempt < max_attempts:
                time.sleep(delay_seconds)

        # Max attempts reached
        raise Exception(f'MediaConvert job did not complete within {max_attempts} attempts ({max_attempts * delay_seconds} seconds)')

    except Exception as e:
        raise Exception(f'Failed waiting for MediaConvert job: {str(e)}')
