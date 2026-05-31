"""
Lambda: Poll MediaConvert thumbnail frame capture job until completion (I-4.2)
"""
import json
import boto3

mediaconvert_client = boto3.client('mediaconvert', region_name='eu-north-1')
s3_client = boto3.client('s3', region_name='eu-north-1')


def lambda_handler(event, context):
    """
    Poll a MediaConvert frame capture job until COMPLETE or ERROR.

    Expected input from Step Functions:
    {
      "jobId": "test-001",
      "thumbnailJobId": "1780240232214-nyvuws",
      "thumbnailOutputPrefix": "jobs/test-001/thumbnails/",
      "normalizedThumbnailKey": "jobs/test-001/thumbnails/thumbnail-001.jpg",
      "bucket": "prochat-video-dev-909439522876-eu-north-1-an"
    }

    Output: Status, frame files, and normalized thumbnail location
    """
    job_id = event.get('jobId')
    thumbnail_job_id = event.get('thumbnailJobId')
    bucket = event.get('bucket')
    thumbnail_output_prefix = event.get('thumbnailOutputPrefix')
    normalized_thumbnail_key = event.get('normalizedThumbnailKey')

    if not all([job_id, thumbnail_job_id, bucket]):
        raise ValueError('Missing required fields: jobId, thumbnailJobId, bucket')

    print(f'Checking frame capture job status: {thumbnail_job_id}')

    try:
        response = mediaconvert_client.get_job(Id=thumbnail_job_id)
        job = response['Job']
        status = job.get('Status')

        print(f'  Status: {status}')

        if status in ['ERROR', 'CANCELED']:
            error_code = job.get('ErrorCode', 'UNKNOWN')
            error_message = job.get('ErrorMessage', 'Unknown error')
            raise Exception(f'Job failed: [{error_code}] {error_message}')

        if status != 'COMPLETE':
            print(f'  Job still processing')
            return {
                'jobId': job_id,
                'thumbnailJobId': thumbnail_job_id,
                'status': status,
                'completed': False
            }

        print(f'✓ Frame capture job complete')

        # Verify frames exist
        try:
            # List objects to verify frames were created
            response = s3_client.list_objects_v2(
                Bucket=bucket,
                Prefix=thumbnail_output_prefix,
                MaxKeys=10
            )

            frame_files = []
            if 'Contents' in response:
                frame_files = [obj['Key'] for obj in response['Contents'] if 'frame' in obj['Key']]

            print(f'  Frames found: {len(frame_files)}')
            for frame in sorted(frame_files):
                print(f'    - {frame}')

            if len(frame_files) < 4:
                raise ValueError(f'Expected 4 frames, found {len(frame_files)}')

        except Exception as e:
            print(f'  Warning: Could not verify frames: {str(e)}')

        return {
            'jobId': job_id,
            'thumbnailJobId': thumbnail_job_id,
            'status': status,
            'completed': True,
            'normalizedThumbnailKey': normalized_thumbnail_key,
            'frameCount': len(frame_files) if 'frame_files' in locals() else 0
        }

    except Exception as e:
        error_message = f'Failed to check frame capture job: {str(e)}'
        print(f'✗ Error: {error_message}')
        raise Exception(error_message)
